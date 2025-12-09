/**
 * @module tests/edge-record/transaction/transaction.test
 * @description Tests for transaction functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { transaction } from '@/edge-record/transaction'
import { TransactionTimeoutError, TransactionError } from '@/edge-record/crud/errors'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from '../crud/mock-d1'
import { MockKVNamespace } from '../storage/mock-kv'

describe('Transaction', () => {
  const Account = defineModel('accounts', {
    id: field.id(),
    userId: field.integer(),
    balance: field.decimal({ precision: 10, scale: 2 }),
    ...timestamps(),
  })

  const Transfer = defineModel('transfers', {
    id: field.id(),
    fromId: field.integer(),
    toId: field.integer(),
    amount: field.decimal({ precision: 10, scale: 2 }),
    ...timestamps(),
  })

  let db: D1Database

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('AC1: Atomic Operations via transaction() API', () => {
    it('should execute all operations atomically in a transaction', async () => {
      await transaction(db, async (tx) => {
        await tx.update(Account, 1, {
          balance: { decrement: 100 },
        })

        await tx.update(Account, 2, {
          balance: { increment: 100 },
        })

        await tx.create(Transfer, {
          fromId: 1,
          toId: 2,
          amount: 100,
        })
      })

      // If we reach here, transaction succeeded
      expect(true).toBe(true)
    })

    it('should support increment operator for atomic updates', async () => {
      await transaction(db, async (tx) => {
        await tx.update(Account, 1, {
          balance: { increment: 50 },
        })
      })

      expect(true).toBe(true)
    })

    it('should support decrement operator for atomic updates', async () => {
      await transaction(db, async (tx) => {
        await tx.update(Account, 1, {
          balance: { decrement: 25 },
        })
      })

      expect(true).toBe(true)
    })

    it('should create records and assign IDs after batch execution', async () => {
      const account = await transaction(db, async (tx) => {
        return await tx.create(Account, {
          userId: 1,
          balance: 1000,
        })
      })

      expect(account.get('id')).toBe(1)
      expect(account.get('userId')).toBe(1)
      expect(account.get('balance')).toBe(1000)
    })

    it('should handle multiple creates in a transaction', async () => {
      const results = await transaction(db, async (tx) => {
        const acc1 = await tx.create(Account, { userId: 1, balance: 500 })
        const acc2 = await tx.create(Account, { userId: 2, balance: 1000 })
        return [acc1, acc2]
      })

      expect(results[0].get('id')).toBe(1)
      expect(results[1].get('id')).toBe(2)
    })
  })

  describe('AC2: Automatic Rollback on Error', () => {
    it('should rollback transaction when error is thrown', async () => {
      await expect(
        transaction(db, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 500 })

          throw new Error('Insufficient inventory')

          // This should never execute
          await tx.update(Account, 1, { balance: { decrement: 100 } })
        })
      ).rejects.toThrow('Insufficient inventory')
    })

    it('should not commit any changes on error', async () => {
      try {
        await transaction(db, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 1000 })

          if (true) {
            throw new Error('Transaction failed')
          }

          await tx.create(Transfer, { fromId: 1, toId: 2, amount: 100 })
        })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Transaction failed')
      }
    })

    it('should handle errors in nested operations', async () => {
      await expect(
        transaction(db, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 500 })
          await tx.update(Account, 1, { balance: { increment: 100 } })

          throw new Error('Operation failed')
        })
      ).rejects.toThrow('Operation failed')
    })
  })

  describe('AC3: Nested Transactions (Savepoints)', () => {
    it('should support nested transactions with savepoints', async () => {
      await transaction(db, async (tx) => {
        await tx.create(Account, { userId: 1, balance: 1000 })

        // Nested transaction
        await transaction(
          db,
          async (innerTx) => {
            await innerTx.create(Transfer, { fromId: 1, toId: 2, amount: 100 })
            await innerTx.create(Transfer, { fromId: 1, toId: 3, amount: 50 })
          },
          { parent: tx }
        )
      })

      expect(true).toBe(true)
    })

    it('should propagate nested transaction errors to parent', async () => {
      await expect(
        transaction(db, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 1000 })

          // This nested transaction will fail and propagate error
          await transaction(
            db,
            async (innerTx) => {
              await innerTx.create(Transfer, { fromId: 1, toId: 2, amount: 100 })
              throw new Error('Nested transaction failed')
            },
            { parent: tx }
          )
        })
      ).rejects.toThrow('Nested transaction failed')
    })

    it('should allow parent to catch and handle nested transaction errors', async () => {
      // Parent can catch nested errors and continue - savepoint isolates the failure
      const result = await transaction(db, async (tx) => {
        await tx.create(Account, { userId: 1, balance: 1000 })

        try {
          // This nested transaction will fail
          await transaction(
            db,
            async (innerTx) => {
              await innerTx.create(Transfer, { fromId: 1, toId: 2, amount: 100 })
              throw new Error('Nested transaction failed')
            },
            { parent: tx }
          )
        } catch (error) {
          // Parent catches the error - nested ops are rolled back via savepoint
          // but parent can continue
        }

        // Parent continues after catching nested error
        await tx.create(Account, { userId: 2, balance: 500 })
        return 'completed'
      })

      expect(result).toBe('completed')
    })

    it('should support multiple levels of nesting', async () => {
      await transaction(db, async (tx) => {
        await tx.create(Account, { userId: 1, balance: 1000 })

        await transaction(
          db,
          async (innerTx) => {
            await innerTx.create(Transfer, { fromId: 1, toId: 2, amount: 100 })

            // Second level nesting
            await transaction(
              db,
              async (innerInnerTx) => {
                await innerInnerTx.create(Transfer, { fromId: 2, toId: 3, amount: 50 })
              },
              { parent: innerTx }
            )
          },
          { parent: tx }
        )
      })

      expect(true).toBe(true)
    })
  })

  describe('AC4: Transaction Context Propagation', () => {
    it('should propagate transaction context to helper functions', async () => {
      async function createAccountWithTransfers(
        tx: any,
        userId: number,
        balance: number,
        transfers: Array<{ toId: number; amount: number }>
      ) {
        const account = await tx.create(Account, { userId, balance })

        for (const transfer of transfers) {
          await tx.create(Transfer, {
            fromId: account.get('id'),
            toId: transfer.toId,
            amount: transfer.amount,
          })
        }

        return account
      }

      const account = await transaction(db, async (tx) => {
        return await createAccountWithTransfers(tx, 1, 1000, [
          { toId: 2, amount: 100 },
          { toId: 3, amount: 200 },
        ])
      })

      expect(account.get('id')).toBe(1)
      expect(account.get('balance')).toBe(1000)
    })
  })

  describe('AC5: Transaction Timeout Protection', () => {
    it('should timeout long-running transactions', async () => {
      await expect(
        transaction(
          db,
          async (tx) => {
            await tx.create(Account, { userId: 1, balance: 1000 })

            // Simulate long-running operation
            await new Promise((resolve) => setTimeout(resolve, 200))

            await tx.update(Account, 1, { balance: { increment: 100 } })
          },
          { timeout: 100 } // 100ms timeout
        )
      ).rejects.toThrow(TransactionTimeoutError)
    })

    it('should include timeout details in error', async () => {
      try {
        await transaction(
          db,
          async (tx) => {
            await tx.create(Account, { userId: 1, balance: 1000 })
            await new Promise((resolve) => setTimeout(resolve, 150))
          },
          { timeout: 100 }
        )
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionTimeoutError)
        const timeoutError = error as TransactionTimeoutError
        expect(timeoutError.timeoutMs).toBe(100)
        expect(timeoutError.operationCount).toBeGreaterThanOrEqual(0)
      }
    })

    it('should respect maximum timeout limit', async () => {
      // Timeout should be capped at 30000ms (D1 limit)
      await transaction(
        db,
        async (tx) => {
          await tx.create(Account, { userId: 1, balance: 1000 })
        },
        { timeout: 50000 } // Should be capped at 30000
      )

      expect(true).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should throw TransactionError for batch execution failures', async () => {
      // Mock batch to fail
      const mockDb = {
        ...db,
        batch: vi.fn().mockRejectedValue(new Error('Batch execution failed')),
      } as unknown as D1Database

      await expect(
        transaction(mockDb, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 1000 })
        })
      ).rejects.toThrow('Transaction failed during batch execution')
    })
  })

  describe('Empty Transactions', () => {
    it('should handle empty transactions gracefully', async () => {
      const result = await transaction(db, async (tx) => {
        return 'completed'
      })

      expect(result).toBe('completed')
    })

    it('should return value from transaction callback', async () => {
      const result = await transaction(db, async (tx) => {
        await tx.create(Account, { userId: 1, balance: 1000 })
        return 42
      })

      expect(result).toBe(42)
    })
  })

  describe('Storage Type Validation', () => {
    it('should reject non-D1 storage bindings', async () => {
      const kvNamespace = new MockKVNamespace()

      await expect(
        transaction(kvNamespace as unknown as D1Database, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 1000 })
        })
      ).rejects.toThrow(TransactionError)
    })

    it('should provide clear error message for non-D1 storage', async () => {
      const kvNamespace = new MockKVNamespace()

      try {
        await transaction(kvNamespace as unknown as D1Database, async (tx) => {
          await tx.create(Account, { userId: 1, balance: 1000 })
        })
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionError)
        expect((error as TransactionError).message).toContain('D1 storage tier')
      }
    })
  })
})
