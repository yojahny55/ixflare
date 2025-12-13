/**
 * @file tests/auth/rbac/permissions.test.ts
 * @description Tests for permission checking utilities
 * Story 5-4: Authorization with RBAC + Policies
 */

import { describe, it, expect } from 'vitest'
import { defineRoles } from '@/auth/rbac/roles'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
} from '@/auth/rbac/permissions'
import type { User } from '@/auth/rbac/types'

const testRoles = defineRoles({
  admin: {
    permissions: ['*'], // Wildcard
  },
  moderator: {
    permissions: ['posts:read', 'posts:update', 'posts:delete', 'users:read'],
  },
  editor: {
    permissions: ['posts:read', 'posts:update', 'posts:create'],
  },
  user: {
    permissions: ['posts:read', 'posts:create'],
  },
})

describe('hasPermission', () => {
  it('should return true for exact permission match', () => {
    const user: User = { id: '1', roles: ['user'] }
    expect(hasPermission(user, 'posts:read', testRoles)).toBe(true)
    expect(hasPermission(user, 'posts:create', testRoles)).toBe(true)
  })

  it('should return false for missing permission', () => {
    const user: User = { id: '1', roles: ['user'] }
    expect(hasPermission(user, 'posts:delete', testRoles)).toBe(false)
    expect(hasPermission(user, 'users:read', testRoles)).toBe(false)
  })

  it('should support wildcard permission', () => {
    const user: User = { id: '1', roles: ['admin'] }
    expect(hasPermission(user, 'posts:delete', testRoles)).toBe(true)
    expect(hasPermission(user, 'users:delete', testRoles)).toBe(true)
    expect(hasPermission(user, 'anything:anything', testRoles)).toBe(true)
  })

  it('should aggregate permissions from multiple roles (AC7)', () => {
    const user: User = { id: '1', roles: ['editor', 'moderator'] }

    // From editor
    expect(hasPermission(user, 'posts:create', testRoles)).toBe(true)

    // From moderator
    expect(hasPermission(user, 'posts:delete', testRoles)).toBe(true)
    expect(hasPermission(user, 'users:read', testRoles)).toBe(true)

    // From both
    expect(hasPermission(user, 'posts:read', testRoles)).toBe(true)
    expect(hasPermission(user, 'posts:update', testRoles)).toBe(true)
  })

  it('should deny by default when user has no roles (AC8)', () => {
    const user: User = { id: '1', roles: [] }
    expect(hasPermission(user, 'posts:read', testRoles)).toBe(false)
  })

  it('should deny by default when permission is undefined (AC8)', () => {
    const user: User = { id: '1', roles: ['user'] }
    expect(hasPermission(user, 'posts:publish', testRoles)).toBe(false)
  })

  it('should deny when user is invalid', () => {
    // @ts-expect-error - Testing runtime validation
    expect(hasPermission(null, 'posts:read', testRoles)).toBe(false)

    // @ts-expect-error - Testing runtime validation
    expect(hasPermission({ id: '1' }, 'posts:read', testRoles)).toBe(false)

    // @ts-expect-error - Testing runtime validation
    expect(hasPermission({ id: '1', roles: 'not-array' }, 'posts:read', testRoles)).toBe(false)
  })

  it('should deny when permission is invalid', () => {
    const user: User = { id: '1', roles: ['user'] }

    // @ts-expect-error - Testing runtime validation
    expect(hasPermission(user, null, testRoles)).toBe(false)

    // @ts-expect-error - Testing runtime validation
    expect(hasPermission(user, 123, testRoles)).toBe(false)

    expect(hasPermission(user, '', testRoles)).toBe(false)
  })

  it('should handle unknown roles gracefully', () => {
    const user: User = { id: '1', roles: ['nonexistent'] }
    expect(hasPermission(user, 'posts:read', testRoles)).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('should return true if user has any of the permissions', () => {
    const user: User = { id: '1', roles: ['user'] }

    expect(hasAnyPermission(user, ['posts:read', 'posts:delete'], testRoles)).toBe(true) // Has posts:read
    expect(hasAnyPermission(user, ['posts:delete', 'posts:create'], testRoles)).toBe(true) // Has posts:create
  })

  it('should return false if user has none of the permissions', () => {
    const user: User = { id: '1', roles: ['user'] }

    expect(hasAnyPermission(user, ['posts:delete', 'users:read'], testRoles)).toBe(false)
  })

  it('should work with empty array', () => {
    const user: User = { id: '1', roles: ['user'] }

    expect(hasAnyPermission(user, [], testRoles)).toBe(false)
  })
})

describe('hasAllPermissions', () => {
  it('should return true if user has all permissions', () => {
    const user: User = { id: '1', roles: ['user'] }

    expect(hasAllPermissions(user, ['posts:read', 'posts:create'], testRoles)).toBe(true)
  })

  it('should return false if user is missing any permission', () => {
    const user: User = { id: '1', roles: ['user'] }

    expect(hasAllPermissions(user, ['posts:read', 'posts:delete'], testRoles)).toBe(false)
  })

  it('should work with empty array', () => {
    const user: User = { id: '1', roles: ['user'] }

    expect(hasAllPermissions(user, [], testRoles)).toBe(true) // Vacuous truth
  })
})

describe('getUserPermissions', () => {
  it('should return all permissions for a user with single role', () => {
    const user: User = { id: '1', roles: ['user'] }

    const perms = getUserPermissions(user, testRoles)
    expect(perms).toContain('posts:read')
    expect(perms).toContain('posts:create')
    expect(perms).toHaveLength(2)
  })

  it('should aggregate permissions from multiple roles', () => {
    const user: User = { id: '1', roles: ['editor', 'moderator'] }

    const perms = getUserPermissions(user, testRoles)

    // From editor
    expect(perms).toContain('posts:create')

    // From moderator
    expect(perms).toContain('posts:delete')
    expect(perms).toContain('users:read')

    // From both (deduplicated)
    expect(perms).toContain('posts:read')
    expect(perms).toContain('posts:update')
  })

  it('should deduplicate permissions', () => {
    const user: User = { id: '1', roles: ['editor', 'moderator'] }

    const perms = getUserPermissions(user, testRoles)
    const readCount = perms.filter((p) => p === 'posts:read').length
    expect(readCount).toBe(1) // Should only appear once
  })

  it('should return empty array for user with no roles', () => {
    const user: User = { id: '1', roles: [] }

    const perms = getUserPermissions(user, testRoles)
    expect(perms).toEqual([])
  })

  it('should return empty array for invalid user', () => {
    // @ts-expect-error - Testing runtime validation
    expect(getUserPermissions(null, testRoles)).toEqual([])

    // @ts-expect-error - Testing runtime validation
    expect(getUserPermissions({ id: '1' }, testRoles)).toEqual([])
  })
})

describe('Resource wildcard matching', () => {
  const rolesWithWildcards = defineRoles({
    postsAdmin: {
      permissions: ['posts:*'], // All post actions
    },
    fullAdmin: {
      permissions: ['*'], // Everything
    },
  })

  it('should match resource wildcard', () => {
    const user: User = { id: '1', roles: ['postsAdmin'] }

    expect(hasPermission(user, 'posts:read', rolesWithWildcards)).toBe(true)
    expect(hasPermission(user, 'posts:create', rolesWithWildcards)).toBe(true)
    expect(hasPermission(user, 'posts:delete', rolesWithWildcards)).toBe(true)
    expect(hasPermission(user, 'users:read', rolesWithWildcards)).toBe(false) // Different resource
  })

  it('should match global wildcard', () => {
    const user: User = { id: '1', roles: ['fullAdmin'] }

    expect(hasPermission(user, 'posts:delete', rolesWithWildcards)).toBe(true)
    expect(hasPermission(user, 'users:delete', rolesWithWildcards)).toBe(true)
    expect(hasPermission(user, 'anything:action', rolesWithWildcards)).toBe(true)
  })
})
