import type { Model, SchemaDefinition, InferSchema } from '../schema/types'
import type { CacheOptions } from './types'
import { KVAdapter } from './kv-adapter'
import { transformKeysToCamelCase } from '../crud/case-transform'

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
 * - read-heavy: Aggressive caching, longer TTL
 * - write-heavy: Conservative caching, shorter TTL
 * - balanced: Default middle-ground
 */
export class CacheLayer<T extends SchemaDefinition> {
  private kvAdapter: KVAdapter<T>
  private strategy: 'read-heavy' | 'write-heavy' | 'balanced'
  private ttl: number

  constructor(
    private model: Model<T>,
    private kv: KVNamespace,
    private sourceDb: D1Database,
    private options: CacheOptions
  ) {
    this.kvAdapter = new KVAdapter(model, kv, { ttl: options.ttl })
    this.strategy = options.strategy || 'balanced'
    this.ttl = options.ttl || 300 // 5 min default
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

    // Fallback to D1
    const stmt = this.sourceDb.prepare(`SELECT * FROM ${this.model.$tableName} WHERE id = ?`).bind(id)
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
   * Call this after updates or deletes to maintain consistency
   */
  async invalidate(id: string | number): Promise<void> {
    await this.kvAdapter.delete(String(id))
  }

  /**
   * Warm cache for multiple IDs
   *
   * Pre-populates cache with frequently accessed records
   *
   * @param ids Array of IDs to warm
   */
  async warm(ids: (string | number)[]): Promise<void> {
    const placeholders = ids.map(() => '?').join(', ')
    const stmt = this.sourceDb
      .prepare(`SELECT * FROM ${this.model.$tableName} WHERE id IN (${placeholders})`)
      .bind(...ids)
    const results = await stmt.all()

    for (const row of results.results) {
      const id = (row as Record<string, unknown>).id
      await this.kvAdapter.put(String(id), row as Partial<InferSchema<T>>)
    }
  }
}
