import type { Model, SchemaDefinition, InferSchema } from '@/edge-record/schema/types'
import type { CacheOptions } from './types'
import { KVAdapter } from './kv-adapter'
import { transformKeysToCamelCase } from '@/edge-record/crud/case-transform'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'

/** Default TTL values by strategy */
const STRATEGY_TTL: Record<'read-heavy' | 'write-heavy' | 'balanced', number> = {
  'read-heavy': 600, // 10 minutes - aggressive caching
  'write-heavy': 60, // 1 minute - conservative caching
  balanced: 300, // 5 minutes - default middle-ground
}

/**
 * Cache Layer for EdgeRecord
 *
 * Implements read-through caching pattern:
 * - Checks cache (KV) first
 * - Falls back to source database (D1)
 * - Populates cache on miss
 *
 * Best for:
 * - High read/low write workloads
 * - Frequently accessed data
 * - Reducing D1 query load
 *
 * Strategies:
 * - read-heavy: Aggressive caching, longer TTL (10 min)
 * - write-heavy: Conservative caching, shorter TTL (1 min)
 * - balanced: Default middle-ground (5 min)
 */
export class CacheLayer<T extends SchemaDefinition> {
  private kvAdapter: KVAdapter<T>
  private strategy: 'read-heavy' | 'write-heavy' | 'balanced'
  private ttl: number
  private escapedTableName: string

  constructor(
    private model: Model<T>,
    private kv: KVNamespace,
    private sourceDb: D1Database,
    private options: CacheOptions
  ) {
    this.strategy = options.strategy || 'balanced'
    // Use strategy-based TTL if not explicitly provided
    this.ttl = options.ttl ?? STRATEGY_TTL[this.strategy]
    // Ensure TTL meets KV minimum (60s)
    if (this.ttl < 60) {
      this.ttl = 60
    }
    this.kvAdapter = new KVAdapter(model, kv, { ttl: this.ttl })
    // Pre-escape table name for SQL injection prevention
    this.escapedTableName = escapeIdentifier(model.$tableName)
  }

  /**
   * Read-through cache: check KV first, fallback to D1
   *
   * @param id Record ID
   * @returns Record or null if not found
   */
  async get(id: string | number): Promise<InferSchema<T> | null> {
    const cacheKey = String(id)

    // Try cache first
    const cached = await this.kvAdapter.get(cacheKey)
    if (cached) return cached

    // Fallback to D1 (table name pre-escaped in constructor)
    const stmt = this.sourceDb
      .prepare(`SELECT * FROM ${this.escapedTableName} WHERE id = ?`)
      .bind(id)
    const result = await stmt.first()

    if (result) {
      // Populate cache
      await this.kvAdapter.put(cacheKey, result as Partial<InferSchema<T>>)
      return transformKeysToCamelCase(result as Record<string, unknown>) as InferSchema<T>
    }

    return null
  }

  /**
   * Invalidate cache entry
   *
   * Call this after updates or deletes to maintain consistency.
   * Respects the configured invalidation strategy.
   */
  async invalidate(id: string | number): Promise<void> {
    const strategy = this.options.invalidationStrategy || 'immediate'

    if (strategy === 'immediate') {
      await this.kvAdapter.delete(String(id))
    }
    // 'lazy' and 'none' strategies don't invalidate
  }

  /**
   * Write-through: Update both D1 and KV simultaneously
   *
   * Ensures cache is immediately populated after write.
   * Used when writeThrough option is enabled.
   *
   * @param id Record ID
   * @param data Partial data to update
   */
  async writeThrough(id: string | number, data: Partial<InferSchema<T>>): Promise<void> {
    const dbData = this.transformToDbFormat(data)
    const fields = Object.keys(dbData).filter((k) => k !== 'id')
    const values = fields.map((k) => dbData[k])

    // Build SET clause for UPDATE
    const setClause = fields.map((f) => `${escapeIdentifier(f)} = ?`).join(', ')
    const sql = `UPDATE ${this.escapedTableName} SET ${setClause} WHERE id = ?`

    // Write to both D1 and KV simultaneously
    await Promise.all([
      this.sourceDb
        .prepare(sql)
        .bind(...values, id)
        .run(),
      this.kvAdapter.put(String(id), data),
    ])
  }

  /**
   * Transform data to snake_case DB format
   * @private
   */
  private transformToDbFormat(data: Partial<InferSchema<T>>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const key in data) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      result[snakeKey] = data[key]
    }
    return result
  }

  /**
   * Warm cache for multiple IDs
   *
   * Pre-populates cache with frequently accessed records
   *
   * @param ids Array of IDs to warm
   */
  async warm(ids: (string | number)[]): Promise<void> {
    if (ids.length === 0) return

    const placeholders = ids.map(() => '?').join(', ')
    const stmt = this.sourceDb
      .prepare(`SELECT * FROM ${this.escapedTableName} WHERE id IN (${placeholders})`)
      .bind(...ids)
    const results = await stmt.all()

    for (const row of results.results) {
      const id = (row as Record<string, unknown>).id
      await this.kvAdapter.put(String(id), row as Partial<InferSchema<T>>)
    }
  }
}
