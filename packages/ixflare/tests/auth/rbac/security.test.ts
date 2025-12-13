/**
 * @file tests/auth/rbac/security.test.ts
 * @description Security-focused tests for RBAC (MANDATORY for Epic 5)
 * Story 5-4: Authorization with RBAC + Policies
 *
 * Tests cover:
 * - Privilege escalation prevention
 * - Horizontal access prevention
 * - Deny-by-default enforcement
 * - Role hierarchy bypass attempts
 * - Permission injection attacks
 * - Session role tampering prevention
 * - Wildcard permission edge cases
 */

import { describe, it, expect } from 'vitest'
import { defineRoles, getRolePermissions } from '@/auth/rbac/roles'
import { hasPermission } from '@/auth/rbac/permissions'
import { definePolicy } from '@/auth/rbac/policies'
import { requireRole, requirePermission } from '@/auth/rbac/middleware'
import { extractUserFromSession } from '@/auth/rbac/session-integration'
import type { User } from '@/auth/rbac/types'
import type { SessionData } from '@/auth/session/types'

const securityRoles = defineRoles({
  superadmin: {
    permissions: ['*'],
  },
  admin: {
    permissions: ['users:*', 'posts:*', 'settings:*'],
  },
  moderator: {
    permissions: ['posts:read', 'posts:update', 'posts:delete', 'users:read'],
  },
  user: {
    permissions: ['posts:read', 'posts:create'],
  },
})

describe('Security: Privilege Escalation Prevention', () => {
  it('should prevent user from granting self higher role', () => {
    // User cannot simply add admin to their roles array
    const user: User = { id: '1', roles: ['user'] }

    expect(hasPermission(user, 'users:delete', securityRoles)).toBe(false)

    // Even if they try to modify roles client-side
    const tamperedUser: User = { id: '1', roles: ['user', 'admin'] }
    // This would work IF the session/JWT was tampered (but JWT signature prevents this)
    // The test verifies that IF roles come from session, they must be validated
    expect(hasPermission(tamperedUser, 'users:delete', securityRoles)).toBe(true)
    // ^^ This is why roles MUST come from signed JWT (Story 5-1)
  })

  it('should prevent role escalation through permission injection', () => {
    const user: User = { id: '1', roles: ['user'] }

    // Try to inject wildcard via malformed permission
    expect(hasPermission(user, '*', securityRoles)).toBe(false)

    // Try to inject admin permission
    expect(hasPermission(user, 'users:delete', securityRoles)).toBe(false)

    // Try permission with injection attempt
    expect(hasPermission(user, 'posts:read; users:*', securityRoles)).toBe(false)
  })

  it('should validate roles come from trusted source (JWT)', () => {
    // In real usage, roles come from JWT payload which is signature-verified
    // This test documents the trust boundary

    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'user', // This comes from signed JWT
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const user = extractUserFromSession(session)

    // User extracted from session has validated roles
    expect(user.roles).toEqual(['user'])

    // Cannot escalate without re-signing JWT (requires secret key)
    expect(hasPermission(user, 'users:delete', securityRoles)).toBe(false)
  })

  it('should deny when user tries to grant self superadmin wildcard', () => {
    const user: User = { id: '1', roles: ['user'] }

    // User role doesn't have wildcard
    expect(hasPermission(user, 'system:shutdown', securityRoles)).toBe(false)
    expect(hasPermission(user, 'admin:create', securityRoles)).toBe(false)
    expect(hasPermission(user, 'anything:anything', securityRoles)).toBe(false)
  })
})

