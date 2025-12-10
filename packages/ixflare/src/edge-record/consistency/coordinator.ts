/**
 * @module edge-record/consistency/coordinator
 * @description Durable Object-based write coordination for multi-tier consistency
 */

import type { CoordinatorOptions } from './types'

/** Default event retention period (1 hour) */
const DEFAULT_EVENT_RETENTION_MS = 60 * 60 * 1000

/** Maximum events to return per query */
const MAX_EVENTS_PER_QUERY = 100

/**
 * Consistency Coordinator for Multi-Tier Data
 *
 * Provides write coordination and ordering guarantees across storage tiers.
 * Ensures proper sequencing of writes before propagating to KV/D1.
 *
 * **⚠️ ARCHITECTURE CONSTRAINT:**
 * This coordinator requires `DurableObjectStorage` which is ONLY available
 * **inside** a Durable Object class. Workers cannot use this directly.
 * You must create a DO class that wraps this coordinator.
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
 * // 1. Create a Durable Object that wraps the coordinator
 * export class InventoryCoordinatorDO implements DurableObject {
 *   private coordinator: ConsistencyCoordinator
 *
 *   constructor(state: DurableObjectState, env: Env) {
 *     this.coordinator = new ConsistencyCoordinator(
 *       state.storage,  // Only available inside DO
 *       env.DB,
 *       env.CACHE_KV
 *     )
 *   }
 *
 *   async updateInventory(productId: string, newQuantity: number) {
 *     await this.coordinator.write('inventory', productId, {
 *       quantity: newQuantity,
 *     }, { invalidateKV: true, syncToD1: true })
 *   }
 *
 *   async fetch(request: Request) {
 *     const { action, productId, quantity } = await request.json()
 *     if (action === 'update') {
 *       await this.updateInventory(productId, quantity)
 *     }
 *     return new Response('OK')
 *   }
 * }
 *
 * // 2. Worker calls DO via stub (NOT direct coordinator usage)
 * const id = env.INVENTORY_COORDINATOR.idFromName('global')
 * const stub = env.INVENTORY_COORDINATOR.get(id)
 * await stub.fetch(new Request('http://internal/', {
 *   method: 'POST',
 *   body: JSON.stringify({ action: 'update', productId: '123', quantity: 50 })
 * }))
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
   * @param limit Maximum number of events to return (default: 100)
   * @returns Array of events
   */
  async getEvents(
    tableName: string,
    since: number,
    limit: number = MAX_EVENTS_PER_QUERY
  ): Promise<unknown[]> {
    const prefix = `events:${tableName}:`
    const list = await this.storage.list({ prefix, limit: limit * 2 }) // Fetch extra to filter

    const events: unknown[] = []
    for (const [, value] of list) {
      const event = value as { timestamp: number }
      if (event.timestamp >= since) {
        events.push(value)
        if (events.length >= limit) break
      }
    }

    return events.sort((a, b) => {
      const aTs = (a as { timestamp: number }).timestamp
      const bTs = (b as { timestamp: number }).timestamp
      return aTs - bTs
    })
  }

  /**
   * Clean up old events beyond retention period
   *
   * Should be called periodically (e.g., via Durable Objects alarm)
   *
   * @param tableName Optional table name to clean (all tables if not specified)
   * @param retentionMs Retention period in milliseconds (default: 1 hour)
   * @returns Number of events deleted
   *
   * @example
   * ```typescript
   * // In Durable Object alarm handler
   * async alarm() {
   *   const cleaned = await this.coordinator.cleanupOldEvents()
   *   console.log(`Cleaned ${cleaned} old events`)
   *   // Schedule next cleanup
   *   await this.state.storage.setAlarm(Date.now() + 3600000)
   * }
   * ```
   */
  async cleanupOldEvents(
    tableName?: string,
    retentionMs: number = DEFAULT_EVENT_RETENTION_MS
  ): Promise<number> {
    const cutoffTime = Date.now() - retentionMs
    const prefix = tableName ? `events:${tableName}:` : 'events:'
    const list = await this.storage.list({ prefix })

    const keysToDelete: string[] = []
    for (const [key, value] of list) {
      const event = value as { timestamp: number }
      if (event.timestamp < cutoffTime) {
        keysToDelete.push(key)
      }
    }

    if (keysToDelete.length > 0) {
      // Delete in batches of 128 (DO storage limit)
      const batchSize = 128
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize)
        await this.storage.delete(batch)
      }
    }

    return keysToDelete.length
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
