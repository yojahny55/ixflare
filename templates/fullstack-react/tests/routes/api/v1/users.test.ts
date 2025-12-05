/**
 * Users API Endpoint Tests
 * Tests for /api/v1/users endpoint
 *
 * These tests validate the route handler exports and schema validation.
 * For full integration tests with Miniflare, see the integration test suite.
 */
import { describe, it, expect } from 'vitest'
import { createUserSchema, updateUserSchema } from '../../../../src/schemas/user'
import * as usersRoute from '../../../../src/routes/api/v1/users'

describe('Users Route Exports', () => {
  it('should export GET handler', () => {
    expect(typeof usersRoute.GET).toBe('function')
  })

  it('should export POST handler', () => {
    expect(typeof usersRoute.POST).toBe('function')
  })

  it('should export PUT handler', () => {
    expect(typeof usersRoute.PUT).toBe('function')
  })

  it('should export DELETE handler', () => {
    expect(typeof usersRoute.DELETE).toBe('function')
  })
})

describe('User Schema Validation', () => {
  describe('createUserSchema', () => {
    it('should accept valid user data', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = createUserSchema.safeParse({
        email: 'invalid-email',
        name: 'Test User',
      })
      expect(result.success).toBe(false)
    })

    it('should reject name that is too short', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: 'A',
      })
      expect(result.success).toBe(false)
    })

    it('should reject name that is too long', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: 'A'.repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing email', () => {
      const result = createUserSchema.safeParse({
        name: 'Test User',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing name', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty object', () => {
      const result = createUserSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('updateUserSchema', () => {
    it('should accept partial updates with email only', () => {
      const result = updateUserSchema.safeParse({
        email: 'new@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('should accept partial updates with name only', () => {
      const result = updateUserSchema.safeParse({
        name: 'Updated Name',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty object for partial schema', () => {
      const result = updateUserSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should still validate email format when provided', () => {
      const result = updateUserSchema.safeParse({
        email: 'invalid-email',
      })
      expect(result.success).toBe(false)
    })
  })
})
