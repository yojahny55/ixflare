/**
 * @module edge-record/transaction/transaction
 * @description Main transaction function using D1 batch API
 */

import type { TransactionContext, TransactionOptions } from './types'
import { TransactionContextImpl } from './context'
import {
  TransactionError,
  TransactionTimeoutError,
  TransactionRollbackError,
} from '@/edge-record/crud/errors'
import {
  generateSavepointName,
  createSavepointSQL,
  releaseSavepointSQL,
  rollbackToSavepointSQL,
} from './savepoint'
import { isD1Database } from '@/edge-record/storage/types'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import type { SchemaDefinition } from '@/edge-record/schema/types'

/**
 * Default transaction timeout (5 seconds)
 */
const DEFAULT_TIMEOUT_MS = 5000

/**
 * Maximum transaction timeout (30 seconds, D1 batch limit)
 */
const MAX_TIMEOUT_MS = 30000

/**
 * Execute multiple operations in a transaction with automatic rollback
 *
 * Uses D1's batch() API for atomic execution - if any statement fails, all are rolled back.
 * Operations are buffered during the callback and executed atomically on commit.
 *
 * @template T The return type of the transaction callback
 * @param db The D1Database instance
 * @param callback The transaction callback that receives a TransactionContext
 * @param options Transaction options (timeout, parent, isolation)
 * @returns Promise<T> The result of the transaction callback
 *
 * @throws {TransactionError} If db is not a D1Database (code: INVALID_STORAGE)
 * @throws {TransactionTimeoutError} If transaction exceeds timeout (default: 5s, max: 30s)
 * @throws {TransactionRollbackError} If D1 batch execution fails
 * @throws {Error} If callback throws an error (transaction is automatically rolled back)
 *
 * @example
 * ```typescript
 * import { transaction } from 'ixflare/orm'
 *
 * // Simple transaction with return value
 * const transfer = await transaction(env.DB, async (tx) => {
 *   await tx.update(Account, senderId, { balance: { decrement: amount } })
 *   await tx.update(Account, receiverId, { balance: { increment: amount } })
 *   return await tx.create(Transfer, { fromId: senderId, toId: receiverId, amount })
 * })
 * console.log(`Transfer ID: ${transfer.get('id')}`)
 *
 * // Transaction with timeout option
 * await transaction(env.DB, async (tx) => {
 *   await tx.create(Order, { userId, total })
 *   await tx.update(Product, productId, { inventory: { decrement: quantity } })
 * }, { timeout: 10000 }) // 10 second timeout
 *
 * // Automatic rollback on error
 * try {
 *   await transaction(env.DB, async (tx) => {
 *     await tx.create(Order, { userId, total })
 *     if (inventory < quantity) {
 *       throw new Error('Insufficient inventory') // Automatically rolls back
 *     }
 *     await tx.update(Product, productId, { inventory: { decrement: quantity } })
 *   })
 * } catch (error) {
 *   console.error('Order failed:', error.message)
 * }
 *
 * // Nested transaction with savepoint (error isolation)
 * await transaction(env.DB, async (tx) => {
 *   await tx.create(Order, orderData)
 *
 *   try {
 *     await transaction(env.DB, async (innerTx) => {
 *       await innerTx.create(OrderItem, item1)
 *       await innerTx.create(OrderItem, item2)
 *       throw new Error('Item validation failed')
 *     }, { parent: tx }) // Savepoint created for nested transaction
 *   } catch (error) {
 *     // Nested operations rolled back via savepoint, parent continues
 *     console.warn('Items failed, order created without items')
 *   }
 * })
 * ```
 */
