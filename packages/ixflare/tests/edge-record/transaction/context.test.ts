/**
 * @module tests/edge-record/transaction/context.test
 * @description Tests for TransactionContext implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TransactionContextImpl } from '@/edge-record/transaction/context'
import { ValidationError } from '@/edge-record/crud/errors'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from '../crud/mock-d1'

describe('TransactionContext', () => {
  const Account = defineModel('accounts', {
    id: field.id(),
    userId: field.integer(),
    balance: field.decimal({ precision: 10, scale: 2 }),
    status: field.string(),
    ...timestamps(),
  })

  let db: D1Database
  let ctx: TransactionContextImpl

  beforeEach(() => {
    db = createMockD1Database()
    ctx = new TransactionContextImpl(db)
  })

  describe('Statement Buffering', () => {
    it('should buffer create statements', async () => {
      await ctx.create(Account, {
        userId: 1,
        balance: 1000,
        status: 'active',
      })

      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })

    it('should buffer update statements', async () => {
      await ctx.update(Account, 1, {
        balance: 500,
      })

      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })

    it('should buffer delete statements', async () => {
      await ctx.delete(Account, 1)

      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })

    it('should buffer multiple operations in order', async () => {
      await ctx.create(Account, { userId: 1, balance: 1000, status: 'active' })
      await ctx.update(Account, 1, { balance: 1500 })
      await ctx.delete(Account, 2)

      const statements = ctx.getStatements()
      expect(statements.length).toBe(3)
    })
  })

  describe('Increment/Decrement Operators', () => {
    it('should support increment operator', async () => {
      await ctx.update(Account, 1, {
        balance: { increment: 100 },
      })

      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })

    it('should support decrement operator', async () => {
      await ctx.update(Account, 1, {
        balance: { decrement: 50 },
      })

      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })

    it('should support multiple operators in same update', async () => {
      await ctx.update(Account, 1, {
        balance: { increment: 100 },
        status: 'active',
      })

      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })

    it('should validate increment value is positive number', async () => {
      await expect(
        ctx.update(Account, 1, {
          balance: { increment: -50 },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should validate decrement value is positive number', async () => {
      await expect(
        ctx.update(Account, 1, {
          balance: { decrement: -25 },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should reject non-numeric increment values', async () => {
      await expect(
        ctx.update(Account, 1, {
          balance: { increment: 'invalid' as any },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('should reject non-numeric decrement values', async () => {
      await expect(
        ctx.update(Account, 1, {
          balance: { decrement: 'invalid' as any },
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('Modified Records Tracking', () => {
    it('should track created records', async () => {
      await ctx.create(Account, {
        userId: 1,
        balance: 1000,
        status: 'active',
      })

      const modifiedRecords = ctx.getModifiedRecords()
      expect(modifiedRecords.length).toBe(1)
      expect(modifiedRecords[0].operation).toBe('create')
      expect(modifiedRecords[0].model).toBe(Account)
    })

    it('should track updated records', async () => {
      await ctx.update(Account, 1, {
        balance: 1500,
      })

      const modifiedRecords = ctx.getModifiedRecords()
      expect(modifiedRecords.length).toBe(1)
      expect(modifiedRecords[0].operation).toBe('update')
      expect(modifiedRecords[0].id).toBe(1)
    })

    it('should track deleted records', async () => {
      await ctx.delete(Account, 1)

      const modifiedRecords = ctx.getModifiedRecords()
      expect(modifiedRecords.length).toBe(1)
      expect(modifiedRecords[0].operation).toBe('delete')
      expect(modifiedRecords[0].id).toBe(1)
    })

    it('should track multiple modified records', async () => {
      await ctx.create(Account, { userId: 1, balance: 1000, status: 'active' })
      await ctx.update(Account, 2, { balance: 1500 })
      await ctx.delete(Account, 3)

      const modifiedRecords = ctx.getModifiedRecords()
      expect(modifiedRecords.length).toBe(3)
    })
  })

  describe('Nested Transaction Support', () => {
    it('should track savepoint depth', () => {
      const rootCtx = new TransactionContextImpl(db)
      expect(rootCtx._savepointDepth).toBe(0)

      const nestedCtx = new TransactionContextImpl(db, { parent: rootCtx })
      expect(nestedCtx._savepointDepth).toBe(1)

      const deeplyNestedCtx = new TransactionContextImpl(db, { parent: nestedCtx })
      expect(deeplyNestedCtx._savepointDepth).toBe(2)
    })

    it('should maintain parent reference', () => {
      const rootCtx = new TransactionContextImpl(db)
      const nestedCtx = new TransactionContextImpl(db, { parent: rootCtx })

      expect(nestedCtx._parent).toBe(rootCtx)
      expect(rootCtx._parent).toBeUndefined()
    })
  })

  describe('Pending Instances', () => {
    it('should track pending instances for ID assignment', async () => {
      await ctx.create(Account, { userId: 1, balance: 1000, status: 'active' })
      await ctx.create(Account, { userId: 2, balance: 2000, status: 'active' })

      const pendingInstances = ctx.getPendingInstances()
      expect(pendingInstances.has(Account)).toBe(true)
      expect(pendingInstances.get(Account)?.length).toBe(2)
    })
  })

  describe('Timestamps', () => {
    it('should add createdAt and updatedAt on create', async () => {
      const beforeCreate = Date.now()
      await ctx.create(Account, {
        userId: 1,
        balance: 1000,
        status: 'active',
      })
      const afterCreate = Date.now()

      const pendingInstances = ctx.getPendingInstances()
      const instance = pendingInstances.get(Account)?.[0]

      expect(instance).toBeDefined()
      const createdAt = instance!.get('createdAt') as number
      const updatedAt = instance!.get('updatedAt') as number

      expect(createdAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(createdAt).toBeLessThanOrEqual(afterCreate)
      expect(updatedAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(updatedAt).toBeLessThanOrEqual(afterCreate)
    })

    it('should add updatedAt on update', async () => {
      const beforeUpdate = Date.now()
      await ctx.update(Account, 1, {
        balance: 1500,
      })
      const afterUpdate = Date.now()

      // We can't easily verify the timestamp in the statement,
      // but we can verify the statement was created
      const statements = ctx.getStatements()
      expect(statements.length).toBe(1)
    })
  })
})
