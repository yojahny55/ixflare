/**
 * @file tests/auth/rbac/roles.test.ts
 * @description Tests for role definition and permission aggregation
 * Story 5-4: Authorization with RBAC + Policies
 */

import { describe, it, expect } from 'vitest'
import { defineRoles, getRolePermissions } from '@/auth/rbac/roles'

describe('defineRoles', () => {
  it('should define roles with permissions', () => {
    const roles = defineRoles({
      admin: {
        permissions: ['*'],
      },
      user: {
        permissions: ['posts:read', 'posts:create'],
      },
    })

    expect(roles.admin.permissions).toEqual(['*'])
    expect(roles.user.permissions).toEqual(['posts:read', 'posts:create'])
  })

  it('should validate permission format', () => {
    expect(() =>
      defineRoles({
        invalid: {
          permissions: ['invalid-format'], // Missing colon
        },
      })
    ).toThrow('must be in format "resource:action" or "*"')
  })

  it('should allow wildcard permission', () => {
    const roles = defineRoles({
      admin: {
        permissions: ['*'],
      },
    })

    expect(roles.admin.permissions).toEqual(['*'])
  })

  it('should validate permissions array', () => {
    expect(() =>
      defineRoles({
        invalid: {
          // @ts-expect-error - Testing runtime validation
          permissions: 'not-an-array',
        },
      })
    ).toThrow('must have a permissions array')
  })

  it('should validate permission strings', () => {
    expect(() =>
      defineRoles({
        invalid: {
          // @ts-expect-error - Testing runtime validation
          permissions: [123],
        },
      })
    ).toThrow('Permission in role "invalid" must be a string')
  })

  it('should support role inheritance', () => {
    const roles = defineRoles({
      user: {
        permissions: ['posts:read'],
      },
      moderator: {
        permissions: ['posts:delete'],
        inherits: ['user'],
      },
    })

    expect(roles.moderator.inherits).toEqual(['user'])
  })

  it('should validate inherited roles exist', () => {
    expect(() =>
      defineRoles({
        moderator: {
          permissions: ['posts:delete'],
          inherits: ['nonexistent'],
        },
      })
    ).toThrow('inherits from undefined role "nonexistent"')
  })

  it('should validate inherits is an array', () => {
    expect(() =>
      defineRoles({
        moderator: {
          permissions: ['posts:delete'],
          // @ts-expect-error - Testing runtime validation
          inherits: 'user',
        },
      })
    ).toThrow('inherits must be an array')
  })
})

describe('getRolePermissions', () => {
  it('should return permissions for a role', () => {
    const roles = defineRoles({
      user: {
        permissions: ['posts:read', 'posts:create'],
      },
    })

    const perms = getRolePermissions(roles, 'user')
    expect(perms).toEqual(['posts:read', 'posts:create'])
  })

  it('should return empty array for unknown role', () => {
    const roles = defineRoles({
      user: {
        permissions: ['posts:read'],
      },
    })

    const perms = getRolePermissions(roles, 'unknown' as any)
    expect(perms).toEqual([])
  })

  it('should aggregate permissions from inherited roles', () => {
    const roles = defineRoles({
      user: {
        permissions: ['posts:read'],
      },
      moderator: {
        permissions: ['posts:delete'],
        inherits: ['user'],
      },
    })

    const perms = getRolePermissions(roles, 'moderator')
    expect(perms).toContain('posts:read') // From user
    expect(perms).toContain('posts:delete') // From moderator
  })

  it('should handle multiple inheritance levels', () => {
    const roles = defineRoles({
      viewer: {
        permissions: ['posts:read'],
      },
      user: {
        permissions: ['posts:create'],
        inherits: ['viewer'],
      },
      moderator: {
        permissions: ['posts:delete'],
        inherits: ['user'],
      },
    })

    const perms = getRolePermissions(roles, 'moderator')
    expect(perms).toContain('posts:read') // From viewer
    expect(perms).toContain('posts:create') // From user
    expect(perms).toContain('posts:delete') // From moderator
  })

  it('should detect circular inheritance', () => {
    const roles = {
      roleA: {
        permissions: ['posts:read'],
        inherits: ['roleB'],
      },
      roleB: {
        permissions: ['posts:create'],
        inherits: ['roleA'], // Circular!
      },
    }

    expect(() => getRolePermissions(roles, 'roleA')).toThrow('Circular role inheritance detected')
  })

  it('should deduplicate permissions from multiple inheritance paths', () => {
    const roles = defineRoles({
      base: {
        permissions: ['posts:read'],
      },
      roleA: {
        permissions: ['posts:create'],
        inherits: ['base'],
      },
      roleB: {
        permissions: ['posts:update'],
        inherits: ['base'],
      },
      combined: {
        permissions: ['posts:delete'],
        inherits: ['roleA', 'roleB'],
      },
    })

    const perms = getRolePermissions(roles, 'combined')
    const readCount = perms.filter((p) => p === 'posts:read').length
    expect(readCount).toBe(1) // Should only appear once despite two inheritance paths
  })
})