describe('Security: Horizontal Access Prevention', () => {
  interface Resource {
    id: string
    authorId: string
    companyId: string
  }

  const resourcePolicy = definePolicy<User & { companyId: string }, Resource>({
    view: (user, resource) => {
      // Can only view own company resources
      return user.companyId === resource.companyId
    },
    update: (user, resource) => {
      // Can only update own resources
      return user.id === resource.authorId
    },
    delete: (user, resource) => {
      // Can only delete own resources
      return user.id === resource.authorId
    },
  })

  it('should prevent user from accessing other user resources', () => {
    const user1 = { id: 'user1', roles: ['user'], companyId: 'company1' }
    const user2Resource: Resource = {
      id: 'r1',
      authorId: 'user2',
      companyId: 'company1',
    }

    // User 1 can view (same company) but not modify user 2's resource
    expect(resourcePolicy.can(user1, 'view', user2Resource)).toBe(true)
    expect(resourcePolicy.can(user1, 'update', user2Resource)).toBe(false)
    expect(resourcePolicy.can(user1, 'delete', user2Resource)).toBe(false)
  })

  it('should prevent cross-company access', () => {
    const user1 = { id: 'user1', roles: ['user'], companyId: 'company1' }
    const company2Resource: Resource = {
      id: 'r1',
      authorId: 'user2',
      companyId: 'company2',
    }

    // User from company1 cannot access company2 resources
    expect(resourcePolicy.can(user1, 'view', company2Resource)).toBe(false)
    expect(resourcePolicy.can(user1, 'update', company2Resource)).toBe(false)
    expect(resourcePolicy.can(user1, 'delete', company2Resource)).toBe(false)
  })

  it('should allow access to own resources only', () => {
    const user1 = { id: 'user1', roles: ['user'], companyId: 'company1' }
    const ownResource: Resource = {
      id: 'r1',
      authorId: 'user1',
      companyId: 'company1',
    }

    expect(resourcePolicy.can(user1, 'view', ownResource)).toBe(true)
    expect(resourcePolicy.can(user1, 'update', ownResource)).toBe(true)
    expect(resourcePolicy.can(user1, 'delete', ownResource)).toBe(true)
  })

  it('should prevent ID manipulation attacks', () => {
    const user1 = { id: 'user1', roles: ['user'], companyId: 'company1' }

    // Attacker tries to modify authorId in request
    const manipulatedResource: Resource = {
      id: 'r1',
      authorId: 'user1', // Claimed to be user1's resource
      companyId: 'company2', // But actually from company2
    }

    // Policy checks ACTUAL resource data from database, not request claims
    expect(resourcePolicy.can(user1, 'view', manipulatedResource)).toBe(false)
  })
})

describe('Security: Deny by Default (OWASP)', () => {
  it('should deny when permission is not explicitly granted', () => {
    const user: User = { id: '1', roles: ['user'] }

    // User role only has posts:read and posts:create
    expect(hasPermission(user, 'posts:delete', securityRoles)).toBe(false)
    expect(hasPermission(user, 'users:read', securityRoles)).toBe(false)
    expect(hasPermission(user, 'settings:update', securityRoles)).toBe(false)
  })

  it('should deny when role is not defined', () => {
    const user: User = { id: '1', roles: ['nonexistent'] }

    expect(hasPermission(user, 'posts:read', securityRoles)).toBe(false)
    expect(hasPermission(user, 'anything', securityRoles)).toBe(false)
  })

  it('should deny when user has no roles', () => {
    const user: User = { id: '1', roles: [] }

    expect(hasPermission(user, 'posts:read', securityRoles)).toBe(false)
  })

  it('should deny when user object is invalid', () => {
    // @ts-expect-error - Testing invalid input
    expect(hasPermission(null, 'posts:read', securityRoles)).toBe(false)

    // @ts-expect-error - Testing invalid input
    expect(hasPermission(undefined, 'posts:read', securityRoles)).toBe(false)

    // @ts-expect-error - Testing malformed user
    expect(hasPermission({ id: '1' }, 'posts:read', securityRoles)).toBe(false)
  })

  it('should deny when permission is invalid', () => {
    const user: User = { id: '1', roles: ['user'] }

    // @ts-expect-error - Testing invalid permission
    expect(hasPermission(user, null, securityRoles)).toBe(false)

    expect(hasPermission(user, '', securityRoles)).toBe(false)

    // @ts-expect-error - Testing invalid permission
    expect(hasPermission(user, 123, securityRoles)).toBe(false)
  })

  it('should deny by default in policies', () => {
    const policy = definePolicy({
      read: () => true,
    })

    const user = { id: '1', roles: ['user'] }
    const resource = { id: 'r1' }

    // Defined action is allowed
    expect(policy.can(user, 'read', resource)).toBe(true)

    // Undefined action is denied (no write permission defined)
    // @ts-expect-error - Testing undefined action
    expect(policy.can(user, 'write', resource)).toBe(false)
  })
})

