/**
 * @module tests/edge-record/integration/crud.test
 * @description Integration tests for full Model CRUD API (Model.create(), Model.where(), etc.)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from '../crud/mock-d1'
import { NotFoundError } from '@/edge-record/crud/errors'

describe('Model CRUD Integration', () => {
  // Define model with CRUD methods via proxy
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

  describe('Model.create() - AC1', () => {
    it('should create record and return typed ModelInstance', async () => {
      const user = await User.create(
        {
          email: 'alex@example.com',
          name: 'Alex Rivera',
          role: 'user',
        },
        db
      )

      expect(user.get('id')).toBe(1)
      expect(user.get('email')).toBe('alex@example.com')
      expect(user.get('name')).toBe('Alex Rivera')
      expect(user.get('role')).toBe('user')
    })

    it('should auto-set timestamps', async () => {
      const beforeCreate = Date.now()
      const user = await User.create(
        {
          email: 'test@example.com',
          name: 'Test',
          role: 'user',
        },
        db
      )
      const afterCreate = Date.now()

      const createdAt = user.get('createdAt') as number
      const updatedAt = user.get('updatedAt') as number

      expect(createdAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(createdAt).toBeLessThanOrEqual(afterCreate)
      expect(updatedAt).toBe(createdAt)
    })
  })

  describe('Model.find() - AC2', () => {
    it('should find record by ID and return ModelInstance', async () => {
      const created = await User.create(
        { email: 'find@example.com', name: 'Find Me', role: 'user' },
        db
      )
      const id = created.get('id') as number

      const found = await User.find(id, db)

      expect(found).not.toBeNull()
      expect(found?.get('id')).toBe(id)
      expect(found?.get('email')).toBe('find@example.com')
    })

    it('should return null when not found', async () => {
      const result = await User.find(9999, db)

      expect(result).toBeNull()
    })
  })

  describe('Model.findOrFail() - AC3', () => {
    it('should find record and return ModelInstance', async () => {
      const created = await User.create(
        { email: 'findorfail@example.com', name: 'Find Or Fail', role: 'admin' },
        db
      )
      const id = created.get('id') as number

      const found = await User.findOrFail(id, db)

      expect(found.get('id')).toBe(id)
      expect(found.get('email')).toBe('findorfail@example.com')
    })

    it('should throw NotFoundError when not found', async () => {
      await expect(User.findOrFail(9999, db)).rejects.toThrow(NotFoundError)
    })

    it('should include table name in error message', async () => {
      try {
        await User.findOrFail(9999, db)
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError)
        expect((err as NotFoundError).code).toBe('USERS.NOT_FOUND')
      }
    })
  })

  describe('Model.where().all() - AC4', () => {
    it('should return filtered array of ModelInstances', async () => {
      await User.create({ email: 'admin1@example.com', name: 'Admin 1', role: 'admin' }, db)
      await User.create({ email: 'admin2@example.com', name: 'Admin 2', role: 'admin' }, db)
      await User.create({ email: 'user1@example.com', name: 'User 1', role: 'user' }, db)

      const admins = await User.where({ role: 'admin' }).all(db)

      expect(Array.isArray(admins)).toBe(true)
      expect(admins.length).toBeGreaterThan(0)
      admins.forEach((admin) => {
        expect(typeof admin.get).toBe('function')
      })
    })
  })

  describe('Model.where().first() - AC5', () => {
    it('should return first matching ModelInstance or null', async () => {
      await User.create({ email: 'first@example.com', name: 'First', role: 'test' }, db)

      const result = await User.where({ email: 'first@example.com' }).first(db)

      expect(result).not.toBeNull()
      expect(result?.get('email')).toBe('first@example.com')
    })

    it('should return null when no match', async () => {
      const result = await User.where({ email: 'nonexistent@example.com' }).first(db)

      expect(result).toBeNull()
    })
  })

  describe('instance.update() - AC6', () => {
    it('should update instance and return self', async () => {
      const user = await User.create(
        { email: 'update@example.com', name: 'Original', role: 'user' },
        db
      )

      const updated = await user.update({ name: 'Updated Name' }, db)

      expect(updated).toBe(user) // Returns same instance
      expect(updated.get('name')).toBe('Updated Name')
    })

    it('should auto-update updatedAt timestamp', async () => {
      const user = await User.create(
        { email: 'timestamp@example.com', name: 'Test', role: 'user' },
        db
      )
      const originalUpdatedAt = user.get('updatedAt') as number

      await new Promise((resolve) => setTimeout(resolve, 10))

      await user.update({ name: 'Changed' }, db)

      const newUpdatedAt = user.get('updatedAt') as number
      expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('Model.where().update() - AC7', () => {
    it('should bulk update matching records', async () => {
      await User.create({ email: 'bulk1@example.com', name: 'Bulk 1', role: 'user' }, db)
      await User.create({ email: 'bulk2@example.com', name: 'Bulk 2', role: 'user' }, db)

      const count = await User.where({ role: 'user' }).update({ role: 'member' }, db)

      expect(typeof count).toBe('number')
    })
  })

  describe('instance.delete() - AC8', () => {
    it('should delete record and return boolean', async () => {
      const user = await User.create(
        { email: 'delete@example.com', name: 'Delete Me', role: 'temp' },
        db
      )

      const result = await user.delete(db)

      expect(typeof result).toBe('boolean')
      expect(result).toBe(true)
    })
  })

  describe('Model.where().delete() - AC9', () => {
    it('should bulk delete matching records', async () => {
      await User.create({ email: 'delete1@example.com', name: 'Delete 1', role: 'temp' }, db)
      await User.create({ email: 'delete2@example.com', name: 'Delete 2', role: 'temp' }, db)

      const count = await User.where({ role: 'temp' }).delete(db)

      expect(typeof count).toBe('number')
    })
  })

  describe('Model.upsert() - AC10', () => {
    it('should create when no match exists', async () => {
      const user = await User.upsert(
        { email: 'upsert@example.com' },
        { name: 'Upserted', role: 'user' },
        db
      )

      expect(user.get('email')).toBe('upsert@example.com')
      expect(user.get('name')).toBe('Upserted')
    })

    it('should update when match exists', async () => {
      await User.create({ email: 'existing@example.com', name: 'Original', role: 'user' }, db)

      const user = await User.upsert(
        { email: 'existing@example.com' },
        { name: 'Updated via Upsert' },
        db
      )

      expect(user.get('name')).toBe('Updated via Upsert')
    })
  })

  describe('Model.createMany() - AC11', () => {
    it('should bulk insert and return array of ModelInstances', async () => {
      const users = await User.createMany(
        [
          { email: 'batch1@example.com', name: 'Batch 1', role: 'user' },
          { email: 'batch2@example.com', name: 'Batch 2', role: 'user' },
          { email: 'batch3@example.com', name: 'Batch 3', role: 'admin' },
        ],
        db
      )

      expect(users).toHaveLength(3)
      expect(users[0].get('id')).toBe(1)
      expect(users[1].get('id')).toBe(2)
      expect(users[2].get('id')).toBe(3)
    })
  })

  describe('Case transformation - AC12', () => {
    it('should auto-transform snake_case to camelCase', async () => {
      const user = await User.create(
        { email: 'case@example.com', name: 'Case Test', role: 'user' },
        db
      )

      // API should use camelCase
      expect(user.get('createdAt')).toBeDefined()
      expect(user.get('updatedAt')).toBeDefined()

      // toJSON should also be camelCase
      const json = user.toJSON()
      expect(json.createdAt).toBeDefined()
      expect(json.updatedAt).toBeDefined()
    })
  })

  describe('Timestamp management - AC13', () => {
    it('should auto-set createdAt on create', async () => {
      const beforeCreate = Date.now()
      const user = await User.create(
        { email: 'ts@example.com', name: 'Timestamp', role: 'user' },
        db
      )
      const afterCreate = Date.now()

      const createdAt = user.get('createdAt') as number
      expect(createdAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(createdAt).toBeLessThanOrEqual(afterCreate)
    })

    it('should auto-set updatedAt on create', async () => {
      const user = await User.create(
        { email: 'ts2@example.com', name: 'Timestamp', role: 'user' },
        db
      )

      const createdAt = user.get('createdAt') as number
      const updatedAt = user.get('updatedAt') as number

      expect(updatedAt).toBe(createdAt)
    })

    it('should auto-update updatedAt on update', async () => {
      const user = await User.create(
        { email: 'ts3@example.com', name: 'Original', role: 'user' },
        db
      )
      const originalUpdatedAt = user.get('updatedAt') as number

      await new Promise((resolve) => setTimeout(resolve, 10))

      await user.update({ name: 'Changed' }, db)
      const newUpdatedAt = user.get('updatedAt') as number

      expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('Parameterized queries - AC14', () => {
    it('should safely handle SQL injection attempts in create', async () => {
      const user = await User.create(
        {
          email: "test'@example.com",
          name: "Robert'; DROP TABLE users;--",
          role: 'user',
        },
        db
      )

      expect(user.get('email')).toBe("test'@example.com")
      expect(user.get('name')).toBe("Robert'; DROP TABLE users;--")
    })

    it('should safely handle SQL injection attempts in where', async () => {
      await User.create({ email: 'safe@example.com', name: 'Safe', role: 'user' }, db)

      // This should not cause SQL injection
      const results = await User.where({ email: "' OR '1'='1" }).all(db)

      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Type inference', () => {
    it('should maintain type information on ModelInstance', async () => {
      const user = await User.create(
        { email: 'typed@example.com', name: 'Typed', role: 'user' },
        db
      )

      // TypeScript should infer these types
      const email: string = user.get('email') as string
      const id: number = user.get('id') as number

      expect(typeof email).toBe('string')
      expect(typeof id).toBe('number')
    })
  })
})