export async function transaction<T>(
  db: D1Database,
  callback: (tx: TransactionContext) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  // Validate D1 database type - transactions only work with D1
  if (!isD1Database(db)) {
    throw new TransactionError(
      'INVALID_STORAGE',
      'Transactions are only supported for D1 storage tier. KV and Durable Objects have different consistency models.'
    )
  }

  // Validate and set timeout
  const timeoutMs = Math.min(options?.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const startTime = Date.now()

  // Create transaction context
  const ctx = new TransactionContextImpl(db, { parent: options?.parent })
  const isNested = !!options?.parent

  // Handle nested transactions with savepoints
  let savepointName: string | undefined

  if (isNested) {
    // Generate savepoint for nested transaction
    savepointName = generateSavepointName(ctx._savepointDepth)

    // Add SAVEPOINT statement to parent's statement buffer
    const parentCtx = options!.parent as TransactionContextImpl
    const savepointStmt = db.prepare(createSavepointSQL(savepointName))
    parentCtx.addStatement(savepointStmt)
  }

  // Create timeout timer with cleanup capability
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    // Race transaction callback against timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime
        const operationCount = ctx.getStatements().length
        reject(new TransactionTimeoutError(timeoutMs, elapsed, operationCount))
      }, timeoutMs)
    })

    // Execute callback
    const result = await Promise.race([callback(ctx), timeoutPromise])

    // Clear timeout timer to prevent resource leak
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // On success
    if (isNested) {
      const parentCtx = options!.parent as TransactionContextImpl

      // Calculate offset for statement indices (nested statements will be added after parent's current statements)
      const statementIndexOffset = parentCtx.getStatements().length

      // CRITICAL: Merge nested transaction's statements into parent
      // This ensures nested operations are actually executed when root commits
      for (const stmt of ctx.getStatements()) {
        parentCtx.addStatement(stmt)
      }

      // Release savepoint (added AFTER nested statements so it comes last)
      const releaseStmt = db.prepare(releaseSavepointSQL(savepointName!))
      parentCtx.addStatement(releaseStmt)

      // Merge modified records into parent for cache invalidation
      for (const record of ctx.getModifiedRecords()) {
        parentCtx.getModifiedRecords().push(record)
      }

      // Merge pending creates with adjusted statement indices
      for (const pending of ctx.getPendingCreates()) {
        parentCtx.addPendingCreate(pending.instance, pending.statementIndex + statementIndexOffset)
      }

      // Merge pending instances into parent for legacy compatibility
      for (const [model, instances] of ctx.getPendingInstances()) {
        const parentInstances = parentCtx.getPendingInstances().get(model) || []
        parentCtx.getPendingInstances().set(model, [...parentInstances, ...instances])
      }
    } else {
      // Execute all statements via batch (root transaction)
      const statements = ctx.getStatements()

      if (statements.length > 0) {
        try {
          const results = await db.batch(statements)

          // Assign IDs to created instances using correct statement indices
          // This handles mixed operations (UPDATE, DELETE, CREATE) correctly
          const pendingCreates = ctx.getPendingCreates()

          for (const { instance, statementIndex } of pendingCreates) {
            const result = results[statementIndex]
            if (result && 'meta' in result && result.meta && 'last_row_id' in result.meta) {
              // Assign the ID from batch result using the type-safe setId method
              const id = result.meta.last_row_id
              ;(instance as ModelInstance<SchemaDefinition>).setId(id)

              // Update corresponding modified record with actual ID
              // Find by matching instance (modifiedRecords order matches statement order for creates)
              const modifiedRecord = ctx.getModifiedRecords().find(
                (r) => r.operation === 'create' && r.id === 0
              )
              if (modifiedRecord) {
                modifiedRecord.id = id
              }
            }
          }
        } catch (error) {
          // D1 batch automatically rolls back on error
          throw new TransactionRollbackError(
            `Transaction failed during batch execution: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined
          )
        }

        // Invalidate cache AFTER successful commit
        await invalidateCache(ctx.getModifiedRecords())
      }
    }

    return result
  } catch (error) {
    // Clear timeout timer to prevent resource leak
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // On error: rollback
    if (isNested) {
      // Rollback to savepoint for nested transaction
      const parentCtx = options!.parent as TransactionContextImpl
      const rollbackStmt = db.prepare(rollbackToSavepointSQL(savepointName!))
      parentCtx.addStatement(rollbackStmt)
    } else {
      // For root transaction, simply don't execute batch (automatic rollback)
      // Clear statements to ensure they're not executed
      ctx.getStatements().length = 0
    }

    // Re-throw the original error
    throw error
  }
}

/**
 * Invalidate cache for all modified records
 * Groups records by KV namespace to minimize network calls
 * @internal
 */
async function invalidateCache(
  modifiedRecords: Array<{ model: any; id: string | number }>
): Promise<void> {
  // Group records by KV namespace to batch invalidations
  const kvGroups = new Map<KVNamespace, string[]>()

  for (const { model, id } of modifiedRecords) {
    // Use $cacheConfig which is where defineModel stores cache options
    const cacheOptions = model.$cacheConfig

    if (cacheOptions?.kv && (cacheOptions.enabled ?? true)) {
      const kv = cacheOptions.kv

      if (!kvGroups.has(kv)) {
        kvGroups.set(kv, [])
      }

      const cacheKey = `${model.$tableName}:${id}`
      kvGroups.get(kv)!.push(cacheKey)
    }
  }

  // Invalidate all keys for each KV namespace
  for (const [kv, keys] of kvGroups) {
    await Promise.all(keys.map((key) => kv.delete(key)))
  }
}
