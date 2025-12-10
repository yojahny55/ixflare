/**
 * @module edge-record/consistency/strong-adapter
 * @description Strong consistency adapter using Durable Objects
 */

import type { Model, SchemaDefinition, InferSchema } from '@/edge-record/schema/types'
import { DOAdapter } from '@/edge-record/storage/do-adapter'

/**
 * Strong Consistency Adapter
 *
 * Wraps Durable Objects storage to provide strong consistency guarantees.
 * All operations are serialized through a single DO instance per record.
 *
 * Use cases:
 * - Counters and rate limiters
 * - Inventory management
 * - Real-time coordination
 * - Session state requiring strong consistency
 *
 * Features:
 * - Strong consistency (single source of truth)
 * - Transactional operations
 * - Atomic increment/decrement
 * - ~50-100ms typical latency
 *
 * @example
 * ```typescript
 * export const Inventory = defineModel('inventory', {
 *   productId: field.integer().primaryKey(),
 *   quantity: field.integer(),
 * }, {
 *   consistency: 'strong',  // Routes to this adapter
 * })
 *
 * // Atomic operations
 * await Inventory.decrement(productId, 'quantity', 1)
 * ```
 */
export class StrongConsistencyAdapter<T extends SchemaDefinition> {
  private doAdapter: DOAdapter<T>

  constructor(
    private model: Model<T>,
    private storage: DurableObjectStorage
  ) {
    this.doAdapter = new DOAdapter(model, storage)
  }

  /**
   * Get a record by ID with strong consistency
   */
  async get(id: string): Promise<InferSchema<T> | null> {
    return this.doAdapter.get(id)
  }

  /**
   * Store a record with strong consistency
   */
  async put(id: string, data: Partial<InferSchema<T>>): Promise<void> {
    return this.doAdapter.put(id, data)
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<void> {
    return this.doAdapter.delete(id)
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
   *   const inventory = await txn.get('inventory:123')
   *   if (inventory.quantity >= requestedQty) {
   *     await txn.put('inventory:123', {
   *       quantity: inventory.quantity - requestedQty
   *     })
   *   }
   * })
   * ```
   */
  async transaction<R>(callback: (txn: DurableObjectTransaction) => Promise<R>): Promise<R> {
    return this.doAdapter.transaction(callback)
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
   * const newQty = await adapter.increment('inventory:123', 'quantity', 5)
   * console.log(`New quantity: ${newQty}`)
   * ```
   */
  async increment(id: string, field: keyof InferSchema<T>, amount: number = 1): Promise<number> {
    return this.doAdapter.increment(id, field, amount)
  }

  /**
   * Atomic decrement for counters
   *
   * Safely decrements a numeric field without race conditions.
   *
   * @param id Record ID
   * @param field Field name to decrement (camelCase)
   * @param amount Amount to decrement by (default: 1)
   * @returns New value after decrement
   *
   * @example
   * ```typescript
   * const newQty = await adapter.decrement('inventory:123', 'quantity', 1)
   * console.log(`New quantity: ${newQty}`)
   * ```
   */
  async decrement(id: string, field: keyof InferSchema<T>, amount: number = 1): Promise<number> {
    return this.increment(id, field, -amount)
  }
}
