/**
 * @module tests/edge-record/crud/query-builder.type-test
 * @description Type-level tests for QueryBuilder (AC14)
 *
 * These tests verify compile-time type safety. They use @ts-expect-error
 * to ensure invalid operations cause TypeScript errors.
 */

import { describe, it, expectTypeOf } from 'vitest'
import { QueryBuilder } from '@/edge-record/query-builder'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import type { ModelInstance } from '@/edge-record/crud/model-instance'

// Test model with various field types
const User = defineModel('users', {
  id: field.id(),
  email: field.string(),
  name: field.string(),
  age: field.integer(),
  role: field.string(),
  score: field.decimal({ precision: 10, scale: 2 }),
  isActive: field.boolean(),
  metadata: field.json<{ preferences: string[] }>(),
  ...timestamps(),
})

// Order model for numeric field tests
const Order = defineModel('orders', {
  id: field.id(),
  amount: field.integer(),
  quantity: field.integer(),
  status: field.string(),
  ...timestamps(),
})

describe('QueryBuilder Type Safety (AC14)', () => {
  describe('where() field name validation', () => {
    it('should accept valid field names', () => {
      const qb = new QueryBuilder(User)

      // These should all compile without error
      qb.where({ email: 'test@example.com' })
      qb.where({ name: 'John' })
      qb.where({ age: 25 })
      qb.where({ isActive: true })
      qb.where('email', 'test@example.com')
      qb.where('age', '>', 18)
    })

    it('should reject invalid field names in object notation', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - 'invalidField' does not exist on User schema
      qb.where({ invalidField: 'value' })
    })

    it('should reject invalid field names in two-arg notation', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - 'nonexistent' is not a valid field
      qb.where('nonexistent', 'value')
    })

    it('should reject invalid field names in three-arg notation', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - 'badField' is not a valid field
      qb.where('badField', '>', 100)
    })
  })

  describe('where() value type validation', () => {
    it('should accept correct value types', () => {
      const qb = new QueryBuilder(User)

      // Correct types
      qb.where({ email: 'string' })
      qb.where({ age: 25 })
      qb.where({ isActive: true })
      qb.where({ score: 3.14 })
    })

    it('should reject wrong value types for string fields', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - email is string, not number
      qb.where({ email: 123 })
    })

    it('should reject wrong value types for numeric fields', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - age is number, not string
      qb.where({ age: 'twenty-five' })
    })

    it('should reject wrong value types for boolean fields', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - isActive is boolean, not string
      qb.where({ isActive: 'yes' })
    })
  })

  describe('where() operator object validation', () => {
    it('should accept valid IN operator with correct array type', () => {
      const qb = new QueryBuilder(User)

      qb.where({ email: { in: ['a@test.com', 'b@test.com'] } })
      qb.where({ age: { in: [18, 21, 25] } })
    })

    it('should accept valid comparison operators', () => {
      const qb = new QueryBuilder(User)

      qb.where({ age: { gt: 18 } })
      qb.where({ age: { gte: 18 } })
      qb.where({ age: { lt: 65 } })
      qb.where({ age: { lte: 65 } })
      qb.where({ age: { gt: 18, lt: 65 } })
    })

    it('should accept LIKE operator for string fields', () => {
      const qb = new QueryBuilder(User)

      qb.where({ email: { like: '%@company.com' } })
      qb.where({ name: { notLike: '%test%' } })
    })

    it('should accept NULL check operators', () => {
      const qb = new QueryBuilder(User)

      qb.where({ metadata: { isNull: true } })
      qb.where({ email: { isNotNull: true } })
    })
  })

  describe('select() type narrowing', () => {
    it('should narrow return type to selected fields', () => {
      const qb = new QueryBuilder(User)

      const narrowedQb = qb.select('id', 'email')

      // Type should be Pick<InferSchema<User>, 'id' | 'email'>
      expectTypeOf(narrowedQb).toMatchTypeOf<QueryBuilder<typeof User.$schema, { id: number; email: string }>>()
    })

    it('should reject invalid field names in select', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - 'invalidField' is not a valid field
      qb.select('id', 'invalidField')
    })
  })

  describe('orderBy() field validation', () => {
    it('should accept valid field names', () => {
      const qb = new QueryBuilder(User)

      qb.orderBy('email', 'asc')
      qb.orderBy('createdAt', 'desc')
      qb.orderBy('age', 'asc')
    })

    it('should reject invalid field names', () => {
      const qb = new QueryBuilder(User)

      // @ts-expect-error - 'invalidSort' is not a valid field
      qb.orderBy('invalidSort', 'asc')
    })
  })

  describe('aggregate methods - NumericKeys validation', () => {
    it('should accept numeric fields for sum()', () => {
      const qb = new QueryBuilder(Order)

      // Type-level check: these should compile without error
      // We're testing types, not runtime - verify method signatures accept correct types
      type SumAmount = Parameters<typeof qb.sum<'amount'>>
      type SumQuantity = Parameters<typeof qb.sum<'quantity'>>
      expectTypeOf<SumAmount[0]>().toEqualTypeOf<'amount'>()
      expectTypeOf<SumQuantity[0]>().toEqualTypeOf<'quantity'>()
    })

    it('should reject non-numeric fields for sum()', () => {
      const qb = new QueryBuilder(Order)

      // @ts-expect-error - status is string, not numeric
      type InvalidSum = Parameters<typeof qb.sum<'status'>>
    })

    it('should accept numeric fields for avg()', () => {
      const qb = new QueryBuilder(Order)

      // Type-level check only
      type AvgAmount = Parameters<typeof qb.avg<'amount'>>
      type AvgQuantity = Parameters<typeof qb.avg<'quantity'>>
      expectTypeOf<AvgAmount[0]>().toEqualTypeOf<'amount'>()
      expectTypeOf<AvgQuantity[0]>().toEqualTypeOf<'quantity'>()
    })

    it('should reject non-numeric fields for avg()', () => {
      const qb = new QueryBuilder(Order)

      // @ts-expect-error - status is string, not numeric
      type InvalidAvg = Parameters<typeof qb.avg<'status'>>
    })

    it('should accept any field for min/max', () => {
      const qb = new QueryBuilder(Order)

      // min/max work on any comparable type - type-level verification only
      type MinAmount = Parameters<typeof qb.min<'amount'>>
      type MinStatus = Parameters<typeof qb.min<'status'>>
      type MaxCreatedAt = Parameters<typeof qb.max<'createdAt'>>
      expectTypeOf<MinAmount[0]>().toEqualTypeOf<'amount'>()
      expectTypeOf<MinStatus[0]>().toEqualTypeOf<'status'>()
      expectTypeOf<MaxCreatedAt[0]>().toEqualTypeOf<'createdAt'>()
    })
  })

  describe('groupBy() field validation', () => {
    it('should accept valid field names', () => {
      const qb = new QueryBuilder(Order)

      qb.groupBy('status')
      qb.groupBy('amount')
    })

    it('should reject invalid field names', () => {
      const qb = new QueryBuilder(Order)

      // @ts-expect-error - 'invalidGroup' is not a valid field
      qb.groupBy('invalidGroup')
    })
  })

  describe('chained methods preserve type safety', () => {
    it('should maintain type safety through method chains', () => {
      const qb = new QueryBuilder(User)

      // Full chain should compile
      qb.where({ role: 'admin' })
        .where('age', '>', 18)
        .orWhere({ isActive: true })
        .orderBy('createdAt', 'desc')
        .limit(10)
        .offset(0)
    })

    it('should preserve selected type through chains', () => {
      const qb = new QueryBuilder(User)

      const result = qb
        .select('id', 'email')
        .where({ isActive: true })
        .orderBy('email', 'asc')

      // Return type should still be narrowed
      expectTypeOf(result).toMatchTypeOf<QueryBuilder<typeof User.$schema, { id: number; email: string }>>()
    })
  })
})
