/**
 * @file tests/auth/rbac/middleware.test.ts
 * @description Tests for authorization middleware
 * Story 5-4: Authorization with RBAC + Policies
 */

import { describe, it, expect, vi } from 'vitest'
import {
  requireRole,
  requireAnyRole,
  requireAllRoles,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
} from '@/auth/rbac/middleware'
import { defineRoles } from '@/auth/rbac/roles'
import { PermissionDeniedError, RoleDeniedError } from '@/auth/rbac/errors'
import { AuthError } from '@/errors'
import type { EdgeContext } from '@/types/context'
import type { User } from '@/auth/rbac/types'

const testRoles = defineRoles({
  admin: {
    permissions: ['*'],
  },
  moderator: {
    permissions: ['posts:read', 'posts:update', 'posts:delete', 'users:read'],
  },
  user: {
    permissions: ['posts:read', 'posts:create'],
  },
})

// Mock EdgeContext
function createMockContext(user?: User): EdgeContext {
  return {
    request: new Request('https://example.com'),
    env: {},
    ctx: {} as ExecutionContext,
    params: {},
    query: new URLSearchParams(),
    url: new URL('https://example.com'),
    method: 'GET',
    headers: new Headers(),
    user, // Attach user (normally done by auth middleware)
  } as any
}

const mockNext = vi.fn(async () => new Response('OK'))

describe('requireRole', () => {
  it('should allow access when user has required role (AC2)', async () => {
    const user: User = { id: '1', roles: ['admin'] }
    const ctx = createMockContext(user)
    const middleware = requireRole('admin')

    const response = await middleware(ctx, mockNext)

    expect(response.status).toBe(200)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should deny access when user lacks required role (AC2)', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireRole('admin')

    await expect(middleware(ctx, mockNext)).rejects.toThrow(RoleDeniedError)
  })

  it('should throw AuthError when user is not authenticated (AC2)', async () => {
    const ctx = createMockContext() // No user
    const middleware = requireRole('admin')

    await expect(middleware(ctx, mockNext)).rejects.toThrow(AuthError)
    await expect(middleware(ctx, mockNext)).rejects.toThrow('Authentication required')
  })

  it('should return 403 error response with structured format (AC2)', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireRole('admin')

    try {
      await middleware(ctx, mockNext)
      expect.fail('Should have thrown RoleDeniedError')
    } catch (error) {
      expect(error).toBeInstanceOf(RoleDeniedError)
      const roleDeniedError = error as RoleDeniedError
      expect(roleDeniedError.status).toBe(403)
      expect(roleDeniedError.code).toBe('FORBIDDEN')

      // Check error doesn't leak role details
      const json = roleDeniedError.toJSON()
      expect(json.error.message).toBe('Insufficient permissions')
      expect(json.error.status).toBe(403)
    }
  })

  it('should handle malformed user object', async () => {
    const ctx = createMockContext({ id: '1' } as any) // Missing roles
    const middleware = requireRole('admin')

    await expect(middleware(ctx, mockNext)).rejects.toThrow(AuthError)
    await expect(middleware(ctx, mockNext)).rejects.toThrow('User object is malformed')
  })
})

describe('requireAnyRole', () => {
  it('should allow access when user has any required role', async () => {
    const user: User = { id: '1', roles: ['moderator'] }
    const ctx = createMockContext(user)
    const middleware = requireAnyRole(['admin', 'moderator'])

    const response = await middleware(ctx, mockNext)

    expect(response.status).toBe(200)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should deny access when user has none of the required roles', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireAnyRole(['admin', 'moderator'])

    await expect(middleware(ctx, mockNext)).rejects.toThrow(RoleDeniedError)
  })

  it('should allow when user has multiple roles and one matches', async () => {
    const user: User = { id: '1', roles: ['user', 'moderator'] }
    const ctx = createMockContext(user)
    const middleware = requireAnyRole(['admin', 'moderator'])

    const response = await middleware(ctx, mockNext)
    expect(response.status).toBe(200)
  })
})

