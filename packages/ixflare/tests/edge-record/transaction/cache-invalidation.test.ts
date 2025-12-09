/**
 * @module tests/edge-record/transaction/cache-invalidation.test
 * @description Tests for cache invalidation in transactions (AC6)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { transaction } from '@/edge-record/transaction'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from '../crud/mock-d1'

describe('Transaction Cache Invalidation', () => {
  const Account = defineModel(
    'accounts',
    {
      id: field.id(),
      userId: field.integer(),
      balance: field.decimal({ precision: 10, scale: 2 }),
      ...timestamps(),
    },
    {
      cache: {
        enabled: true,
        ttl: 3600,
        kv: {
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
          getWithMetadata: vi.fn(),
        } as unknown as KVNamespace,
      },
    }
  )

  let db: D1Database
  let mockKV: KVNamespace

  beforeEach(() => {
    db = createMockD1Database()
    mockKV = Account.$cacheConfig?.kv as KVNamespace
    vi.clearAllMocks()
  })

  describe('AC6: Cache Invalidation After Transaction Commit', () => {
    it('should invalidate cache after successful transaction commit', async () => {
      await transaction(db, async (tx) => {
        await tx.update(Account, 1, {
          balance: 1500,
        })
      })

      // Cache should be invalidated AFTER commit
      expect(mockKV.delete).toHaveBeenCalledWith('accounts:1')
    })

    it('should invalidate cache for multiple modified records', async () => {
      await transaction(db, async (tx) => {
        await tx.update(Account, 1, { balance: 1000 })
        await tx.update(Account, 2, { balance: 2000 })
        await tx.update(Account, 3, { balance: 3000 })
      })

      expect(mockKV.delete).toHaveBeenCalledTimes(3)
      expect(mockKV.delete).toHaveBeenCalledWith('accounts:1')
      expect(mockKV.delete).toHaveBeenCalledWith('accounts:2')
      expect(mockKV.delete).toHaveBeenCalledWith('accounts:3')
    })

    it('should NOT invalidate cache on transaction rollback', async () => {
      try {
        await transaction(db, async (tx) => {
          await tx.update(Account, 1, { balance: 1500 })

          throw new Error('Transaction failed')
        })
      } catch (error) {
        // Expected error
      }

      // Cache should NOT be invalidated on rollback
      expect(mockKV.delete).not.toHaveBeenCalled()
    })

    it('should invalidate cache for created records', async () => {
      await transaction(db, async (tx) => {
        await tx.create(Account, {
          userId: 1,
          balance: 1000,
        })
      })

      // Cache invalidation happens with the assigned ID
      expect(mockKV.delete).toHaveBeenCalledWith('accounts:1')
    })

    it('should invalidate cache for deleted records', async () => {
      await transaction(db, async (tx) => {
        await tx.delete(Account, 5)
      })

      expect(mockKV.delete).toHaveBeenCalledWith('accounts:5')
    })

    it('should handle cache invalidation for mixed operations', async () => {
      await transaction(db, async (tx) => {
        await tx.create(Account, { userId: 1, balance: 1000 })
        await tx.update(Account, 2, { balance: 2000 })
        await tx.delete(Account, 3)
      })

      expect(mockKV.delete).toHaveBeenCalledTimes(3)
    })
  })

  describe('Models Without Caching', () => {
    it('should handle models without cache configuration', async () => {
      const NoCacheModel = defineModel('no_cache', {
        id: field.id(),
        value: field.string(),
        ...timestamps(),
      })

      // Should not throw error
      await transaction(db, async (tx) => {
        await tx.create(NoCacheModel, { value: 'test' })
      })

      expect(true).toBe(true)
    })

    it('should handle models with caching disabled', async () => {
      const DisabledCacheModel = defineModel(
        'disabled_cache',
        {
          id: field.id(),
          value: field.string(),
          ...timestamps(),
        },
        {
          cache: {
            enabled: false,
            kv: mockKV,
          },
        }
      )

      await transaction(db, async (tx) => {
        await tx.create(DisabledCacheModel, { value: 'test' })
      })

      // Should not attempt cache invalidation
      expect(mockKV.delete).not.toHaveBeenCalled()
    })
  })

  describe('Cache Invalidation Timing', () => {
    it('should invalidate cache AFTER commit, not during transaction', async () => {
      const deleteCalls: number[] = []

      // Track when delete is called
      ;(mockKV.delete as any).mockImplementation(() => {
        deleteCalls.push(Date.now())
        return Promise.resolve()
      })

      const commitTime = await transaction(db, async (tx) => {
        await tx.update(Account, 1, { balance: 1500 })
        return Date.now()
      })

      // Cache delete should be called after commit time
      expect(deleteCalls.length).toBe(1)
      expect(deleteCalls[0]).toBeGreaterThanOrEqual(commitTime)
    })
  })
})
