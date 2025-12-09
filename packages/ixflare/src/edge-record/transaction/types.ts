/**
 * @module edge-record/transaction/types
 * @description Type definitions for transaction operations
 */

import type { SchemaDefinition, Model } from '@/edge-record/schema/types'
import type { CreateInput, UpdateInput } from '@/edge-record/crud/crud-operations'
import type { ModelInstance } from '@/edge-record/crud/model-instance'

/**
 * Isolation levels for transactions
 * D1/SQLite supports: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE
 * Default is DEFERRED (similar to READ COMMITTED)
 */
export type IsolationLevel =
  | 'READ_UNCOMMITTED'
  | 'READ_COMMITTED'
  | 'REPEATABLE_READ'
  | 'SERIALIZABLE'
  | 'DEFERRED' // SQLite default

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  /**
   * Transaction timeout in milliseconds
   * @default 5000
   * @maximum 30000 (D1 batch limit)
   */
  timeout?: number

  /**
   * Parent transaction context for nested transactions (savepoints)
   * When provided, creates a savepoint instead of a new transaction
   */
  parent?: TransactionContext

  /**
   * Transaction isolation level
   * @default 'DEFERRED'
   */
  isolation?: IsolationLevel
}

/**
 * Update operators for atomic increment/decrement
 */
export interface UpdateOperators {
  /**
   * Atomically increment a numeric field
   * @example { balance: { increment: 100 } }
   */
  increment?: number

  /**
   * Atomically decrement a numeric field
   * @example { balance: { decrement: 50 } }
   */
  decrement?: number
}

/**
 * Enhanced update input that supports operators
 */
export type TransactionUpdateInput<T extends SchemaDefinition> = {
  [K in keyof UpdateInput<T>]: UpdateInput<T>[K] | UpdateOperators
}

/**
 * Transaction context providing typed CRUD methods
 * All operations are buffered and executed via db.batch() on commit
 */
export interface TransactionContext {
  /**
   * Create a new record in the transaction
   * @returns Promise<ModelInstance<T>> (ID assigned after batch execution)
   */
  create<T extends SchemaDefinition>(
    model: Model<T>,
    data: CreateInput<T>
  ): Promise<ModelInstance<T>>

  /**
   * Update a record by ID in the transaction
   * Supports increment/decrement operators for atomic updates
   */
  update<T extends SchemaDefinition>(
    model: Model<T>,
    id: string | number,
    data: TransactionUpdateInput<T>
  ): Promise<void>

  /**
   * Delete a record by ID in the transaction
   */
  delete<T extends SchemaDefinition>(model: Model<T>, id: string | number): Promise<void>

  /**
   * Internal: Get the current savepoint depth (for nested transactions)
   * @internal
   */
  readonly _savepointDepth: number

  /**
   * Internal: Get parent transaction context (for nested transactions)
   * @internal
   */
  readonly _parent?: TransactionContext
}

/**
 * Metadata about a modified record for cache invalidation
 */
export interface ModifiedRecord {
  model: Model<SchemaDefinition>
  id: string | number
  operation: 'create' | 'update' | 'delete'
}
