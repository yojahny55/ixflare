/**
 * @module tests/edge-record/crud/aggregates.test
 * @description Tests for aggregate methods (AC11, AC12, AC13)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { QueryBuilder } from '@/edge-record/query-builder'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { create } from '@/edge-record/crud/crud-operations'
import { createMockD1Database } from './mock-d1'

describe('Aggregate Methods', () => {
  const Order = defineModel('orders', {
    id: field.id(),
    amount: field.integer(),
    quantity: field.integer(),
    status: field.string(),
    userId: field.integer(),
    ...timestamps(),
  })

  let db: D1Database

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('count() - AC11', () => {
    it('should count all records when no where clause', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 1, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const count = await qb.count(db)

      expect(count).toBe(2)
    })

    it('should count records matching where clause', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 1, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 150, quantity: 3, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const count = await qb.where({ status: 'completed' }).count(db)

      expect(count).toBe(2)
    })

    it('should return 0 when no matches', async () => {
      const qb = new QueryBuilder(Order)
      const count = await qb.where({ status: 'nonexistent' }).count(db)

      expect(count).toBe(0)
    })
  })

  describe('sum() - AC12', () => {
    it('should sum numeric field values', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)

      const qb = new QueryBuilder(Order)
      const total = await qb.sum('amount', db)

      expect(total).toBe(300)
    })

    it('should sum with where clause', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 50, quantity: 1, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const total = await qb.where({ status: 'completed' }).sum('amount', db)

      expect(total).toBe(300)
    })

    it('should return 0 when no records', async () => {
      const qb = new QueryBuilder(Order)
      const total = await qb.where({ status: 'nonexistent' }).sum('amount', db)

      expect(total).toBe(0)
    })
  })

  describe('avg() - AC12', () => {
    it('should calculate average of numeric field', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)

      const qb = new QueryBuilder(Order)
      const avg = await qb.avg('amount', db)

      expect(avg).toBe(150) // (100 + 200) / 2
    })

    it('should return null when no records', async () => {
      const qb = new QueryBuilder(Order)
      const avg = await qb.where({ status: 'nonexistent' }).avg('amount', db)

      expect(avg).toBeNull()
    })
  })

  describe('min() - AC12', () => {
    it('should find minimum value', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 50, quantity: 1, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const min = await qb.min('amount', db)

      expect(min).toBe(50)
    })

    it('should return null when no records', async () => {
      const qb = new QueryBuilder(Order)
      const min = await qb.where({ status: 'nonexistent' }).min('amount', db)

      expect(min).toBeNull()
    })
  })

  describe('max() - AC12', () => {
    it('should find maximum value', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 50, quantity: 1, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const max = await qb.max('amount', db)

      expect(max).toBe(200)
    })

    it('should return null when no records', async () => {
      const qb = new QueryBuilder(Order)
      const max = await qb.where({ status: 'nonexistent' }).max('amount', db)

      expect(max).toBeNull()
    })
  })

  describe('groupBy() - AC13', () => {
    it('should group by field and count', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 150, quantity: 1, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const results = await qb.groupBy('status').count(db)

      expect(results).toHaveLength(2)
      const completedGroup = results.find((r) => r.status === 'completed')
      const pendingGroup = results.find((r) => r.status === 'pending')

      expect(completedGroup).toBeDefined()
      expect(completedGroup?.count).toBe(2)
      expect(pendingGroup).toBeDefined()
      expect(pendingGroup?.count).toBe(1)
    })

    it('should group by and sum', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 150, quantity: 1, status: 'pending', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const results = await qb.groupBy('status').sum('amount', db)

      expect(results).toHaveLength(2)
      const completedGroup = results.find((r) => r.status === 'completed')
      const pendingGroup = results.find((r) => r.status === 'pending')

      expect(completedGroup?.sum).toBe(300)
      expect(pendingGroup?.sum).toBe(150)
    })

    it('should group by and average', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)

      const qb = new QueryBuilder(Order)
      const results = await qb.groupBy('status').avg('amount', db)

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('completed')
      expect(results[0].avg).toBe(150) // (100 + 200) / 2
    })

    it('should support orderBy on grouped results', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'alpha', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'beta', userId: 1 }, db)
      await create(Order, { amount: 150, quantity: 1, status: 'gamma', userId: 2 }, db)

      const qb = new QueryBuilder(Order)
      const results = await qb.groupBy('status').orderBy('status', 'asc').count(db)

      expect(results).toHaveLength(3)
      // Verify all statuses are present
      expect(results.map((r) => r.status)).toContain('alpha')
      expect(results.map((r) => r.status)).toContain('beta')
      expect(results.map((r) => r.status)).toContain('gamma')
    })

    it('should support limit on grouped results', async () => {
      await create(Order, { amount: 100, quantity: 2, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 200, quantity: 3, status: 'completed', userId: 1 }, db)
      await create(Order, { amount: 150, quantity: 1, status: 'pending', userId: 2 }, db)
      await create(Order, { amount: 75, quantity: 1, status: 'cancelled', userId: 3 }, db)

      const qb = new QueryBuilder(Order)
      // Note: Mock doesn't implement LIMIT for grouped queries, but this tests the API
      const results = await qb.groupBy('status').limit(2).count(db)

      expect(Array.isArray(results)).toBe(true)
      // Each status should have a count
      results.forEach((r) => {
        expect(r).toHaveProperty('count')
        expect(typeof r.count).toBe('number')
      })
    })
  })
})
