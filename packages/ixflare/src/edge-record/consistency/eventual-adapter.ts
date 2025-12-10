/**
 * @module edge-record/consistency/eventual-adapter
 * @description Eventual consistency adapter with KV-first writes
 */

import type { Model, SchemaDefinition, InferSchema } from '@/edge-record/schema/types'
import { KVAdapter } from '@/edge-record/storage/kv-adapter'
import { transformKeysToSnakeCase } from '@/edge-record/crud/case-transform'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'

/**
 * Sync status for D1 synchronization
 */
export type SyncStatus = 'pending' | 'synced' | 'failed'

/**
 * Eventual Consistency Adapter
 *
 * Provides eventual consistency with KV-first writes and background D1 sync.
 * Optimizes for write speed (~5-20ms) with eventual D1 synchronization.
 *
 * Write pattern:
 * 1. Write to KV immediately (fast)
 * 2. Queue D1 sync for background processing
 * 3. Return success to client immediately
 *
 * Best for:
 * - High write volume scenarios
 * - Analytics and metrics
 * - Activity feeds
 * - Non-critical data that can tolerate brief inconsistency
 *
 * Note: This implementation provides basic KV-first logic.
 * Production use requires:
 * - Cloudflare Queues for reliable D1 sync
 * - Scheduled Workers for retry logic
 * - Dead letter queue for failed syncs
 *
 * @example
 * ```typescript
 * export const PageView = defineModel('page_views', {
 *   pageId: field.string().primaryKey(),
 *   count: field.integer(),
 * }, {
 *   consistency: 'eventual',  // KV-first writes
 * })
 * ```
 */
export class EventualConsistencyAdapter<T extends SchemaDefinition> {
  private kvAdapter: KVAdapter<T>
  private escapedTableName: string

  constructor(
    private model: Model<T>,
    private kv: KVNamespace,
    private sourceDb: D1Database,
    private options?: {
      /** TTL for KV entries (default: 300s) */
      ttl?: number
      /** Manual sync mode (don't auto-sync to D1) */
      manualSync?: boolean
    }
  ) {
    this.kvAdapter = new KVAdapter(model, kv, { ttl: options?.ttl })
    this.escapedTableName = escapeIdentifier(model.$tableName)
  }

  /**
   * Get a record by ID (reads from KV)
   */
  async get(id: string): Promise<InferSchema<T> | null> {
    return this.kvAdapter.get(id)
  }

  /**
   * Store a record with KV-first write
   *
   * Writes to KV immediately and queues D1 sync.
   */
  async put(id: string, data: Partial<InferSchema<T>>): Promise<void> {
    // Write to KV first (fast path)
    await this.kvAdapter.put(id, data)

    // Queue D1 sync unless manual sync mode
    if (!this.options?.manualSync) {
      // NOTE: In production, use Cloudflare Queues or scheduled workers
      // This is a best-effort sync that may fail silently
      this.syncToD1(id, data).catch((err) => {
        console.error(`[EventualConsistencyAdapter] D1 sync failed for ${id}:`, err)
        // In production: send to dead letter queue or retry mechanism
      })
    }
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<void> {
    // Delete from KV immediately
    await this.kvAdapter.delete(id)

    // Queue D1 delete unless manual sync mode
    if (!this.options?.manualSync) {
      this.deleteFromD1(id).catch((err) => {
        console.error(`[EventualConsistencyAdapter] D1 delete failed for ${id}:`, err)
      })
    }
  }

  /**
   * Manually trigger D1 sync for a record
   *
   * Useful when manual sync mode is enabled or for retry logic.
   *
   * @param id Record ID
   * @returns Sync status
   */
  async syncToD1(id: string, data?: Partial<InferSchema<T>>): Promise<SyncStatus> {
    try {
      // If data not provided, fetch from KV
      const recordData = data || (await this.kvAdapter.get(id))
      if (!recordData) {
        return 'failed' // No data to sync
      }

      // Transform to snake_case for D1
      const dbData = transformKeysToSnakeCase(recordData as Record<string, unknown>)
      const fields = Object.keys(dbData)
      const values = fields.map((f) => dbData[f])

      // Upsert to D1 (INSERT ... ON CONFLICT DO UPDATE)
      const placeholders = fields.map(() => '?').join(', ')
      const escapedFields = fields.map((f) => escapeIdentifier(f)).join(', ')

      // Build SET clause for update (exclude id)
      const updateFields = fields.filter((f) => f !== 'id')
      const setClause = updateFields
        .map((f) => `${escapeIdentifier(f)} = excluded.${escapeIdentifier(f)}`)
        .join(', ')

      const sql = `INSERT INTO ${this.escapedTableName} (${escapedFields}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setClause}`

      await this.sourceDb
        .prepare(sql)
        .bind(...values)
        .run()

      return 'synced'
    } catch (error) {
      console.error(`[EventualConsistencyAdapter] syncToD1 error:`, error)
      return 'failed'
    }
  }

  /**
   * Delete from D1 (background sync)
   * @private
   */
  private async deleteFromD1(id: string): Promise<void> {
    const sql = `DELETE FROM ${this.escapedTableName} WHERE id = ?`
    await this.sourceDb.prepare(sql).bind(id).run()
  }

  /**
   * Batch sync multiple records to D1
   *
   * Useful for periodic sync jobs or recovery.
   *
   * @param ids Array of record IDs to sync
   * @returns Map of ID to sync status
   */
  async batchSync(ids: string[]): Promise<Map<string, SyncStatus>> {
    const results = new Map<string, SyncStatus>()

    for (const id of ids) {
      const status = await this.syncToD1(id)
      results.set(id, status)
    }

    return results
  }
}
