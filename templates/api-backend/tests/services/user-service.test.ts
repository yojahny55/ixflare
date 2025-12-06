/**
 * User Service Tests
 * Tests for UserService business logic
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { UserService } from '../../src/services/user-service'

describe('UserService', () => {
  let service: UserService

  beforeEach(() => {
    // Create service with mock env
    service = new UserService({})
  })

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('pagination')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 20,
      })
    })

    it('should filter users by search term', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 20,
        search: 'alice',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      // All returned users should match search term
      for (const user of result.data) {
        const matchesSearch =
          user.name.toLowerCase().includes('alice') || user.email.toLowerCase().includes('alice')
        expect(matchesSearch).toBe(true)
      }
    })

    it('should sort users by specified field', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      })

      // Verify ascending order
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].name >= result.data[i - 1].name).toBe(true)
      }
    })

    it('should calculate pagination correctly', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(result.pagination.hasNext).toBe(result.pagination.page < result.pagination.totalPages)
      expect(result.pagination.hasPrev).toBe(result.pagination.page > 1)
    })
  })

  describe('findById', () => {
    it('should return null for non-existent user', async () => {
      const result = await service.findById('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create user with generated ID and timestamps', async () => {
      const input = { email: 'new@example.com', name: 'New User' }
      const result = await service.create(input)

      expect(result.id).toBeDefined()
      expect(result.email).toBe(input.email)
      expect(result.name).toBe(input.name)
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
      expect(result.createdAt).toBe(result.updatedAt)
    })
  })

  describe('update', () => {
    it('should return null for non-existent user', async () => {
      const result = await service.update('non-existent-id', { name: 'Updated' })
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should return false for non-existent user', async () => {
      const result = await service.delete('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('isEmailTaken', () => {
    it('should return false when email is available', async () => {
      const result = await service.isEmailTaken('available@example.com')
      expect(result).toBe(false)
    })
  })
})
