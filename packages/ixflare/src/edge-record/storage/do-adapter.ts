import type { Model, SchemaDefinition, InferSchema } from '@/edge-record/schema/types'
import {
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from '@/edge-record/crud/case-transform'

/**
 * Durable Objects Storage Adapter for EdgeRecord
 *
 * Provides strongly consistent storage using Cloudflare Durable Objects.
 * Best for:
 * - Strong consistency requirements
 * - Counters and real-time coordination
 * - Transactional operations
 * - Single-point coordination
 *
 * Features:
 * - Strong consistency (single source of truth)
 * - Transactional storage API
 * - Atomic operations (increment, etc.)
 * - 50-100ms typical latency
 *
 * Limits:
 * - Single DO instance per unique ID
 * - Geographic coordination overhead
 */
export class DOAdapter<T extends SchemaDefinition> {
  constructor(
    private model: Model<T>,
    private storage: DurableObjectStorage
  ) {}

  /**
   * Generate storage key for a record
   * Format: {tableName}:{id}
   */
  private getKey(id: string): string {
    return `${this.model.$tableName}:${id}`
  }

  /**
   * Get a record by ID
   * Returns null if not found
   */
  async get(id: string): Promise<InferSchema<T> | null> {
    const raw = await this.storage.get(this.getKey(id))
    if (!raw) return null
    return transformKeysToCamelCase(raw as Record<string, unknown>) as InferSchema<T>
  }

  /**
   * Store a record
   */
  async put(id: string, data: Partial<InferSchema<T>>): Promise<void> {
    const transformed = transformKeysToSnakeCase(data as Record<string, unknown>)
    await this.storage.put(this.getKey(id), transformed)
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<void> {
    await this.storage.delete(this.getKey(id))
  }

  /**
   * Atomic transaction for strong consistency
   *
   * Provides transactional guarantees for multiple operations.
   * All operations within the callback either succeed or fail together.
   *
   * @example
   * ```typescript
   * await adapter.transaction(async (txn) => {
   *   const counter = await txn.get('counter:1')
   *   await txn.put('counter:1', { value: counter.value + 1 })
   * })
   * ```
   */
  async transaction<R>(callback: (txn: DurableObjectTransaction) => Promise<R>): Promise<R> {
    return this.storage.transaction(callback)
  }

  /**
   * Atomic increment for counters
   *
   * Safely increments a numeric field without race conditions.
   *
   * @param id Record ID
   * @param field Field name to increment (camelCase)
   * @param amount Amount to increment by (default: 1)
   * @returns New value after increment
   *
   * @example
   * ```typescript
   * const newValue = await adapter.increment('page_views', 'count', 1)
   * console.log(`New count: ${newValue}`)
   * ```
   */
  async increment(id: string, field: keyof InferSchema<T>, amount: number = 1): Promise<number> {
    return this.storage.transaction(async (txn) => {
      const current = (await txn.get(this.getKey(id))) as Record<string, unknown> | undefined
      const snakeField = field.toString().replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
      const currentValue = (current?.[snakeField] as number) || 0
      const newValue = currentValue + amount

      await txn.put(this.getKey(id), { ...current, [snakeField]: newValue })
      return newValue
    })
  }
}
