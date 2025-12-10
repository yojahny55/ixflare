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
 * Retry configuration for D1 sync
 */
interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
}

/**
 * Simple exponential backoff delay
 */
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs)
  // Add jitter (±25%)
  return delay * (0.75 + Math.random() * 0.5)
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

  private retryConfig: RetryConfig

  constructor(
    private model: Model<T>,
    private kv: KVNamespace,
    private sourceDb: D1Database,
    private options?: {
      /** TTL for KV entries (default: 300s) */
      ttl?: number
      /** Manual sync mode (don't auto-sync to D1) */
      manualSync?: boolean
      /** Retry configuration for failed D1 syncs */
      retry?: Partial<RetryConfig>
      /** Enable debug logging (default: false in production) */
      debug?: boolean
    }
  ) {
    this.kvAdapter = new KVAdapter(model, kv, { ttl: options?.ttl })
    this.escapedTableName = escapeIdentifier(model.$tableName)
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retry }
  }

  /**
   * Log helper that respects debug setting
   * @private
   */
  private log(level: 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
    if (level === 'error' || (this.options?.debug && !isProduction)) {
      console[level](`[EventualConsistencyAdapter] ${message}`, ...args)
    }
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
   * Writes to KV immediately and queues D1 sync with retry.
   */
  async put(id: string, data: Partial<InferSchema<T>>): Promise<void> {
    // Write to KV first (fast path)
    await this.kvAdapter.put(id, data)

    // Queue D1 sync unless manual sync mode
    if (!this.options?.manualSync) {
      this.syncWithRetry(id, data).catch((err) => {
        this.log('error', `D1 sync failed permanently for ${id} after retries:`, err)
      })
    }
  }

  /**
   * Sync to D1 with exponential backoff retry
   * @private
   */
  private async syncWithRetry(id: string, data: Partial<InferSchema<T>>): Promise<void> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const status = await this.syncToD1(id, data)
        if (status === 'synced') {
          if (attempt > 0) {
            this.log('info', `D1 sync succeeded for ${id} on attempt ${attempt + 1}`)
          }
          return
        }
        // If status is 'failed' but no exception, treat as retriable
        lastError = new Error(`Sync returned status: ${status}`)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        this.log('warn', `D1 sync attempt ${attempt + 1} failed for ${id}:`, lastError.message)
      }

      // Don't sleep after last attempt
      if (attempt < this.retryConfig.maxRetries) {
        const delay = getRetryDelay(attempt, this.retryConfig)
        await sleep(delay)
      }
    }

    throw lastError || new Error(`D1 sync failed for ${id}`)
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
        this.log('error', `D1 delete failed for ${id}:`, err)
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
      this.log('error', `syncToD1 error for ${id}:`, error)
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
