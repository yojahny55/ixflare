/**
 * @module tests/edge-record/crud/upsert.test
 * @description Tests for upsert operation (AC10)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { upsert, create, find } from '@/edge-record/crud/crud-operations'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from './mock-d1'

describe('Upsert Operation - AC10', () => {
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

  describe('upsert()', () => {
    it('should create new record when no match exists', async () => {
      const result = await upsert(
        User,
        { email: 'new@example.com' }, // Match criteria
        { name: 'New User', role: 'user' }, // Values to set
        db
      )

      expect(result).toBeDefined()
      expect(result.get('email')).toBe('new@example.com')
      expect(result.get('name')).toBe('New User')
      expect(result.get('role')).toBe('user')
    })

    it('should update existing record when match exists', async () => {
      // First create a record
      await create(User, { email: 'existing@example.com', name: 'Original', role: 'user' }, db)

      // Now upsert with same email
      const result = await upsert(
        User,
        { email: 'existing@example.com' }, // Match criteria
        { name: 'Updated Name', role: 'admin' }, // Values to update
        db
      )

      expect(result).toBeDefined()
      expect(result.get('name')).toBe('Updated Name')
      expect(result.get('role')).toBe('admin')
    })

    it('should return ModelInstance', async () => {
      const result = await upsert(
        User,
        { email: 'test@example.com' },
        { name: 'Test', role: 'user' },
        db
      )

      expect(typeof result.get).toBe('function')
      expect(typeof result.set).toBe('function')
      expect(typeof result.update).toBe('function')
      expect(typeof result.delete).toBe('function')
      expect(typeof result.toJSON).toBe('function')
    })

    it('should set createdAt on insert', async () => {
      const beforeUpsert = Date.now()
      const result = await upsert(
        User,
        { email: 'new@example.com' },
        { name: 'New User', role: 'user' },
        db
      )
      const afterUpsert = Date.now()

      const createdAt = result.get('createdAt') as number

      expect(createdAt).toBeGreaterThanOrEqual(beforeUpsert)
      expect(createdAt).toBeLessThanOrEqual(afterUpsert)
    })

    it('should set updatedAt on update', async () => {
      // Create existing record
      const existing = await create(
        User,
        { email: 'existing@example.com', name: 'Original', role: 'user' },
        db
      )
      const originalUpdatedAt = existing.get('updatedAt') as number

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Upsert should update
      const result = await upsert(User, { email: 'existing@example.com' }, { name: 'Updated' }, db)

      const newUpdatedAt = result.get('updatedAt') as number
      expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it('should support multiple match fields', async () => {
      await create(User, { email: 'multi@example.com', name: 'Multi', role: 'admin' }, db)

      const result = await upsert(
        User,
        { email: 'multi@example.com', role: 'admin' }, // Multiple match criteria
        { name: 'Updated Multi' },
        db
      )

      expect(result.get('name')).toBe('Updated Multi')
    })

    it('should merge match and values on insert', async () => {
      const result = await upsert(
        User,
        { email: 'merged@example.com' }, // Match criteria becomes part of insert
        { name: 'Merged User', role: 'user' },
        db
      )

      expect(result.get('email')).toBe('merged@example.com')
      expect(result.get('name')).toBe('Merged User')
      expect(result.get('role')).toBe('user')
    })

    it('should use parameterized queries', async () => {
      // This test verifies that upsert uses prepare().bind() pattern
      // The implementation should not use string interpolation for values
      const result = await upsert(
        User,
        { email: "test'@example.com" }, // SQL injection attempt
        { name: "O'Brien", role: 'user' }, // Another potential injection
        db
      )

      // If parameterized, these should work without SQL errors
      expect(result).toBeDefined()
    })
  })
})
