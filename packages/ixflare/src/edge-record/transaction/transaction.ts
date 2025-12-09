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
import { CacheLayer } from '@/edge-record/storage/cache-layer'

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
 * @throws {TransactionTimeoutError} If transaction exceeds timeout
 * @throws {TransactionError} If transaction fails
 * @throws {Error} If callback throws an error (transaction is automatically rolled back)
 *
 * @example
 * ```typescript
 * // Simple transaction
 * await transaction(env.DB, async (tx) => {
 *   await tx.update(Account, senderId, { balance: { decrement: amount } })
 *   await tx.update(Account, receiverId, { balance: { increment: amount } })
 *   await tx.create(Transfer, { fromId: senderId, toId: receiverId, amount })
 * })
 *
 * // Nested transaction with savepoint
 * await transaction(env.DB, async (tx) => {
 *   await tx.create(Order, orderData)
 *   await transaction(env.DB, async (innerTx) => {
 *     await innerTx.create(OrderItem, item1)
 *     await innerTx.create(OrderItem, item2)
 *   }, { parent: tx })
 * })
 * ```
 */
export async function transaction<T>(
  db: D1Database,
  callback: (tx: TransactionContext) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
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

  try {
    // Race transaction callback against timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime
        const operationCount = ctx.getStatements().length
        reject(new TransactionTimeoutError(timeoutMs, elapsed, operationCount))
      }, timeoutMs)
    })

    // Execute callback
    const result = await Promise.race([callback(ctx), timeoutPromise])

    // On success
    if (isNested) {
      // Release savepoint for nested transaction
      const parentCtx = options!.parent as TransactionContextImpl
      const releaseStmt = db.prepare(releaseSavepointSQL(savepointName!))
      parentCtx.addStatement(releaseStmt)

      // Merge modified records into parent
      for (const record of ctx.getModifiedRecords()) {
        parentCtx.getModifiedRecords().push(record)
      }
    } else {
      // Execute all statements via batch (root transaction)
      const statements = ctx.getStatements()

      if (statements.length > 0) {
        try {
          const results = await db.batch(statements)

          // Assign IDs to created instances
          const pendingInstances = ctx.getPendingInstances()
          let createIndex = 0

          for (const [model, instances] of pendingInstances) {
            for (const instance of instances) {
              const result = results[createIndex]
              if (result && 'meta' in result && result.meta && 'last_row_id' in result.meta) {
                // Assign the ID from batch result
                const id = result.meta.last_row_id
                ;(instance as any).id = id

                // Update modified record with actual ID
                const modifiedRecord = ctx.getModifiedRecords()[createIndex]
                if (modifiedRecord) {
                  modifiedRecord.id = id
                }
              }
              createIndex++
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
 * @internal
 */
async function invalidateCache(modifiedRecords: Array<{ model: any; id: string | number }>): Promise<void> {
  for (const { model, id } of modifiedRecords) {
    // Check if model has caching enabled
    const cacheOptions = model.options?.cache

    if (cacheOptions && cacheOptions.kv) {
      const cacheLayer = new CacheLayer(cacheOptions.kv, {
        enabled: cacheOptions.enabled ?? true,
        ttl: cacheOptions.ttl,
      })

      const cacheKey = `${model.$tableName}:${id}`
      await cacheLayer.delete(cacheKey)
    }
  }
}
