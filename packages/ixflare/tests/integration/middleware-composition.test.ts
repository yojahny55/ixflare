/**
 * @module middleware-composition.test
 * @description Integration tests for middleware composition and error handling
 */

import { describe, it, expect } from 'vitest'
import { createMiddleware, withErrorBoundary, compose } from '../../src/core/middleware'
import { AuthError, ValidationError, NotFoundError } from '../../src/errors'
import type { EdgeContext } from '../../src/types/context'

function createMockContext(overrides: Partial<EdgeContext> = {}): EdgeContext {
  const request = new Request('http://localhost/test')
  const url = new URL(request.url)
  return {
    request,
    params: {},
    env: {},
    ctx: {} as ExecutionContext,
    query: url.searchParams,
    url,
    method: request.method,
    headers: request.headers,
    ...overrides,
  }
}

describe('Middleware Composition Integration', () => {
  describe('Multi-Middleware Pipeline', () => {
    it('should execute middleware in order with context modifications', async () => {
      const executionLog: string[] = []

      const logger = createMiddleware(async (ctx, next) => {
        executionLog.push('logger:before')
        const response = await next()
        executionLog.push('logger:after')
        return response
      })

      const auth = createMiddleware(async (ctx, next) => {
        executionLog.push('auth:before')
        ;(ctx as any).user = { id: '123', name: 'Jordan' }
        const response = await next()
        executionLog.push('auth:after')
        return response
      })

      const timing = createMiddleware(async (ctx, next) => {
        executionLog.push('timing:before')
        const start = Date.now()
        const response = await next()
        const duration = Date.now() - start
        const newHeaders = new Headers(response.headers)
        newHeaders.set('X-Response-Time', `${duration}ms`)
        executionLog.push('timing:after')
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        })
      })

      let capturedUser: any = null
      const handler = compose(logger, auth, timing)((ctx) => {
        executionLog.push('handler')
        capturedUser = (ctx as any).user
        return new Response('OK')
      })

      const response = await handler(createMockContext())

      expect(response.status).toBe(200)
      expect(response.headers.has('X-Response-Time')).toBe(true)
      expect(capturedUser).toEqual({ id: '123', name: 'Jordan' })
      expect(executionLog).toEqual([
        'logger:before',
        'auth:before',
        'timing:before',
        'handler',
        'timing:after',
        'auth:after',
        'logger:after',
      ])
    })

    it('should support short-circuiting with early return', async () => {
      const executionLog: string[] = []

      const authGuard = createMiddleware(async (ctx) => {
        executionLog.push('authGuard')
        const token = ctx.headers.get('Authorization')
        if (!token) {
          return new Response('Unauthorized', { status: 401 })
        }
        // Never reaches here in this test
        return new Response('Should not see this')
      })

      const logging = createMiddleware(async (ctx, next) => {
        executionLog.push('logging:before')
        const response = await next()
        executionLog.push('logging:after')
        return response
      })

      const handler = compose(logging, authGuard)(() => {
        executionLog.push('handler')
        return new Response('Success')
      })

      const response = await handler(createMockContext())

      expect(response.status).toBe(401)
      expect(await response.text()).toBe('Unauthorized')
      expect(executionLog).toEqual([
        'logging:before',
        'authGuard',
        'logging:after',
      ])
      expect(executionLog).not.toContain('handler')
    })
  })

  describe('Error Boundary Integration', () => {
    it('should handle AuthError in middleware pipeline', async () => {
      const auth = withErrorBoundary(
        createMiddleware(async (ctx) => {
          throw new AuthError('TOKEN_EXPIRED', 'Your session has expired')
        })
      )

      const handler = compose(auth)(() => new Response('Should not reach'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toMatchObject({
        code: 'AUTH.TOKEN_EXPIRED',
        message: 'Your session has expired',
        status: 401,
      })
    })

    it('should handle ValidationError with field errors', async () => {
      const validator = withErrorBoundary(
        createMiddleware(async () => {
          throw new ValidationError('Invalid input', [
            { field: 'email', message: 'Invalid email format' },
            { field: 'age', message: 'Must be positive number' },
          ])
        })
      )

      const handler = compose(validator)(() => new Response('Should not reach'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION.FAILED')
      expect(body.error.errors).toHaveLength(2)
      expect(body.error.errors[0].field).toBe('email')
    })

    it('should allow errors to propagate through middleware chain', async () => {
      const middleware1 = createMiddleware(async (ctx, next) => {
        return next()
      })

      const errorThrowingMiddleware = createMiddleware(async () => {
        throw new NotFoundError('Resource', '123')
      })

      const pipeline = compose(
        middleware1,
        withErrorBoundary(errorThrowingMiddleware)
      )(() => new Response('Should not reach'))

      const response = await pipeline(createMockContext())

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toContain('Resource with id \'123\' not found')
    })
  })

  describe('Response Interception and Modification', () => {
    it('should allow multiple middleware to modify response', async () => {
      const addCorsHeaders = createMiddleware(async (ctx, next) => {
        const response = await next()
        const newHeaders = new Headers(response.headers)
        newHeaders.set('Access-Control-Allow-Origin', '*')
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        })
      })

      const addSecurityHeaders = createMiddleware(async (ctx, next) => {
        const response = await next()
        const newHeaders = new Headers(response.headers)
        newHeaders.set('X-Frame-Options', 'DENY')
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        })
      })

      const handler = compose(addCorsHeaders, addSecurityHeaders)(() => {
        return new Response('Hello', {
          headers: { 'Content-Type': 'text/plain' },
        })
      })

      const response = await handler(createMockContext())

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('Content-Type')).toBe('text/plain')
    })

    it('should allow response body transformation', async () => {
      const uppercaseTransform = createMiddleware(async (ctx, next) => {
        const response = await next()
        const body = await response.text()
        return new Response(body.toUpperCase(), {
          status: response.status,
          headers: response.headers,
        })
      })

      const handler = compose(uppercaseTransform)(() => {
        return new Response('hello world')
      })

      const response = await handler(createMockContext())
      expect(await response.text()).toBe('HELLO WORLD')
    })
  })

  describe('Real-World Middleware Patterns', () => {
    it('should implement typical auth + logging + cors pipeline', async () => {
      // Simulated user session
      const userSessions = new Map([['valid-token', { id: 'u1', name: 'Jordan' }]])

      const logger = createMiddleware(async (ctx, next) => {
        const start = Date.now()
        const response = await next()
        const duration = Date.now() - start
        // In real app, would log to analytics
        console.log(`${ctx.method} ${ctx.url.pathname} - ${response.status} (${duration}ms)`)
        return response
      })

      const auth = withErrorBoundary(
        createMiddleware(async (ctx, next) => {
          const token = ctx.headers.get('Authorization')?.replace('Bearer ', '')
          const user = userSessions.get(token || '')

          if (!user) {
            throw new AuthError('UNAUTHORIZED', 'Invalid or missing token')
          }

          ;(ctx as any).user = user
          return next()
        })
      )

      const cors = createMiddleware(async (ctx, next) => {
        const response = await next()
        const headers = new Headers(response.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
        return new Response(response.body, { status: response.status, headers })
      })

      const handler = compose(logger, auth, cors)((ctx) => {
        const user = (ctx as any).user
        return Response.json({ message: `Hello, ${user.name}!` })
      })

      // Test with valid token
      const request = new Request('http://localhost/api/profile', {
        headers: { Authorization: 'Bearer valid-token' },
      })
      const context = createMockContext({ request, headers: request.headers })
      const response = await handler(context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      const body = await response.json()
      expect(body.message).toBe('Hello, Jordan!')
    })

    it('should implement rate limiting pattern', async () => {
      const requestCounts = new Map<string, number>()

      const rateLimit = (maxRequests: number) =>
        withErrorBoundary(
          createMiddleware(async (ctx, next) => {
            const ip = ctx.request.headers.get('X-Forwarded-For') || '127.0.0.1'
            const count = requestCounts.get(ip) || 0

            if (count >= maxRequests) {
              throw new Error('Rate limit exceeded')
            }

            requestCounts.set(ip, count + 1)
            return next()
          })
        )

      const handler = compose(rateLimit(3))(() => new Response('OK'))

      const context = createMockContext()

      // First 3 requests should succeed
      expect((await handler(context)).status).toBe(200)
      expect((await handler(context)).status).toBe(200)
      expect((await handler(context)).status).toBe(200)

      // 4th request should fail
      const response = await handler(context)
      expect(response.status).toBe(500)
    })
  })
})
