/**
 * @module tests/edge-record/crud/crud-operations.test
 * @description Tests for static CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { create, find, findOrFail } from '@/edge-record/crud/crud-operations'
import { NotFoundError } from '@/edge-record/crud/errors'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from './mock-d1'

describe('CRUD Operations', () => {
  const User = defineModel('users', {
    id: field.id(),
    email: field.string(),
    name: field.string(),
    ...timestamps(),
  })

  let db: D1Database

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('create', () => {
    it('should create a new record and return ModelInstance', async () => {
      const user = await create(
        User,
        {
          email: 'alex@example.com',
          name: 'Alex Rivera',
        },
        db
      )

      expect(user.get('id')).toBe(1)
      expect(user.get('email')).toBe('alex@example.com')
      expect(user.get('name')).toBe('Alex Rivera')
    })

    it('should set createdAt and updatedAt timestamps', async () => {
      const beforeCreate = Date.now()
      const user = await create(
        User,
        {
          email: 'alex@example.com',
          name: 'Alex Rivera',
        },
        db
      )
      const afterCreate = Date.now()

      const createdAt = user.get('createdAt') as number
      const updatedAt = user.get('updatedAt') as number

      expect(createdAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(createdAt).toBeLessThanOrEqual(afterCreate)
      expect(updatedAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(updatedAt).toBeLessThanOrEqual(afterCreate)
    })

    it('should auto-increment id for multiple records', async () => {
      const user1 = await create(User, { email: 'user1@example.com', name: 'User 1' }, db)
      const user2 = await create(User, { email: 'user2@example.com', name: 'User 2' }, db)
      const user3 = await create(User, { email: 'user3@example.com', name: 'User 3' }, db)

      expect(user1.get('id')).toBe(1)
      expect(user2.get('id')).toBe(2)
      expect(user3.get('id')).toBe(3)
    })

    it('should return ModelInstance with all CRUD methods', async () => {
      const user = await create(User, { email: 'test@example.com', name: 'Test' }, db)

      expect(typeof user.get).toBe('function')
      expect(typeof user.set).toBe('function')
      expect(typeof user.save).toBe('function')
      expect(typeof user.update).toBe('function')
      expect(typeof user.delete).toBe('function')
      expect(typeof user.toJSON).toBe('function')
    })
  })

  describe('find', () => {
    it('should find record by ID and return ModelInstance', async () => {
      // Create a record first
      const created = await create(User, { email: 'alex@example.com', name: 'Alex Rivera' }, db)
      const id = created.get('id') as number

      // Find it
      const found = await find(User, id, db)

      expect(found).not.toBeNull()
      expect(found?.get('id')).toBe(id)
      expect(found?.get('email')).toBe('alex@example.com')
      expect(found?.get('name')).toBe('Alex Rivera')
    })

    it('should return null when record not found', async () => {
      const result = await find(User, 999, db)

      expect(result).toBeNull()
    })

    it('should transform snake_case DB columns to camelCase', async () => {
      const created = await create(User, { email: 'test@example.com', name: 'Test' }, db)
      const id = created.get('id') as number

      const found = await find(User, id, db)

      expect(found?.get('createdAt')).toBeDefined()
      expect(found?.get('updatedAt')).toBeDefined()
    })
  })

  describe('findOrFail', () => {
    it('should find record by ID and return ModelInstance', async () => {
      const created = await create(User, { email: 'alex@example.com', name: 'Alex Rivera' }, db)
      const id = created.get('id') as number

      const found = await findOrFail(User, id, db)

      expect(found.get('id')).toBe(id)
      expect(found.get('email')).toBe('alex@example.com')
      expect(found.get('name')).toBe('Alex Rivera')
    })

    it('should throw NotFoundError when record not found', async () => {
      await expect(findOrFail(User, 999, db)).rejects.toThrow(NotFoundError)
    })

    it('should throw error with proper code and message', async () => {
      try {
        await findOrFail(User, 999, db)
        expect.fail('Should have thrown NotFoundError')
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError)
        expect((err as NotFoundError).code).toBe('USERS.NOT_FOUND')
        expect((err as NotFoundError).message).toContain('users with id 999 not found')
        expect((err as NotFoundError).status).toBe(404)
      }
    })
  })
})