describe('Security: Role Hierarchy Bypass Attempts', () => {
  const hierarchyRoles = defineRoles({
    admin: {
      permissions: ['*'],
    },
    editor: {
      permissions: ['posts:*'],
      inherits: ['viewer'],
    },
    viewer: {
      permissions: ['posts:read'],
    },
  })

  it('should prevent bypassing hierarchy through role order', () => {
    // User with lower roles shouldn't gain higher permissions
    const user: User = { id: '1', roles: ['viewer'] }

    expect(hasPermission(user, 'posts:read', hierarchyRoles)).toBe(true)
    expect(hasPermission(user, 'posts:update', hierarchyRoles)).toBe(false)
    expect(hasPermission(user, 'posts:delete', hierarchyRoles)).toBe(false)
  })

  it('should correctly inherit permissions without escalation', () => {
    const editor: User = { id: '1', roles: ['editor'] }

    // Editor inherits viewer's permissions
    expect(hasPermission(editor, 'posts:read', hierarchyRoles)).toBe(true)

    // Editor has posts:* wildcard
    expect(hasPermission(editor, 'posts:update', hierarchyRoles)).toBe(true)
    expect(hasPermission(editor, 'posts:delete', hierarchyRoles)).toBe(true)

    // Editor doesn't have admin permissions
    expect(hasPermission(editor, 'users:delete', hierarchyRoles)).toBe(false)
  })

  it('should detect circular inheritance (security vulnerability)', () => {
    expect(() =>
      getRolePermissions(
        {
          roleA: { permissions: [], inherits: ['roleB'] },
          roleB: { permissions: [], inherits: ['roleA'] },
        },
        'roleA'
      )
    ).toThrow('Circular role inheritance detected')
  })
})

describe('Security: Permission Injection Attacks', () => {
  it('should reject malformed permission strings', () => {
    expect(() =>
      defineRoles({
        hacker: {
          permissions: ['invalid-format'], // Missing colon
        },
      })
    ).toThrow('must be in format "resource:action" or "*"')
  })

  it('should not allow SQL injection in permission strings', () => {
    const user: User = { id: '1', roles: ['user'] }

    // Try SQL injection in permission
    expect(hasPermission(user, "posts:read'; DROP TABLE users--", securityRoles)).toBe(false)

    // Try code injection
    expect(hasPermission(user, 'posts:read; console.log("hacked")', securityRoles)).toBe(false)
  })

  it('should not allow wildcard injection', () => {
    const user: User = { id: '1', roles: ['user'] }

    // Try to inject wildcard
    expect(hasPermission(user, 'posts:*', securityRoles)).toBe(false)

    // Try to inject global wildcard
    expect(hasPermission(user, '*', securityRoles)).toBe(false)
  })

  it('should validate permission format at role definition', () => {
    // Empty permission
    expect(() =>
      defineRoles({
        invalid: {
          permissions: [''],
        },
      })
    ).toThrow()

    // Non-string permission
    expect(() =>
      defineRoles({
        invalid: {
          // @ts-expect-error - Testing runtime validation
          permissions: [null],
        },
      })
    ).toThrow()
  })
})

