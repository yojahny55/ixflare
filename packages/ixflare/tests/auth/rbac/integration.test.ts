/**
 * @file tests/auth/rbac/integration.test.ts
 * @description Integration tests for RBAC with session management
 * Story 5-4: Authorization with RBAC + Policies
 */

import { describe, it, expect, vi } from 'vitest'
import { extractUserFromSession, injectUser } from '@/auth/rbac/session-integration'
import { requireRole, requirePermission } from '@/auth/rbac/middleware'
import { defineRoles } from '@/auth/rbac/roles'
import type { SessionData } from '@/auth/session/types'
import type { EdgeContext } from '@/types/context'

const testRoles = defineRoles({
  admin: {
    permissions: ['*'],
  },
  moderator: {
    permissions: ['posts:read', 'posts:update', 'posts:delete'],
  },
  user: {
    permissions: ['posts:read', 'posts:create'],
  },
})

describe('extractUserFromSession', () => {
  it('should extract user from session with single role', () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'admin',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const user = extractUserFromSession(session)

    expect(user.id).toBe('user1')
    expect(user.roles).toEqual(['admin'])
  })

  it('should extract user from session with multiple roles (future support)', () => {
    const session = {
      sessionId: 's1',
      userId: 'user1',
      role: 'user',
      roles: ['user', 'moderator'], // Future support
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    } as any

    const user = extractUserFromSession(session)

    expect(user.id).toBe('user1')
    expect(user.roles).toEqual(['user', 'moderator'])
  })

  it('should handle session with no role', () => {
    const session = {
      sessionId: 's1',
      userId: 'user1',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    } as any

    const user = extractUserFromSession(session)

    expect(user.id).toBe('user1')
    expect(user.roles).toEqual([])
  })

  it('should include session data in user object', () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'admin',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
      device: 'Mozilla/5.0...',
    }

    const user = extractUserFromSession(session)

    expect(user.id).toBe('user1')
    expect(user.roles).toEqual(['admin'])
    expect(user).toHaveProperty('sessionId', 's1')
    expect(user).toHaveProperty('device')
  })
})

describe('injectUser middleware', () => {
  it('should inject user from session into context', async () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'admin',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'GET',
      headers: new Headers(),
      session, // Set by session middleware
    } as any

    const next = vi.fn(async () => new Response('OK'))
    const middleware = injectUser()

    await middleware(ctx, next)

    expect(ctx.user).toBeDefined()
    expect(ctx.user.id).toBe('user1')
    expect(ctx.user.roles).toEqual(['admin'])
    expect(next).toHaveBeenCalled()
  })

  it('should handle missing session gracefully', async () => {
    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'GET',
      headers: new Headers(),
      // No session
    } as any

    const next = vi.fn(async () => new Response('OK'))
    const middleware = injectUser()

    await middleware(ctx, next)

    expect(ctx.user).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })

  it('should support custom session key', async () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'admin',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'GET',
      headers: new Headers(),
      customSession: session, // Custom key
    } as any

    const next = vi.fn(async () => new Response('OK'))
    const middleware = injectUser('customSession')

    await middleware(ctx, next)

    expect(ctx.user).toBeDefined()
    expect(ctx.user.id).toBe('user1')
  })
})

describe('End-to-end: Session + RBAC middleware chain', () => {
  it('should work with full middleware chain', async () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'admin',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'GET',
      headers: new Headers(),
      session,
    } as any

    const finalHandler = vi.fn(async () => new Response('Protected Content'))

    // Simulate middleware chain
    const injectUserMw = injectUser()
    const requireAdminMw = requireRole('admin')

    // Execute chain
    await injectUserMw(ctx, async () => {
      return requireAdminMw(ctx, finalHandler)
    })

    expect(ctx.user).toBeDefined()
    expect(ctx.user.roles).toEqual(['admin'])
    expect(finalHandler).toHaveBeenCalled()
  })

  it('should deny access when user lacks required role', async () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'user', // Not admin
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'GET',
      headers: new Headers(),
      session,
    } as any

    const finalHandler = vi.fn(async () => new Response('Protected Content'))

    const injectUserMw = injectUser()
    const requireAdminMw = requireRole('admin')

    await expect(
      injectUserMw(ctx, async () => {
        return requireAdminMw(ctx, finalHandler)
      })
    ).rejects.toThrow()

    expect(finalHandler).not.toHaveBeenCalled()
  })

  it('should work with permission-based middleware', async () => {
    const session: SessionData = {
      sessionId: 's1',
      userId: 'user1',
      role: 'moderator',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    }

    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'DELETE',
      headers: new Headers(),
      session,
    } as any

    const finalHandler = vi.fn(async () => new Response('Post deleted'))

    const injectUserMw = injectUser()
    const requireDeleteMw = requirePermission('posts:delete', testRoles)

    await injectUserMw(ctx, async () => {
      return requireDeleteMw(ctx, finalHandler)
    })

    expect(ctx.user).toBeDefined()
    expect(finalHandler).toHaveBeenCalled()
  })

  it('should support multiple roles from session (AC7)', async () => {
    const session = {
      sessionId: 's1',
      userId: 'user1',
      role: 'user',
      roles: ['user', 'moderator'], // Multiple roles
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
    } as any

    const ctx = {
      request: new Request('https://example.com'),
      env: {},
      ctx: {} as ExecutionContext,
      params: {},
      query: new URLSearchParams(),
      url: new URL('https://example.com'),
      method: 'DELETE',
      headers: new Headers(),
      session,
    } as any

    const finalHandler = vi.fn(async () => new Response('Post deleted'))

    const injectUserMw = injectUser()
    const requireDeleteMw = requirePermission('posts:delete', testRoles) // moderator has this

    await injectUserMw(ctx, async () => {
      return requireDeleteMw(ctx, finalHandler)
    })

    expect(ctx.user.roles).toEqual(['user', 'moderator'])
    expect(finalHandler).toHaveBeenCalled()
  })
})
