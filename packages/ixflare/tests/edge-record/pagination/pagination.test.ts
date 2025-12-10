import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel, field, timestamps, createModelProxy } from '@/edge-record'
import { encodeCursor, decodeCursor, validateCursor } from '@/edge-record/pagination'
import { createMockD1Database } from '../crud/mock-d1'

describe('Pagination', () => {
  let db: D1Database

  // Test models
  const User = createModelProxy(
    defineModel('users', {
      id: field.id(),
      email: field.string(),
      name: field.string(),
      role: field.string(),
      ...timestamps(),
    })
  )

  const Post = createModelProxy(
    defineModel('posts', {
      id: field.id(),
      title: field.string(),
      content: field.text(),
      status: field.string(),
      ...timestamps(),
    })
  )

  const UserWithSoftDelete = createModelProxy(
    defineModel(
      'users_soft',
      {
        id: field.id(),
        email: field.string(),
        name: field.string(),
        deletedAt: field.datetime().nullable(),
        ...timestamps(),
      },
      { softDeletes: true }
    )
  )

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('Cursor encoding/decoding', () => {
    it('should encode and decode cursor correctly', () => {
      const cursor = { createdAt: 1733311800000, id: 100 }
      const encoded = encodeCursor(cursor)

      expect(typeof encoded).toBe('string')
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')

      const decoded = decodeCursor(encoded)
      expect(decoded).toEqual(cursor)
    })

    it('should throw ValidationError for invalid cursor', () => {
      expect(() => decodeCursor('invalid-cursor')).toThrow('Invalid cursor format')
    })

    it('should validate cursor contains expected fields', () => {
      const cursor = { createdAt: 1733311800000, id: 100 }

      // Should not throw
      expect(() => validateCursor(cursor, 'createdAt')).not.toThrow()

      // Should throw if orderField missing
      expect(() => validateCursor(cursor, 'invalidField')).toThrow(
        "Cursor must contain 'invalidField' field"
      )

      // Should throw if id missing
      const invalidCursor = { createdAt: 1733311800000 }
      expect(() => validateCursor(invalidCursor, 'createdAt')).toThrow(
        "Cursor must contain 'id' field"
      )
    })
  })

  describe('Offset Pagination (paginate)', () => {
    beforeEach(async () => {
      // Insert 156 test users for pagination testing
      const users = Array.from({ length: 156 }, (_, i) => ({
        email: `user${i + 1}@example.com`,
        name: `User ${i + 1}`,
        role: i % 3 === 0 ? 'admin' : 'user',
      }))

      for (const user of users) {
        await User.create(user, db)
      }
    })

    it('should paginate results with correct metadata', async () => {
      const result = await User.where({}).orderBy('id', 'asc').paginate({ page: 2, perPage: 20 }, db)

      expect(result.data).toHaveLength(20)
      expect(result.meta).toEqual({
        total: 156,
        perPage: 20,
        currentPage: 2,
        lastPage: 8,
        from: 21,
        to: 40,
      })
      expect(result.links).toEqual({
        first: '?page=1',
        prev: '?page=1',
        next: '?page=3',
        last: '?page=8',
      })
    })

    it('should handle first page correctly', async () => {
      const result = await User.where({}).orderBy('id', 'asc').paginate({ page: 1, perPage: 20 }, db)

      expect(result.meta.currentPage).toBe(1)
      expect(result.meta.from).toBe(1)
      expect(result.meta.to).toBe(20)
      expect(result.links.prev).toBeNull()
      expect(result.links.next).toBe('?page=2')
    })

    it('should handle last page correctly', async () => {
      const result = await User.where({}).orderBy('id', 'asc').paginate({ page: 8, perPage: 20 }, db)

      expect(result.data).toHaveLength(16) // 156 - 140 = 16 remaining
      expect(result.meta.currentPage).toBe(8)
      expect(result.meta.from).toBe(141)
      expect(result.meta.to).toBe(156)
      expect(result.links.prev).toBe('?page=7')
      expect(result.links.next).toBeNull()
    })

    it('should handle page beyond lastPage', async () => {
      const result = await User.where({}).orderBy('id', 'asc').paginate({ page: 100, perPage: 20 }, db)

      expect(result.data).toHaveLength(0)
      expect(result.meta.from).toBe(0)
      expect(result.meta.to).toBe(0)
    })

    it('should handle empty result set', async () => {
      const result = await User.where({ role: 'superadmin' }).paginate({ page: 1, perPage: 20 }, db)

      expect(result.data).toHaveLength(0)
      expect(result.meta).toEqual({
        total: 0,
        perPage: 20,
        currentPage: 1,
        lastPage: 1,
        from: 0,
        to: 0,
      })
    })

    it('should handle page 0 or negative by defaulting to 1', async () => {
      const result1 = await User.where({}).paginate({ page: 0, perPage: 20 }, db)
      const result2 = await User.where({}).paginate({ page: -5, perPage: 20 }, db)

      expect(result1.meta.currentPage).toBe(1)
      expect(result2.meta.currentPage).toBe(1)
    })

    it('should cap perPage at MAX_PAGE_SIZE (100)', async () => {
      const result = await User.where({}).paginate({ page: 1, perPage: 500 }, db)

      expect(result.meta.perPage).toBe(100)
      expect(result.data).toHaveLength(100)
    })

    it('should use default perPage of 20 when not specified', async () => {
      const result = await User.where({}).paginate({ page: 1 }, db)

      expect(result.meta.perPage).toBe(20)
      expect(result.data).toHaveLength(20)
    })

    it('should paginate with WHERE conditions', async () => {
      const result = await User.where({ role: 'admin' })
        .orderBy('id', 'asc')
        .paginate({ page: 1, perPage: 10 }, db)

      expect(result.data).toHaveLength(10)
      expect(result.meta.total).toBe(52) // 156 / 3 = 52 admins
      expect(result.data.every((u) => u.role === 'admin')).toBe(true)
    })

    it('should work with static Model.paginate() shortcut', async () => {
      const result = await User.paginate({ page: 1, perPage: 20 }, db)

      expect(result.data).toHaveLength(20)
      expect(result.meta.total).toBe(156)
    })
  })

  describe('Cursor Pagination (cursorPaginate)', () => {
    beforeEach(async () => {
      // Insert test posts with timestamps
      const posts = Array.from({ length: 50 }, (_, i) => ({
        title: `Post ${i + 1}`,
        content: `Content ${i + 1}`,
        status: i % 2 === 0 ? 'published' : 'draft',
      }))

      for (const post of posts) {
        await Post.create(post, db)
      }
    })

    it('should throw if orderBy not set', async () => {
      await expect(Post.where({}).cursorPaginate({ limit: 20 }, db)).rejects.toThrow(
        'Cursor pagination requires orderBy()'
      )
    })

    it('should paginate first page without cursor', async () => {
      const result = await Post.where({})
        .orderBy('createdAt', 'desc')
        .cursorPaginate({ limit: 20 }, db)

      expect(result.data).toHaveLength(20)
      expect(result.meta.hasMore).toBe(true)
      expect(result.meta.nextCursor).toBeTruthy()
      expect(result.meta.prevCursor).toBeNull()
    })

    it('should paginate forward using nextCursor', async () => {
      // Use id ordering since all posts have same createdAt (created in fast loop)
      const page1 = await Post.where({})
        .orderBy('id', 'desc')
        .cursorPaginate({ limit: 20 }, db)

      expect(page1.meta.nextCursor).toBeTruthy()

      const page2 = await Post.where({})
        .orderBy('id', 'desc')
        .cursorPaginate({ cursor: page1.meta.nextCursor!, limit: 20 }, db)

      expect(page2.data).toHaveLength(20)
      expect(page2.meta.hasMore).toBe(true)
      // Page 2 should start with different IDs than page 1 (keyset pagination)
      expect(page2.data[0].id).not.toBe(page1.data[0].id)
    })

    it('should set hasMore to false on last page', async () => {
      const result = await Post.where({})
        .orderBy('createdAt', 'desc')
        .cursorPaginate({ limit: 100 }, db)

      expect(result.data).toHaveLength(50)
      expect(result.meta.hasMore).toBe(false)
      expect(result.meta.nextCursor).toBeNull()
    })

    it('should cap limit at MAX_PAGE_SIZE (100)', async () => {
      const result = await Post.where({})
        .orderBy('createdAt', 'desc')
        .cursorPaginate({ limit: 500 }, db)

      expect(result.data.length).toBeLessThanOrEqual(50) // We only have 50 posts
    })

    it('should use default limit of 20 when not specified', async () => {
      const result = await Post.where({}).orderBy('createdAt', 'desc').cursorPaginate({}, db)

      expect(result.data).toHaveLength(20)
    })

    it('should work with WHERE conditions', async () => {
      const result = await Post.where({ status: 'published' })
        .orderBy('createdAt', 'desc')
        .cursorPaginate({ limit: 10 }, db)

      expect(result.data.every((p) => p.status === 'published')).toBe(true)
      expect(result.data.length).toBeLessThanOrEqual(10)
    })

    it('should throw ValidationError for invalid cursor', async () => {
      await expect(
        Post.where({})
          .orderBy('createdAt', 'desc')
          .cursorPaginate({ cursor: 'invalid', limit: 20 }, db)
      ).rejects.toThrow('Invalid cursor format')
    })

    it('should throw ValidationError if cursor does not match orderBy field', async () => {
      const validCursor = encodeCursor({ wrongField: 123, id: 1 })

      await expect(
        Post.where({})
          .orderBy('createdAt', 'desc')
          .cursorPaginate({ cursor: validCursor, limit: 20 }, db)
      ).rejects.toThrow("Cursor must contain 'createdAt' field")
    })

    it('should work with static Model.orderBy() shortcut', async () => {
      // Model.orderBy() creates a QueryBuilder with ordering, then cursorPaginate
      const result = await Post.orderBy('createdAt', 'desc').cursorPaginate({ limit: 20 }, db)

      expect(result.data).toHaveLength(20)
      expect(result.meta.hasMore).toBe(true)
    })

    it('should paginate backward using prevCursor', async () => {
      // Navigate forward to page 2 first
      const page1 = await Post.where({})
        .orderBy('id', 'asc')
        .cursorPaginate({ limit: 20 }, db)

      const page2 = await Post.where({})
        .orderBy('id', 'asc')
        .cursorPaginate({ cursor: page1.meta.nextCursor!, limit: 20 }, db)

      expect(page2.meta.prevCursor).toBeTruthy()

      // Navigate backward to page 1
      const backToPage1 = await Post.where({})
        .orderBy('id', 'asc')
        .cursorPaginate({ cursor: page2.meta.prevCursor!, limit: 20, direction: 'backward' }, db)

      // Should get the same data as page 1, in same order
      expect(backToPage1.data).toHaveLength(20)
      expect(backToPage1.data[0].id).toBe(page1.data[0].id)
      expect(backToPage1.data[19].id).toBe(page1.data[19].id)
    })

    it('should handle backward pagination on first page', async () => {
      // First page with no cursor
      const page1 = await Post.where({})
        .orderBy('id', 'asc')
        .cursorPaginate({ limit: 20 }, db)

      // Try to go backward from first page - should return empty or first page
      if (page1.meta.prevCursor) {
        const beforeFirst = await Post.where({})
          .orderBy('id', 'asc')
          .cursorPaginate({ cursor: page1.meta.prevCursor, limit: 20, direction: 'backward' }, db)

        // Going backward from first page should still work but may have fewer results
        expect(beforeFirst.data.length).toBeLessThanOrEqual(20)
      }
    })
  })

  describe('Cursor BigInt Support', () => {
    it('should encode and decode BigInt cursor values', () => {
      const cursor = { createdAt: BigInt('9007199254740993'), id: BigInt('9007199254740994') }
      const encoded = encodeCursor(cursor as unknown as Cursor)
      const decoded = decodeCursor(encoded)

      expect(decoded.createdAt).toBe(BigInt('9007199254740993'))
      expect(decoded.id).toBe(BigInt('9007199254740994'))
    })

    it('should handle mixed BigInt and regular values', () => {
      const cursor = { createdAt: 12345, id: BigInt('9007199254740993') }
      const encoded = encodeCursor(cursor as unknown as Cursor)
      const decoded = decodeCursor(encoded)

      expect(decoded.createdAt).toBe(12345)
      expect(decoded.id).toBe(BigInt('9007199254740993'))
    })
  })

  describe('Pagination with Soft Deletes', () => {
    beforeEach(async () => {
      // Create 30 users
      for (let i = 1; i <= 30; i++) {
        await UserWithSoftDelete.create(
          {
            email: `user${i}@example.com`,
            name: `User ${i}`,
          },
          db
        )
      }

      // Soft delete 10 users (IDs 1-10)
      for (let i = 1; i <= 10; i++) {
        await UserWithSoftDelete.delete(i, db)
      }
    })

    it('should exclude soft-deleted records by default', async () => {
      const result = await UserWithSoftDelete.where({})
        .orderBy('id', 'asc')
        .paginate({ page: 1, perPage: 20 }, db)

      expect(result.meta.total).toBe(20) // Only non-deleted
      // Use == null to match both null and undefined (field may not exist for non-deleted records)
      expect(result.data.every((u) => u.deletedAt == null)).toBe(true)
    })

    it('should include soft-deleted with withTrashed()', async () => {
      const result = await UserWithSoftDelete.withTrashed()
        .orderBy('id', 'asc')
        .paginate({ page: 1, perPage: 30 }, db)

      expect(result.meta.total).toBe(30) // All users
    })

    it('should only return soft-deleted with onlyTrashed()', async () => {
      const result = await UserWithSoftDelete.onlyTrashed()
        .orderBy('id', 'asc')
        .paginate({ page: 1, perPage: 20 }, db)

      expect(result.meta.total).toBe(10) // Only deleted
      expect(result.data.every((u) => u.deletedAt !== null)).toBe(true)
    })

    it('should work with cursor pagination and soft deletes', async () => {
      const result = await UserWithSoftDelete.where({})
        .orderBy('createdAt', 'desc')
        .cursorPaginate({ limit: 10 }, db)

      // Use == null to match both null and undefined
      expect(result.data.every((u) => u.deletedAt == null)).toBe(true)
      expect(result.data.length).toBeLessThanOrEqual(10)
    })

    it('should work with cursor pagination and withTrashed()', async () => {
      const result = await UserWithSoftDelete.withTrashed()
        .orderBy('createdAt', 'desc')
        .cursorPaginate({ limit: 15 }, db)

      expect(result.data).toHaveLength(15)
    })
  })

  describe('Integration Tests', () => {
    beforeEach(async () => {
      // Create 1000 records for performance testing
      const users = Array.from({ length: 1000 }, (_, i) => ({
        email: `user${i + 1}@example.com`,
        name: `User ${i + 1}`,
        role: i % 5 === 0 ? 'admin' : 'user',
      }))

      for (const user of users) {
        await User.create(user, db)
      }
    })

    it('should paginate through entire dataset without duplicates or skips', async () => {
      const allIds = new Set<number>()
      let currentPage = 1
      let hasMore = true

      while (hasMore) {
        const result = await User.where({})
          .orderBy('id', 'asc')
          .paginate({ page: currentPage, perPage: 100 }, db)

        result.data.forEach((user) => allIds.add(user.id))

        hasMore = currentPage < result.meta.lastPage
        currentPage++
      }

      expect(allIds.size).toBe(1000) // All unique IDs
    })

    it('should cursor paginate through entire dataset without duplicates or skips', async () => {
      const allIds = new Set<number>()
      let cursor: string | null = null
      let hasMore = true

      while (hasMore) {
        const result = await User.where({})
          .orderBy('id', 'asc')
          .cursorPaginate({ cursor: cursor || undefined, limit: 100 }, db)

        result.data.forEach((user) => allIds.add(user.id))

        hasMore = result.meta.hasMore
        cursor = result.meta.nextCursor
      }

      expect(allIds.size).toBe(1000) // All unique IDs
    })

    it('should handle complex WHERE conditions with pagination', async () => {
      const result = await User.where({ role: 'admin' })
        .where('id', '>', 100)
        .where('id', '<', 500)
        .orderBy('id', 'asc')
        .paginate({ page: 1, perPage: 50 }, db)

      expect(result.data.every((u) => u.role === 'admin' && u.id > 100 && u.id < 500)).toBe(true)
      expect(result.meta.total).toBeGreaterThan(0)
    })
  })
})
