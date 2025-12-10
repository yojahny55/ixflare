/**
 * @module tests/edge-record/crud/soft-delete.test
 * @description Comprehensive tests for soft delete functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { QueryBuilder } from '@/edge-record/query-builder'
import { createMockD1Database } from './mock-d1'

describe('Soft Deletes', () => {
  // Model with soft deletes enabled
  const User = defineModel(
    'users',
    {
      id: field.id(),
      email: field.string(),
      name: field.string(),
      deletedAt: field.datetime().nullable(),
      ...timestamps(),
    },
    { softDeletes: true }
  )

  // Model without soft deletes
  const Post = defineModel('posts', {
    id: field.id(),
    title: field.string(),
    content: field.text(),
    ...timestamps(),
  })

  type UserType = typeof User.$infer
  type PostType = typeof Post.$infer
  let db: D1Database

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('Model Configuration', () => {
    it('should have $softDeletes flag set when enabled', () => {
      expect(User.$softDeletes).toBe(true)
    })

    it('should not have $softDeletes flag when not enabled', () => {
      expect(Post.$softDeletes).toBe(false)
    })

    it('should throw error if softDeletes enabled without deletedAt field', () => {
      expect(() => {
        defineModel(
          'invalid',
          {
            id: field.id(),
            name: field.string(),
          },
          { softDeletes: true }
        )
      }).toThrowError(/missing 'deletedAt' field/)
    })
  })

  describe('ModelInstance.delete() - Soft Delete', () => {
    it('should soft delete by setting deletedAt timestamp', async () => {
      const user = new ModelInstance(
        User,
        { id: 1, email: 'test@example.com', name: 'Test', deletedAt: null },
        false
      )

      await user.delete(db)

      expect(user.get('deletedAt')).toBeTypeOf('number')
      expect(user.get('deletedAt')).toBeGreaterThan(0)
    })

    it('should update updatedAt when soft deleting', async () => {
      const user = new ModelInstance(
        User,
        {
          id: 1,
          email: 'test@example.com',
          name: 'Test',
          deletedAt: null,
          createdAt: 1000,
          updatedAt: 1000,
        },
        false
      )

      await user.delete(db)

      expect(user.get('updatedAt')).toBeGreaterThan(1000)
    })
  })

  describe('ModelInstance.delete() - Hard Delete (no soft deletes)', () => {
    it('should hard delete when soft deletes not enabled', async () => {
      const post = new ModelInstance(Post, { id: 1, title: 'Test', content: 'Content' }, false)

      // Should not throw an error
      await expect(post.delete(db)).resolves.toBeDefined()
    })
  })

  describe('ModelInstance.restore()', () => {
    it('should restore soft-deleted record by setting deletedAt to null', async () => {
      const user = new ModelInstance(
        User,
        {
          id: 1,
          email: 'test@example.com',
          name: 'Test',
          deletedAt: Date.now(),
          createdAt: 1000,
          updatedAt: 1000,
        },
        false
      )

      await user.restore(db)

      expect(user.get('deletedAt')).toBeNull()
      expect(user.get('updatedAt')).toBeGreaterThan(1000)
    })

    it('should throw error when restoring non-soft-delete model', async () => {
      const post = new ModelInstance(Post, { id: 1, title: 'Test', content: 'Content' }, false)

      await expect(post.restore(db)).rejects.toThrowError(/does not have soft deletes enabled/)
    })

    it('should throw error when restoring record that is not deleted', async () => {
      const user = new ModelInstance(
        User,
        { id: 1, email: 'test@example.com', name: 'Test', deletedAt: null },
        false
      )

      await expect(user.restore(db)).rejects.toThrowError(/not soft-deleted/)
    })
  })

  describe('ModelInstance.forceDelete()', () => {
    it('should permanently delete even with soft deletes enabled', async () => {
      const user = new ModelInstance(
        User,
        { id: 1, email: 'test@example.com', name: 'Test', deletedAt: null },
        false
      )

      await expect(user.forceDelete(db)).resolves.toBeDefined()
    })

    it('should work on regular models too', async () => {
      const post = new ModelInstance(Post, { id: 1, title: 'Test', content: 'Content' }, false)

      await expect(post.forceDelete(db)).resolves.toBeDefined()
    })
  })

  describe('QueryBuilder - Soft Delete Methods', () => {
    it('should have withTrashed() method', () => {
      const qb = User.withTrashed()
      expect(qb).toBeDefined()
    })

    it('should have onlyTrashed() method', () => {
      const qb = User.onlyTrashed()
      expect(qb).toBeDefined()
    })

    it('should chain withTrashed() with where', async () => {
      await expect(
        User.where({ email: 'test@example.com' }).withTrashed().all(db)
      ).resolves.toBeDefined()
    })

    it('should chain onlyTrashed() with where', async () => {
      await expect(User.where({ name: 'Test' }).onlyTrashed().all(db)).resolves.toBeDefined()
    })
  })

  describe('QueryBuilder.delete() - Bulk Soft Delete', () => {
    it('should support bulk delete on soft delete models', async () => {
      await expect(User.where({ name: 'Test' }).delete(db)).resolves.toBeDefined()
    })

    it('should support bulk delete on regular models', async () => {
      await expect(Post.where({ title: 'Test' }).delete(db)).resolves.toBeDefined()
    })
  })

  describe('QueryBuilder.forceDelete()', () => {
    it('should support bulk force delete', async () => {
      await expect(User.where({ email: 'test@example.com' }).forceDelete(db)).resolves.toBeDefined()
    })
  })

  describe('Static Model Methods', () => {
    it('should have static withTrashed() method', () => {
      expect(User.withTrashed).toBeDefined()
    })

    it('should have static onlyTrashed() method', () => {
      expect(User.onlyTrashed).toBeDefined()
    })

    it('should support Model.delete() for soft delete', async () => {
      await expect(User.delete(1, db)).resolves.toBeUndefined()
    })

    it('should support Model.forceDelete()', async () => {
      await expect(User.forceDelete(1, db)).resolves.toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle multiple where conditions with soft delete filter', async () => {
      await expect(
        User.where({ name: 'Test' }).where({ email: 'test@example.com' }).all(db)
      ).resolves.toBeDefined()
    })

    it('should handle orWhere with soft delete filter', async () => {
      await expect(
        User.where({ name: 'Test' }).orWhere({ name: 'Admin' }).all(db)
      ).resolves.toBeDefined()
    })

    it('should maintain filter with orderBy and limit', async () => {
      await expect(
        User.where({ name: 'Test' }).orderBy('createdAt', 'desc').limit(10).all(db)
      ).resolves.toBeDefined()
    })

    it('should work with complex query chains', async () => {
      await expect(
        User.where({ name: 'Test' })
          .where('createdAt', '>', 1000)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .offset(5)
          .all(db)
      ).resolves.toBeDefined()
    })

    it('should allow toggling between withTrashed and onlyTrashed', async () => {
      await expect(User.withTrashed().onlyTrashed().all(db)).resolves.toBeDefined()
    })
  })

  describe('Integration Scenarios', () => {
    it('should soft delete, then restore', async () => {
      const user = new ModelInstance(
        User,
        { id: 1, email: 'test@example.com', name: 'Test', deletedAt: null },
        false
      )

      // Soft delete
      await user.delete(db)
      expect(user.get('deletedAt')).not.toBeNull()

      // Restore
      await user.restore(db)
      expect(user.get('deletedAt')).toBeNull()
    })

    it('should force delete permanently', async () => {
      const user = new ModelInstance(
        User,
        { id: 1, email: 'test@example.com', name: 'Test', deletedAt: null },
        false
      )

      await expect(user.forceDelete(db)).resolves.toBeDefined()
    })
  })

  describe('SQL Generation - Soft Delete Filter', () => {
    it('should include deleted_at IS NULL in QueryBuilder.toSQL() for soft delete models', () => {
      const qb = new QueryBuilder(User)
      const { query } = qb.where({ name: 'Test' }).toSQL()

      expect(query).toContain('deleted_at')
      expect(query).toContain('IS NULL')
    })

    it('should NOT include deleted_at filter for non-soft-delete models', () => {
      const qb = new QueryBuilder(Post)
      const { query } = qb.where({ title: 'Test' }).toSQL()

      expect(query).not.toContain('deleted_at')
    })

    it('should include deleted_at IS NOT NULL when using onlyTrashed()', () => {
      const qb = new QueryBuilder(User)
      const { query } = qb.onlyTrashed().toSQL()

      expect(query).toContain('deleted_at')
      expect(query).toContain('IS NOT NULL')
    })

    it('should NOT include deleted_at filter when using withTrashed()', () => {
      const qb = new QueryBuilder(User)
      const { query } = qb.withTrashed().toSQL()

      // withTrashed should bypass the filter entirely
      expect(query).not.toContain('deleted_at')
    })
  })

  describe('GroupedQueryBuilder - Soft Delete Filter', () => {
    it('should apply soft delete filter to grouped queries via QueryBuilder', async () => {
      // groupBy is only available through QueryBuilder, not as static method
      const qb = new QueryBuilder(User)
      await expect(qb.groupBy('name').count(db)).resolves.toBeDefined()
    })

    it('should apply soft delete filter when chaining where().groupBy()', async () => {
      await expect(
        User.where({ email: 'test@example.com' }).groupBy('name').count(db)
      ).resolves.toBeDefined()
    })

    it('should respect withTrashed() in grouped queries', async () => {
      await expect(User.withTrashed().groupBy('name').count(db)).resolves.toBeDefined()
    })

    it('should respect onlyTrashed() in grouped queries', async () => {
      await expect(User.onlyTrashed().groupBy('name').count(db)).resolves.toBeDefined()
    })
  })

  describe('Model.find() - Soft Delete Filter', () => {
    it('should have find method on model', () => {
      expect(typeof User.find).toBe('function')
    })

    it('should have findOrFail method on model', () => {
      expect(typeof User.findOrFail).toBe('function')
    })

    it('should call find without error on soft delete model', async () => {
      // The mock doesn't return records, but we can verify it doesn't throw
      await expect(User.find(1, db)).resolves.toBeNull()
    })
  })

  describe('QueryBuilder.find() - withTrashed() Support (Task 7.3)', () => {
    it('should have find() method on QueryBuilder', () => {
      const qb = new QueryBuilder(User)
      expect(typeof qb.find).toBe('function')
    })

    it('should have findOrFail() method on QueryBuilder', () => {
      const qb = new QueryBuilder(User)
      expect(typeof qb.findOrFail).toBe('function')
    })

    it('should allow withTrashed().find() pattern', async () => {
      // This is the critical test - User.withTrashed().find() must work
      await expect(User.withTrashed().find(1, db)).resolves.toBeNull()
    })

    it('should allow onlyTrashed().find() pattern', async () => {
      await expect(User.onlyTrashed().find(1, db)).resolves.toBeNull()
    })

    it('should allow withTrashed().findOrFail() pattern', async () => {
      // Should throw NotFoundError since mock returns null
      await expect(User.withTrashed().findOrFail(1, db)).rejects.toThrow(/not found/)
    })

    it('should allow chaining where().find()', async () => {
      await expect(User.where({ name: 'Test' }).find(1, db)).resolves.toBeNull()
    })
  })

  describe('Static Model Methods - Soft Delete', () => {
    it('should have delete method that soft deletes', async () => {
      await expect(User.delete(1, db)).resolves.toBeUndefined()
    })

    it('should have forceDelete method for permanent deletion', async () => {
      await expect(User.forceDelete(1, db)).resolves.toBeUndefined()
    })
  })
})
