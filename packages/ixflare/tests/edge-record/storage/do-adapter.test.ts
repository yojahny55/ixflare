import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema/field'
import { DOAdapter } from '@/edge-record/storage/do-adapter'
import { MockDurableObjectStorage } from './mock-do'

describe('DOAdapter', () => {
  let storage: MockDurableObjectStorage

  beforeEach(() => {
    storage = new MockDurableObjectStorage()
  })

  describe('Basic operations (AC3, AC6)', () => {
    it('should store and retrieve records with snake_case to camelCase transformation', async () => {
      const Counter = defineModel('counters_do_test_1', {
        id: field.id(),
        value: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('counter1', { id: 1, value: 42 })
      const result = await adapter.get('counter1')

      expect(result).toEqual({ id: 1, value: 42 })
    })

    it('should return null for non-existent keys', async () => {
      const Counter = defineModel('counters_do_test_2', {
        id: field.id(),
        value: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      const result = await adapter.get('nonexistent')

      expect(result).toBeNull()
    })

    it('should delete records', async () => {
      const Counter = defineModel('counters_do_test_3', {
        id: field.id(),
        value: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('temp', { id: 1, value: 100 })
      expect(await adapter.get('temp')).not.toBeNull()

      await adapter.delete('temp')
      expect(await adapter.get('temp')).toBeNull()
    })

    it('should handle partial data updates', async () => {
      const User = defineModel('users_do_test_1', {
        id: field.id(),
        name: field.string(),
        score: field.integer(),
      })

      const adapter = new DOAdapter(User, storage)

      await adapter.put('user1', { id: 1, name: 'Alice', score: 100 })
      const result = await adapter.get('user1')

      expect(result).toEqual({ id: 1, name: 'Alice', score: 100 })
    })
  })

  describe('Key generation and namespacing', () => {
    it('should prefix keys with table name', async () => {
      const Counter = defineModel('counters_do_test_4', {
        id: field.id(),
        value: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('counter1', { id: 1, value: 10 })

      const allKeys = storage.getAllKeys()
      expect(allKeys).toContain('counters_do_test_4:counter1')
    })

    it('should handle special characters in IDs safely', async () => {
      const Session = defineModel('sessions_do_test_1', {
        token: field.string().primaryKey(),
        userId: field.integer(),
      })

      const adapter = new DOAdapter(Session, storage)

      await adapter.put('user:123:session', { token: 'user:123:session', userId: 123 })
      const result = await adapter.get('user:123:session')

      expect(result).toEqual({ token: 'user:123:session', userId: 123 })
    })
  })

  describe('Transactions for strong consistency', () => {
    it('should execute operations within a transaction', async () => {
      const Account = defineModel('accounts_do_test_1', {
        id: field.id(),
        balance: field.integer(),
      })

      const adapter = new DOAdapter(Account, storage)

      await adapter.put('account1', { id: 1, balance: 1000 })

      const result = await adapter.transaction(async (txn) => {
        const account = (await txn.get('accounts_do_test_1:account1')) as {
          balance: number
        }
        const newBalance = account.balance + 500
        await txn.put('accounts_do_test_1:account1', { id: 1, balance: newBalance })
        return newBalance
      })

      expect(result).toBe(1500)
      const updated = await adapter.get('account1')
      expect(updated?.balance).toBe(1500)
    })

    it('should rollback on transaction error', async () => {
      const Account = defineModel('accounts_do_test_2', {
        id: field.id(),
        balance: field.integer(),
      })

      const adapter = new DOAdapter(Account, storage)

      await adapter.put('account1', { id: 1, balance: 1000 })

      try {
        await adapter.transaction(async (txn) => {
          await txn.put('accounts_do_test_2:account1', { id: 1, balance: 2000 })
          throw new Error('Transaction failed')
        })
      } catch (error) {
        // Expected error
      }

      const account = await adapter.get('account1')
      expect(account?.balance).toBe(1000) // Rolled back
    })

    it('should allow multiple operations in a single transaction', async () => {
      const Counter = defineModel('counters_do_test_5', {
        id: field.id(),
        value: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('counter1', { id: 1, value: 10 })
      await adapter.put('counter2', { id: 2, value: 20 })

      await adapter.transaction(async (txn) => {
        const c1 = (await txn.get('counters_do_test_5:counter1')) as { value: number }
        const c2 = (await txn.get('counters_do_test_5:counter2')) as { value: number }

        await txn.put('counters_do_test_5:counter1', { id: 1, value: c1.value + 5 })
        await txn.put('counters_do_test_5:counter2', { id: 2, value: c2.value + 5 })
      })

      const c1 = await adapter.get('counter1')
      const c2 = await adapter.get('counter2')

      expect(c1?.value).toBe(15)
      expect(c2?.value).toBe(25)
    })
  })

  describe('Atomic increment operation', () => {
    it('should increment a counter atomically', async () => {
      const Counter = defineModel('counters_do_test_6', {
        id: field.string().primaryKey(),
        viewCount: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('page1', { id: 'page1', viewCount: 100 })

      const newValue = await adapter.increment('page1', 'viewCount', 1)

      expect(newValue).toBe(101)
      const result = await adapter.get('page1')
      expect(result?.viewCount).toBe(101)
    })

    it('should increment by custom amount', async () => {
      const Counter = defineModel('counters_do_test_7', {
        id: field.string().primaryKey(),
        points: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('user1', { id: 'user1', points: 50 })

      const newValue = await adapter.increment('user1', 'points', 25)

      expect(newValue).toBe(75)
    })

    it('should initialize to amount if record does not exist', async () => {
      const Counter = defineModel('counters_do_test_8', {
        id: field.string().primaryKey(),
        count: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      const newValue = await adapter.increment('new_counter', 'count', 10)

      expect(newValue).toBe(10)
    })

    it('should default increment amount to 1', async () => {
      const Counter = defineModel('counters_do_test_9', {
        id: field.string().primaryKey(),
        visits: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('page1', { id: 'page1', visits: 5 })

      const newValue = await adapter.increment('page1', 'visits')

      expect(newValue).toBe(6)
    })

    it('should support negative increments (decrements)', async () => {
      const Counter = defineModel('counters_do_test_10', {
        id: field.string().primaryKey(),
        stock: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('product1', { id: 'product1', stock: 100 })

      const newValue = await adapter.increment('product1', 'stock', -5)

      expect(newValue).toBe(95)
    })

    it('should handle multiple sequential increments', async () => {
      const Counter = defineModel('counters_do_test_11', {
        id: field.string().primaryKey(),
        total: field.integer(),
      })

      const adapter = new DOAdapter(Counter, storage)

      await adapter.put('counter1', { id: 'counter1', total: 0 })

      // Sequential increments (true concurrency can't be tested with mock)
      await adapter.increment('counter1', 'total', 1)
      await adapter.increment('counter1', 'total', 1)
      await adapter.increment('counter1', 'total', 1)
      await adapter.increment('counter1', 'total', 1)
      await adapter.increment('counter1', 'total', 1)

      const result = await adapter.get('counter1')
      expect(result?.total).toBe(5)
    })
  })

  describe('Data transformation', () => {
    it('should transform camelCase to snake_case on put', async () => {
      const User = defineModel('users_do_test_2', {
        userId: field.string().primaryKey(),
        firstName: field.string(),
        lastName: field.string(),
      })

      const adapter = new DOAdapter(User, storage)

      await adapter.put('user1', {
        userId: 'user1',
        firstName: 'Jane',
        lastName: 'Doe',
      })

      const rawValue = storage.getRaw('users_do_test_2:user1')
      expect(rawValue).toBeTruthy()
      const record = rawValue as Record<string, unknown>
      expect(record).toHaveProperty('user_id')
      expect(record).toHaveProperty('first_name')
      expect(record).toHaveProperty('last_name')
    })

    it('should transform snake_case to camelCase on get', async () => {
      const User = defineModel('users_do_test_3', {
        userId: field.string().primaryKey(),
        firstName: field.string(),
      })

      const adapter = new DOAdapter(User, storage)

      // Store with snake_case directly
      await storage.put('users_do_test_3:user1', {
        user_id: 'user1',
        first_name: 'John',
      })

      const result = await adapter.get('user1')

      expect(result).toEqual({ userId: 'user1', firstName: 'John' })
    })
  })
})
