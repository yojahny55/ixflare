/**
 * @fileoverview Type tests for middleware context extensions via module augmentation
 *
 * These tests verify AC7: Context extensions from middleware are type-safe via module augmentation
 */

import { describe, it, expect } from 'vitest'
import { createMiddleware, defineMiddleware, type Middleware, type MiddlewareContext } from '../../src'
import type { EdgeContext } from '../../src/types/context'

// Module augmentation for type-safe context extensions
declare module '../../src/types/context' {
  interface EdgeContext {
    user?: { id: string; name: string; role: 'admin' | 'user' }
    session?: { token: string; expiresAt: number }
    requestId?: string
  }
}

describe('Middleware Type Safety', () => {
  describe('Module Augmentation', () => {
    it('should allow type-safe context extension assignment', () => {
      // This middleware can assign to augmented properties without type errors
      const authMiddleware = createMiddleware(async (ctx, next) => {
        // Type-safe assignment - no cast needed!
        ctx.user = { id: '123', name: 'Jordan', role: 'admin' }
        ctx.session = { token: 'abc123', expiresAt: Date.now() + 3600000 }
        ctx.requestId = crypto.randomUUID()

        return next()
      })

      expect(authMiddleware).toBeDefined()
      expect(typeof authMiddleware).toBe('function')
    })

    it('should allow type-safe context property access', () => {
      const protectedHandler = createMiddleware(async (ctx, next) => {
        // Type-safe access - TypeScript knows these properties exist
        if (ctx.user?.role === 'admin') {
          // ctx.user is typed as { id: string; name: string; role: 'admin' | 'user' }
          const userName: string = ctx.user.name
          const userId: string = ctx.user.id
          expect(userName).toBeDefined()
          expect(userId).toBeDefined()
        }

        if (ctx.session) {
          // ctx.session is typed as { token: string; expiresAt: number }
          const token: string = ctx.session.token
          const expires: number = ctx.session.expiresAt
          expect(token).toBeDefined()
          expect(expires).toBeDefined()
        }

        return next()
      })

      expect(protectedHandler).toBeDefined()
    })

    it('should work with defineMiddleware alias', () => {
      const middleware = defineMiddleware(async (ctx, next) => {
        ctx.requestId = 'req-123'
        return next()
      })

      expect(middleware).toBeDefined()
    })
  })

  describe('Middleware Type Definition', () => {
    it('should accept properly typed middleware functions', () => {
      // Explicit Middleware type annotation
      const typed: Middleware = async (ctx, next) => {
        return next()
      }

      expect(typed).toBeDefined()
    })

    it('should support generic Env type parameter', () => {
      interface MyEnv {
        DB: unknown
        KV: unknown
      }

      const envAwareMiddleware: Middleware<MyEnv> = async (ctx, next) => {
        // ctx.env should be typed as MyEnv
        const _db = ctx.env.DB
        const _kv = ctx.env.KV
        return next()
      }

      expect(envAwareMiddleware).toBeDefined()
    })
  })

  describe('MiddlewareContext Type', () => {
    it('should combine EdgeContext with custom extensions', () => {
      interface CustomExtensions {
        analytics: { trackEvent: (name: string) => void }
      }

      // MiddlewareContext combines base context with extensions
      type MyContext = MiddlewareContext<Record<string, unknown>, CustomExtensions>

      // Verify type structure at runtime through usage
      const useContext = (ctx: MyContext) => {
        // Should have base EdgeContext properties
        expect(ctx.request).toBeDefined
        expect(ctx.params).toBeDefined
        expect(ctx.url).toBeDefined

        // Should have custom extensions
        expect(ctx.analytics).toBeDefined
      }

      expect(useContext).toBeDefined()
    })
  })

  describe('Real-World Middleware Patterns', () => {
    it('should support auth middleware pattern', () => {
      const requireAuth = createMiddleware(async (ctx, next) => {
        const token = ctx.headers.get('Authorization')?.replace('Bearer ', '')

        if (!token) {
          return new Response('Unauthorized', { status: 401 })
        }

        // Simulate token verification
        ctx.user = { id: 'u1', name: 'Authenticated User', role: 'user' }

        return next()
      })

      expect(requireAuth).toBeDefined()
    })

    it('should support request ID middleware pattern', () => {
      const addRequestId = createMiddleware(async (ctx, next) => {
        ctx.requestId = ctx.headers.get('X-Request-ID') || crypto.randomUUID()

        const response = await next()

        // Add request ID to response headers
        const headers = new Headers(response.headers)
        headers.set('X-Request-ID', ctx.requestId)

        return new Response(response.body, {
          status: response.status,
          headers,
        })
      })

      expect(addRequestId).toBeDefined()
    })

    it('should support session middleware pattern', () => {
      const sessionMiddleware = createMiddleware(async (ctx, next) => {
        const sessionToken = ctx.headers.get('X-Session-Token')

        if (sessionToken) {
          // Simulate session lookup
          ctx.session = {
            token: sessionToken,
            expiresAt: Date.now() + 3600000,
          }
        }

        return next()
      })

      expect(sessionMiddleware).toBeDefined()
    })
  })
})
