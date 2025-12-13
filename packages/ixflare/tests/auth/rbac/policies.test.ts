/**
 * @file tests/auth/rbac/policies.test.ts
 * @description Tests for resource-level policies
 * Story 5-4: Authorization with RBAC + Policies
 */

import { describe, it, expect } from 'vitest'
import { definePolicy } from '@/auth/rbac/policies'
import { ForbiddenError } from '@/errors'

// Test types
interface User {
  id: string
  role: string
}

interface Post {
  id: string
  authorId: string
  title: string
}

describe('definePolicy', () => {
  it('should define a policy with typed actions (AC4)', () => {
    const policy = definePolicy<User, Post>({
      view: () => true,
      update: (user, post) => user.id === post.authorId,
      delete: (user, post) => user.id === post.authorId,
    })

    expect(policy).toHaveProperty('can')
    expect(policy).toHaveProperty('authorize')
    expect(typeof policy.can).toBe('function')
    expect(typeof policy.authorize).toBe('function')
  })

  it('should validate policy definition is an object', () => {
    // @ts-expect-error - Testing runtime validation
    expect(() => definePolicy(null)).toThrow('Policy definition must be an object')

    // @ts-expect-error - Testing runtime validation
    expect(() => definePolicy('not-an-object')).toThrow('Policy definition must be an object')
  })

  it('should validate policy actions are functions', () => {
    expect(() =>
      definePolicy({
        // @ts-expect-error - Testing runtime validation
        invalid: 'not-a-function',
      })
    ).toThrow('Policy action "invalid" must be a function')
  })
})

describe('Policy.can()', () => {
  const postPolicy = definePolicy<User, Post>({
    view: () => true, // Anyone can view (AC4)
    update: (user, post) => user.id === post.authorId || user.role === 'admin', // AC4
    delete: (user, post) => user.id === post.authorId || user.role === 'admin', // AC4
  })

  it('should return true when policy allows action (AC4, AC6)', () => {
    const user: User = { id: '1', role: 'user' }
    const post: Post = { id: 'p1', authorId: '1', title: 'My Post' }

    expect(postPolicy.can(user, 'view', post)).toBe(true)
    expect(postPolicy.can(user, 'update', post)).toBe(true)
    expect(postPolicy.can(user, 'delete', post)).toBe(true)
  })

  it('should return false when policy denies action (AC4, AC6)', () => {
    const user: User = { id: '1', role: 'user' }
    const otherUserPost: Post = { id: 'p2', authorId: '2', title: "Other's Post" }

    expect(postPolicy.can(user, 'update', otherUserPost)).toBe(false)
    expect(postPolicy.can(user, 'delete', otherUserPost)).toBe(false)
  })

  it('should handle admin role with special privileges (AC4)', () => {
    const admin: User = { id: '1', role: 'admin' }
    const otherUserPost: Post = { id: 'p2', authorId: '2', title: "Other's Post" }

    expect(postPolicy.can(admin, 'update', otherUserPost)).toBe(true)
    expect(postPolicy.can(admin, 'delete', otherUserPost)).toBe(true)
  })

  it('should be synchronous for UI rendering (AC6)', () => {
    const user: User = { id: '1', role: 'user' }
    const post: Post = { id: 'p1', authorId: '1', title: 'My Post' }

    // Should be synchronous (no async/await needed)
    const result = postPolicy.can(user, 'update', post)
    expect(result).toBe(true)
  })

  it('should deny by default when action is undefined (AC8)', () => {
    const user: User = { id: '1', role: 'user' }
    const post: Post = { id: 'p1', authorId: '1', title: 'My Post' }

    // @ts-expect-error - Testing undefined action
    expect(postPolicy.can(user, 'publish', post)).toBe(false)
  })

  it('should deny when user is invalid', () => {
    const post: Post = { id: 'p1', authorId: '1', title: 'My Post' }

    // @ts-expect-error - Testing invalid user
    expect(postPolicy.can(null, 'view', post)).toBe(false)

    // @ts-expect-error - Testing invalid user
    expect(postPolicy.can(undefined, 'view', post)).toBe(false)
  })

  it('should handle policy function errors gracefully', () => {
    const errorPolicy = definePolicy({
      failingAction: () => {
        throw new Error('Policy function error')
      },
    })

    const user: User = { id: '1', role: 'user' }
    const post: Post = { id: 'p1', authorId: '1', title: 'My Post' }

    // Should return false (deny) instead of throwing
    expect(errorPolicy.can(user, 'failingAction', post)).toBe(false)
  })
})