describe('requireAllRoles', () => {
  it('should allow access when user has all required roles', async () => {
    const user: User = { id: '1', roles: ['user', 'moderator'] }
    const ctx = createMockContext(user)
    const middleware = requireAllRoles(['user', 'moderator'])

    const response = await middleware(ctx, mockNext)

    expect(response.status).toBe(200)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should deny access when user is missing any required role', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireAllRoles(['user', 'moderator'])

    await expect(middleware(ctx, mockNext)).rejects.toThrow(RoleDeniedError)
  })

  it('should deny when user has only some of the required roles', async () => {
    const user: User = { id: '1', roles: ['user', 'moderator'] }
    const ctx = createMockContext(user)
    const middleware = requireAllRoles(['user', 'moderator', 'admin'])

    await expect(middleware(ctx, mockNext)).rejects.toThrow(RoleDeniedError)
  })
})

describe('requirePermission', () => {
  it('should allow access when user has required permission (AC3)', async () => {
    const user: User = { id: '1', roles: ['moderator'] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('posts:delete', testRoles)

    const response = await middleware(ctx, mockNext)

    expect(response.status).toBe(200)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should deny access when user lacks required permission (AC3)', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('posts:delete', testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(PermissionDeniedError)
  })

  it('should respect wildcard permissions (AC3)', async () => {
    const user: User = { id: '1', roles: ['admin'] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('posts:delete', testRoles)

    const response = await middleware(ctx, mockNext)
    expect(response.status).toBe(200)
  })

  it('should throw AuthError when user is not authenticated', async () => {
    const ctx = createMockContext()
    const middleware = requirePermission('posts:delete', testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(AuthError)
  })

  it('should return structured 403 error response (AC3)', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('posts:delete', testRoles)

    try {
      await middleware(ctx, mockNext)
      expect.fail('Should have thrown PermissionDeniedError')
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError)
      const permError = error as PermissionDeniedError
      expect(permError.status).toBe(403)

      // Check error doesn't leak permission details
      const json = permError.toJSON()
      expect(json.error.message).toBe('Insufficient permissions')
      expect(json.error.status).toBe(403)
      expect(json.error).not.toHaveProperty('requiredPermission')
      expect(json.error).not.toHaveProperty('userPermissions')
    }
  })

  it('should deny by default when permission is undefined (AC8)', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('posts:publish', testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(PermissionDeniedError)
  })
})

describe('requireAnyPermission', () => {
  it('should allow access when user has any required permission', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireAnyPermission(['posts:delete', 'posts:create'], testRoles)

    const response = await middleware(ctx, mockNext)

    expect(response.status).toBe(200)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should deny access when user has none of the required permissions', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireAnyPermission(['posts:delete', 'users:read'], testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(PermissionDeniedError)
  })
})

describe('requireAllPermissions', () => {
  it('should allow access when user has all required permissions', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireAllPermissions(['posts:read', 'posts:create'], testRoles)

    const response = await middleware(ctx, mockNext)

    expect(response.status).toBe(200)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should deny access when user is missing any required permission', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requireAllPermissions(['posts:read', 'posts:delete'], testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(PermissionDeniedError)
  })
})

describe('Deny by default (AC8, OWASP)', () => {
  it('should deny when user has no roles', async () => {
    const user: User = { id: '1', roles: [] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('posts:read', testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(PermissionDeniedError)
  })

  it('should deny when user object is missing', async () => {
    const ctx = createMockContext()
    const middleware = requirePermission('posts:read', testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(AuthError)
  })

  it('should deny when permission string is invalid', async () => {
    const user: User = { id: '1', roles: ['user'] }
    const ctx = createMockContext(user)
    const middleware = requirePermission('', testRoles)

    await expect(middleware(ctx, mockNext)).rejects.toThrow(PermissionDeniedError)
  })
})
