/**
 * @module edge-record/consistency/coordinator
 * @description Durable Object-based write coordination for multi-tier consistency
 */

import type { CoordinatorOptions } from './types'

/**
 * Consistency Coordinator Durable Object
 *
 * Provides write coordination and ordering guarantees across storage tiers.
 * Ensures proper sequencing of writes before propagating to KV/D1.
 *
 * Use cases:
 * - Critical writes requiring ordering guarantees
 * - Cross-tier coordination (DO → D1 → KV)
 * - Broadcast notifications to subscribers
 * - Preventing write conflicts
 *
 * Features:
 * - Serialized write processing
 * - Automatic KV invalidation
 * - D1 sync coordination
 * - Subscriber notifications
 *
 * @example
 * ```typescript
 * // In your worker
 * export class ConsistencyCoordinatorDO implements DurableObject {
 *   constructor(private state: DurableObjectState, private env: Env) {}
 *
 *   async fetch(request: Request) {
 *     const coordinator = new ConsistencyCoordinator(
 *       this.state.storage,
 *       this.env.DB,
 *       this.env.CACHE_KV
 *     )
 *     return coordinator.handleRequest(request)
 *   }
 * }
 *
 * // Usage in application
 * const coordinator = new ConsistencyCoordinator(env.COORDINATOR)
 * await coordinator.write('inventory', productId, {
 *   quantity: newQuantity,
 * }, { invalidateKV: true, syncToD1: true })
 * ```
 */
export class ConsistencyCoordinator {
  constructor(
    private storage: DurableObjectStorage,
    private db?: D1Database,
    private kv?: KVNamespace
  ) {}

  /**
   * Coordinated write with ordering guarantees
   *
   * Writes are processed serially through the DO, ensuring proper ordering
   * before propagating to other storage tiers.
   *
   * @param tableName The table/model name
   * @param id Record ID
   * @param data Data to write
   * @param options Coordination options
   */
  async write(
    tableName: string,
    id: string,
    data: Record<string, unknown>,
    options: CoordinatorOptions = {}
  ): Promise<void> {
    const { invalidateKV = false, syncToD1 = true, broadcast = false } = options

    // Step 1: Write to DO storage (source of truth for coordination)
    const key = `${tableName}:${id}`
    await this.storage.put(key, data)

    // Step 2: Sync to D1 if requested
    if (syncToD1 && this.db) {
      await this.syncToD1(tableName, id, data)
    }

    // Step 3: Invalidate KV cache if requested
    if (invalidateKV && this.kv) {
      await this.kv.delete(key)
    }

    // Step 4: Broadcast to subscribers if requested
    if (broadcast) {
      await this.broadcastUpdate(tableName, id, data)
    }
  }

  /**
   * Read with strong consistency from DO
   *
   * @param tableName The table/model name
   * @param id Record ID
   * @returns Record data or null
   */
  async read(tableName: string, id: string): Promise<Record<string, unknown> | null> {
    const key = `${tableName}:${id}`
    const data = await this.storage.get<Record<string, unknown>>(key)
    return data || null
  }

  /**
   * Delete with coordination
   *
   * @param tableName The table/model name
   * @param id Record ID
   * @param options Coordination options
   */
  async delete(tableName: string, id: string, options: CoordinatorOptions = {}): Promise<void> {
    const { invalidateKV = true, syncToD1 = true, broadcast = false } = options

    const key = `${tableName}:${id}`

    // Step 1: Delete from DO storage
    await this.storage.delete(key)

    // Step 2: Delete from D1 if requested
    if (syncToD1 && this.db) {
      const sql = `DELETE FROM "${tableName}" WHERE id = ?`
      await this.db.prepare(sql).bind(id).run()
    }

    // Step 3: Invalidate KV cache
    if (invalidateKV && this.kv) {
      await this.kv.delete(key)
    }

    // Step 4: Broadcast deletion if requested
    if (broadcast) {
      await this.broadcastDeletion(tableName, id)
    }
  }

  /**
   * Sync data to D1
   * @private
   */
  private async syncToD1(
    tableName: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) return

    const fields = Object.keys(data)
    const values = fields.map((f) => data[f])

    const placeholders = fields.map(() => '?').join(', ')
    const escapedFields = fields.map((f) => `"${f}"`).join(', ')

    // Upsert to D1
    const updateFields = fields.filter((f) => f !== 'id')
    const setClause = updateFields.map((f) => `"${f}" = excluded."${f}"`).join(', ')

    const sql = `INSERT INTO "${tableName}" (${escapedFields}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setClause}`

    await this.db
      .prepare(sql)
      .bind(...values)
      .run()
  }

  /**
   * Broadcast update notification to subscribers
   * @private
   */
  private async broadcastUpdate(
    tableName: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // Store broadcast event in DO storage
    const eventKey = `events:${tableName}:${Date.now()}`
    await this.storage.put(eventKey, {
      type: 'update',
      tableName,
      id,
      data,
      timestamp: Date.now(),
    })

    // In production: use WebSockets, Durable Objects alarms, or Cloudflare Pub/Sub
    // For now, we just store the event for potential polling
  }

  /**
   * Broadcast deletion notification to subscribers
   * @private
   */
  private async broadcastDeletion(tableName: string, id: string): Promise<void> {
    const eventKey = `events:${tableName}:${Date.now()}`
    await this.storage.put(eventKey, {
      type: 'delete',
      tableName,
      id,
      timestamp: Date.now(),
    })
  }

  /**
   * Get recent events for a table (for subscriber polling)
   *
   * @param tableName The table name
   * @param since Timestamp to get events since
   * @returns Array of events
   */
  async getEvents(tableName: string, since: number): Promise<unknown[]> {
    const prefix = `events:${tableName}:`
    const list = await this.storage.list({ prefix })

    const events: unknown[] = []
    for (const [, value] of list) {
      const event = value as { timestamp: number }
      if (event.timestamp >= since) {
        events.push(value)
      }
    }

    return events.sort((a, b) => {
      const aTs = (a as { timestamp: number }).timestamp
      const bTs = (b as { timestamp: number }).timestamp
      return aTs - bTs
    })
  }

  /**
   * Health check for coordinator
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded'
    checks: {
      storage: boolean
      db: boolean
      kv: boolean
    }
  }> {
    const checks = {
      storage: true, // DO storage always available
      db: !!this.db,
      kv: !!this.kv,
    }

    const allHealthy = checks.storage && checks.db && checks.kv
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
    }
  }
}