describe('Policy.authorize()', () => {
  const postPolicy = definePolicy<User, Post>({
    view: () => true,
    update: (user, post) => user.id === post.authorId || user.role === 'admin',
    delete: (user, post) => user.id === post.authorId || user.role === 'admin',
  })

  it('should not throw when policy allows action (AC5)', () => {
    const user: User = { id: '1', role: 'user' }
    const post: Post = { id: 'p1', authorId: '1', title: 'My Post' }

    expect(() => postPolicy.authorize(user, 'update', post)).not.toThrow()
  })

  it('should throw ForbiddenError when policy denies action (AC5)', () => {
    const user: User = { id: '1', role: 'user' }
    const otherUserPost: Post = { id: 'p2', authorId: '2', title: "Other's Post" }

    expect(() => postPolicy.authorize(user, 'update', otherUserPost)).toThrow(ForbiddenError)
    expect(() => postPolicy.authorize(user, 'delete', otherUserPost)).toThrow(ForbiddenError)
  })

  it('should throw ForbiddenError with generic message (security best practice)', () => {
    const user: User = { id: '1', role: 'user' }
    const otherUserPost: Post = { id: 'p2', authorId: '2', title: "Other's Post" }

    try {
      postPolicy.authorize(user, 'update', otherUserPost)
      expect.fail('Should have thrown ForbiddenError')
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError)
      const forbiddenError = error as ForbiddenError
      // Generic message to avoid revealing attempted action
      expect(forbiddenError.message).toBe('Insufficient permissions')
      expect(forbiddenError.status).toBe(403)
    }
  })

  it('should throw ForbiddenError (403) on unauthorized access', () => {
    const user: User = { id: '1', role: 'user' }
    const otherUserPost: Post = { id: 'p2', authorId: '2', title: "Other's Post" }

    try {
      postPolicy.authorize(user, 'update', otherUserPost)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError)
      const forbiddenError = error as ForbiddenError
      expect(forbiddenError.status).toBe(403)
      expect(forbiddenError.code).toBe('FORBIDDEN')
    }
  })
})

describe('Complex policy scenarios', () => {
  interface Company {
    id: string
    ownerId: string
  }

  interface Document {
    id: string
    companyId: string
    createdBy: string
    isPublic: boolean
  }

  interface AdvancedUser {
    id: string
    role: string
    companyId: string
  }

  const documentPolicy = definePolicy<AdvancedUser, Document>({
    view: (user, doc) => {
      // Public docs can be viewed by anyone
      if (doc.isPublic) return true

      // Own company docs can be viewed
      if (user.companyId === doc.companyId) return true

      // Admins can view all
      if (user.role === 'admin') return true

      return false
    },
    update: (user, doc) => {
      // Only creator or admin can update
      return doc.createdBy === user.id || user.role === 'admin'
    },
    delete: (user, doc) => {
      // Only creator or admin can delete
      return doc.createdBy === user.id || user.role === 'admin'
    },
  })

  it('should handle complex ownership rules', () => {
    const user: AdvancedUser = { id: '1', role: 'user', companyId: 'c1' }

    // Can view own company doc
    const companyDoc: Document = {
      id: 'd1',
      companyId: 'c1',
      createdBy: '2',
      isPublic: false,
    }
    expect(documentPolicy.can(user, 'view', companyDoc)).toBe(true)

    // Cannot view other company doc
    const otherDoc: Document = {
      id: 'd2',
      companyId: 'c2',
      createdBy: '2',
      isPublic: false,
    }
    expect(documentPolicy.can(user, 'view', otherDoc)).toBe(false)

    // Can view public doc
    const publicDoc: Document = {
      id: 'd3',
      companyId: 'c2',
      createdBy: '2',
      isPublic: true,
    }
    expect(documentPolicy.can(user, 'view', publicDoc)).toBe(true)
  })

  it('should handle multi-attribute authorization (ABAC-style)', () => {
    const creator: AdvancedUser = { id: '1', role: 'user', companyId: 'c1' }
    const admin: AdvancedUser = { id: '2', role: 'admin', companyId: 'c2' }

    const doc: Document = {
      id: 'd1',
      companyId: 'c1',
      createdBy: '1',
      isPublic: false,
    }

    // Creator can update
    expect(documentPolicy.can(creator, 'update', doc)).toBe(true)

    // Admin can update (even from different company)
    expect(documentPolicy.can(admin, 'update', doc)).toBe(true)

    // Other user cannot update
    const otherUser: AdvancedUser = { id: '3', role: 'user', companyId: 'c1' }
    expect(documentPolicy.can(otherUser, 'update', doc)).toBe(false)
  })
})

describe('Type safety and inference', () => {
  it('should infer action types from policy definition', () => {
    const policy = definePolicy({
      read: () => true,
      write: () => false,
      execute: () => false,
    })

    // TypeScript should allow these actions
    const user = { id: '1', role: 'user' }
    const resource = { id: 'r1' }

    expect(policy.can(user, 'read', resource)).toBe(true)
    expect(policy.can(user, 'write', resource)).toBe(false)
    expect(policy.can(user, 'execute', resource)).toBe(false)

    // TypeScript should error on invalid action (but we can't test compile-time errors in runtime tests)
    // @ts-expect-error - 'invalid' is not a defined action
    policy.can(user, 'invalid', resource)
  })
})
