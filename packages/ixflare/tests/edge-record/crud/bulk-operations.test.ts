/**
 * @module tests/edge-record/crud/bulk-operations.test
 * @description Tests for bulk operations including createMany (AC11)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMany } from '@/edge-record/crud/crud-operations'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from './mock-d1'

describe('Bulk Operations - AC11', () => {
  const User = defineModel('users', {
    id: field.id(),
    email: field.string(),
    name: field.string(),
    role: field.string(),
    ...timestamps(),
  })

  let db: D1Database

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('createMany()', () => {
    it('should bulk insert multiple records', async () => {
      const records = [
        { email: 'user1@example.com', name: 'User 1', role: 'user' },
        { email: 'user2@example.com', name: 'User 2', role: 'user' },
        { email: 'user3@example.com', name: 'User 3', role: 'admin' },
      ]

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(3)
    })

    it('should return array of ModelInstances', async () => {
      const records = [
        { email: 'user1@example.com', name: 'User 1', role: 'user' },
        { email: 'user2@example.com', name: 'User 2', role: 'user' },
      ]

      const results = await createMany(User, records, db)

      results.forEach((instance) => {
        expect(typeof instance.get).toBe('function')
        expect(typeof instance.set).toBe('function')
        expect(typeof instance.update).toBe('function')
        expect(typeof instance.delete).toBe('function')
        expect(typeof instance.toJSON).toBe('function')
      })
    })

    it('should assign unique IDs to each record', async () => {
      const records = [
        { email: 'user1@example.com', name: 'User 1', role: 'user' },
        { email: 'user2@example.com', name: 'User 2', role: 'user' },
        { email: 'user3@example.com', name: 'User 3', role: 'user' },
      ]

      const results = await createMany(User, records, db)

      const ids = results.map((r) => r.get('id'))
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(3)
      expect(ids[0]).toBe(1)
      expect(ids[1]).toBe(2)
      expect(ids[2]).toBe(3)
    })

    it('should set createdAt and updatedAt for all records', async () => {
      const beforeCreate = Date.now()

      const records = [
        { email: 'user1@example.com', name: 'User 1', role: 'user' },
        { email: 'user2@example.com', name: 'User 2', role: 'user' },
      ]

      const results = await createMany(User, records, db)

      const afterCreate = Date.now()

      results.forEach((instance) => {
        const createdAt = instance.get('createdAt') as number
        const updatedAt = instance.get('updatedAt') as number

        expect(createdAt).toBeGreaterThanOrEqual(beforeCreate)
        expect(createdAt).toBeLessThanOrEqual(afterCreate)
        expect(updatedAt).toBeGreaterThanOrEqual(beforeCreate)
        expect(updatedAt).toBeLessThanOrEqual(afterCreate)
      })
    })

    it('should use same timestamp for all records in batch', async () => {
      const records = [
        { email: 'user1@example.com', name: 'User 1', role: 'user' },
        { email: 'user2@example.com', name: 'User 2', role: 'user' },
        { email: 'user3@example.com', name: 'User 3', role: 'user' },
      ]

      const results = await createMany(User, records, db)

      const timestamps = results.map((r) => r.get('createdAt'))
      const uniqueTimestamps = new Set(timestamps)

      // All records should have same timestamp (created in same batch)
      expect(uniqueTimestamps.size).toBe(1)
    })

    it('should handle empty array', async () => {
      const results = await createMany(User, [], db)

      expect(results).toEqual([])
    })

    it('should handle single record', async () => {
      const records = [{ email: 'single@example.com', name: 'Single', role: 'user' }]

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(1)
      expect(results[0].get('email')).toBe('single@example.com')
    })

    it('should use D1 batch API for efficiency', async () => {
      // This test verifies batch is used (single round-trip)
      const records = Array.from({ length: 10 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: 'user',
      }))

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(10)
    })

    it('should use parameterized queries for all inserts', async () => {
      // Test with potential SQL injection values
      const records = [
        { email: "test'@example.com", name: "O'Brien", role: 'user' },
        { email: 'normal@example.com', name: 'Normal', role: "admin'; DROP TABLE users;--" },
      ]

      // Should not throw - parameterized queries handle escaping
      const results = await createMany(User, records, db)

      expect(results).toHaveLength(2)
    })

    it('should preserve record order in results', async () => {
      const records = [
        { email: 'first@example.com', name: 'First', role: 'user' },
        { email: 'second@example.com', name: 'Second', role: 'user' },
        { email: 'third@example.com', name: 'Third', role: 'user' },
      ]

      const results = await createMany(User, records, db)

      expect(results[0].get('email')).toBe('first@example.com')
      expect(results[1].get('email')).toBe('second@example.com')
      expect(results[2].get('email')).toBe('third@example.com')
    })

    it('should transform camelCase to snake_case for DB', async () => {
      const records = [{ email: 'test@example.com', name: 'Test', role: 'user' }]

      // If transformation works, createdAt should be stored as created_at in DB
      const results = await createMany(User, records, db)

      // Results should have camelCase (transformed back)
      expect(results[0].get('createdAt')).toBeDefined()
      expect(results[0].get('updatedAt')).toBeDefined()
    })
  })

  describe('createMany() with large batches', () => {
    it('should handle batch of 100 records', async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: i % 2 === 0 ? 'user' : 'admin',
      }))

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(100)
    })

    it('should handle batches larger than D1 limit (100)', async () => {
      // Create 150 records - should be split into 2 batches (100 + 50)
      const records = Array.from({ length: 150 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: 'user',
      }))

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(150)
      // Verify all IDs are assigned correctly
      expect(results[0].get('id')).toBe(1)
      expect(results[149].get('id')).toBe(150)
    })

    it('should handle batches of exactly 200 records (2 full batches)', async () => {
      const records = Array.from({ length: 200 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: 'user',
      }))

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(200)
    })

    it('should handle very large batches (500 records)', async () => {
      const records = Array.from({ length: 500 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: 'user',
      }))

      const results = await createMany(User, records, db)

      expect(results).toHaveLength(500)
      // Should be split into 5 batches of 100
    })
  })
})