describe('Security: Session Role Tampering Prevention', () => {
  it('should extract roles from session consistently', () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'user',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const user = extractUserFromSession(session)

    // Roles come from session, which comes from JWT
    expect(user.roles).toEqual(['user'])
  })

  it('should not trust client-provided roles', () => {
    // In real implementation, roles come from JWT payload
    // JWT signature verification (Story 5-1) prevents tampering

    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'user', // This is signed in JWT
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const user = extractUserFromSession(session)

    // Cannot escalate without re-signing JWT
    expect(user.roles).toEqual(['user'])
    expect(hasPermission(user, 'users:delete', securityRoles)).toBe(false)
  })

  it('should handle session with missing role safely', () => {
    const session = {
      sessionId: 's1',
      userId: 'user1',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
      // No role
    } as any

    const user = extractUserFromSession(session)

    // No role means no permissions (deny by default)
    expect(user.roles).toEqual([])
    expect(hasPermission(user, 'posts:read', securityRoles)).toBe(false)
  })
})

describe('Security: Wildcard Permission Edge Cases', () => {
  const wildcardRoles = defineRoles({
    superadmin: {
      permissions: ['*'], // Global wildcard
    },
    postsAdmin: {
      permissions: ['posts:*'], // Resource wildcard
    },
    user: {
      permissions: ['posts:read', 'posts:create'],
    },
  })

  it('should only grant global wildcard to superadmin', () => {
    const superadmin: User = { id: '1', roles: ['superadmin'] }
    const user: User = { id: '2', roles: ['user'] }

    // Superadmin has global wildcard
    expect(hasPermission(superadmin, 'anything:anything', wildcardRoles)).toBe(true)

    // User does not
    expect(hasPermission(user, 'users:delete', wildcardRoles)).toBe(false)
  })

  it('should limit resource wildcards to specific resource', () => {
    const postsAdmin: User = { id: '1', roles: ['postsAdmin'] }

    // Posts admin has posts:* wildcard
    expect(hasPermission(postsAdmin, 'posts:read', wildcardRoles)).toBe(true)
    expect(hasPermission(postsAdmin, 'posts:delete', wildcardRoles)).toBe(true)

    // But not other resources
    expect(hasPermission(postsAdmin, 'users:read', wildcardRoles)).toBe(false)
    expect(hasPermission(postsAdmin, 'settings:update', wildcardRoles)).toBe(false)
  })

  it('should not allow wildcard escalation', () => {
    const user: User = { id: '1', roles: ['user'] }

    // User cannot escalate to wildcard
    expect(hasPermission(user, '*', wildcardRoles)).toBe(false)
    expect(hasPermission(user, 'posts:*', wildcardRoles)).toBe(false)
  })

  it('should handle multiple wildcards correctly', () => {
    const multiWildcard: User = { id: '1', roles: ['superadmin', 'postsAdmin'] }

    // Having multiple roles with wildcards should work
    expect(hasPermission(multiWildcard, 'posts:delete', wildcardRoles)).toBe(true)
    expect(hasPermission(multiWildcard, 'users:delete', wildcardRoles)).toBe(true)
  })
})

describe('Security: Input Validation (OWASP)', () => {
  it('should validate user input in middleware', async () => {
    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'GET',
      headers: new Headers(),
      // Malformed user object
      user: { id: '1' }, // Missing roles
    } as any

    const middleware = requireRole('admin')
    const next = async () => new Response('OK')

    // Should throw error for malformed user
    await expect(middleware(ctx, next)).rejects.toThrow('User object is malformed')
  })

  it('should sanitize error messages (no information leakage)', () => {
    const user: User = { id: '1', roles: ['user'] }

    try {
      const policy = definePolicy({
        delete: (u, r) => u.id === (r as any).authorId,
      })
      policy.authorize(user, 'delete', { id: 'r1', authorId: 'other' })
    } catch (error: any) {
      // Error message should be generic (no resource or action details)
      expect(error.message).not.toContain('r1')
      expect(error.message).not.toContain('other')
      expect(error.message).not.toContain('delete') // Action name not leaked
      expect(error.message).toBe('Insufficient permissions')
    }
  })
})
