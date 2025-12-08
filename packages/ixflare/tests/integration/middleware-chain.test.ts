/**
 * Integration tests for full middleware chain composition
 * Tests global → directory → route middleware execution order
 */

// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect } from 'vitest'
import { createRouter } from '../../src/core/router'
import { createMiddleware } from '../../src/core/middleware'

describe('Middleware Chain Integration', () => {
  it('should apply global middleware from config to all routes', async () => {
    const router = createRouter()
    const executionOrder: string[] = []

    const globalLogging = createMiddleware(async (ctx, next) => {
      executionOrder.push('global-logging')
      return next()
    })

    const globalCors = createMiddleware(async (ctx, next) => {
      executionOrder.push('global-cors')
      const response = await next()
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    })

    router.add('/api/users', () => {
      executionOrder.push('handler')
      return new Response('users')
    }, {
      globalMiddleware: [globalLogging, globalCors],
    })

    const request = new Request('http://localhost/api/users')
    const response = await router.handle(request, {})

    expect(executionOrder).toEqual(['global-logging', 'global-cors', 'handler'])
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('should apply directory middleware chain inherited from parent directories', async () => {
    const router = createRouter()
    const executionOrder: string[] = []

    // Root directory middleware (_middleware.ts at /)
    const rootMiddleware = createMiddleware(async (ctx, next) => {
      executionOrder.push('root')
      return next()
    })

    // API directory middleware (_middleware.ts at /api)
    const apiMiddleware = createMiddleware(async (ctx, next) => {
      executionOrder.push('api')
      return next()
    })

    // Admin directory middleware (_middleware.ts at /api/admin)
    const adminMiddleware = createMiddleware(async (ctx, next) => {
      executionOrder.push('admin')
      return next()
    })

    router.add('/api/admin/users', () => {
      executionOrder.push('handler')
      return new Response('admin users')
    }, {
      directoryMiddleware: [rootMiddleware, apiMiddleware, adminMiddleware],
    })

    const request = new Request('http://localhost/api/admin/users')
    await router.handle(request, {})

    expect(executionOrder).toEqual(['root', 'api', 'admin', 'handler'])
  })

  it('should apply full middleware chain: global → directory → route', async () => {
    const router = createRouter()
    const executionOrder: string[] = []

    const globalMiddleware = [
      createMiddleware(async (ctx, next) => {
        executionOrder.push('global-1')
        return next()
      }),
      createMiddleware(async (ctx, next) => {
        executionOrder.push('global-2')
        return next()
      }),
    ]

    const directoryMiddleware = [
      createMiddleware(async (ctx, next) => {
        executionOrder.push('dir-1')
        return next()
      }),
      createMiddleware(async (ctx, next) => {
        executionOrder.push('dir-2')
        return next()
      }),
    ]

    const routeMiddleware = [
      createMiddleware(async (ctx, next) => {
        executionOrder.push('route-1')
        return next()
      }),
      createMiddleware(async (ctx, next) => {
        executionOrder.push('route-2')
        return next()
      }),
    ]

    router.add('/test', () => {
      executionOrder.push('handler')
      return new Response('OK')
    }, {
      globalMiddleware,
      directoryMiddleware,
      routeMiddleware,
    })

    const request = new Request('http://localhost/test')
    await router.handle(request, {})

    expect(executionOrder).toEqual([
      'global-1',
      'global-2',
      'dir-1',
      'dir-2',
      'route-1',
      'route-2',
      'handler',
    ])
  })

  it('should support authentication middleware that short-circuits', async () => {
    const router = createRouter()
    const executionOrder: string[] = []

    const authMiddleware = createMiddleware(async (ctx, next) => {
      executionOrder.push('auth-check')
      const token = ctx.headers.get('Authorization')
      if (!token) {
        executionOrder.push('auth-failed')
        return new Response('Unauthorized', { status: 401 })
      }
      executionOrder.push('auth-passed')
      return next()
    })

    router.add('/protected', () => {
      executionOrder.push('handler')
      return new Response('Protected resource')
    }, {
      directoryMiddleware: [authMiddleware],
    })

    // Request without token
    const requestNoAuth = new Request('http://localhost/protected')
    const responseNoAuth = await router.handle(requestNoAuth, {})

    expect(responseNoAuth.status).toBe(401)
    expect(executionOrder).toEqual(['auth-check', 'auth-failed'])

    // Reset
    executionOrder.length = 0

    // Request with token
    const requestWithAuth = new Request('http://localhost/protected', {
      headers: { 'Authorization': 'Bearer token123' },
    })
    const responseWithAuth = await router.handle(requestWithAuth, {})

    expect(responseWithAuth.status).toBe(200)
    expect(executionOrder).toEqual(['auth-check', 'auth-passed', 'handler'])
  })

  it('should allow middleware to modify response headers', async () => {
    const router = createRouter()

    const timingMiddleware = createMiddleware(async (ctx, next) => {
      const start = Date.now()
      const response = await next()
      const duration = Date.now() - start
      response.headers.set('X-Response-Time', `${duration}ms`)
      return response
    })

    const securityMiddleware = createMiddleware(async (ctx, next) => {
      const response = await next()
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Frame-Options', 'DENY')
      return response
    })

    router.add('/api/data', () => {
      return new Response('data')
    }, {
      globalMiddleware: [timingMiddleware, securityMiddleware],
    })

    const request = new Request('http://localhost/api/data')
    const response = await router.handle(request, {})

    expect(response.headers.has('X-Response-Time')).toBe(true)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('should support rate limiting middleware', async () => {
    const router = createRouter()
    let requestCount = 0

    const rateLimitMiddleware = createMiddleware(async (ctx, next) => {
      requestCount++
      if (requestCount > 3) {
        return new Response('Rate limit exceeded', { status: 429 })
      }
      return next()
    })

    router.add('/api/resource', () => {
      return new Response('resource')
    }, {
      directoryMiddleware: [rateLimitMiddleware],
    })

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const request = new Request('http://localhost/api/resource')
      const response = await router.handle(request, {})
      expect(response.status).toBe(200)
    }

    // 4th request should be rate limited
    const request4 = new Request('http://localhost/api/resource')
    const response4 = await router.handle(request4, {})
    expect(response4.status).toBe(429)
    expect(await response4.text()).toBe('Rate limit exceeded')
  })

  it('should handle middleware that sets context properties', async () => {
    const router = createRouter()

    interface CustomContext {
      user?: { id: string; name: string }
      requestId?: string
    }

    const requestIdMiddleware = createMiddleware<CustomContext>(async (ctx: any, next) => {
      ctx.requestId = `req-${Date.now()}`
      return next()
    })

    const authMiddleware = createMiddleware<CustomContext>(async (ctx: any, next) => {
      ctx.user = { id: '123', name: 'Alice' }
      return next()
    })

    let capturedContext: any = {}

    router.add('/profile', (ctx: any) => {
      capturedContext = {
        requestId: ctx.requestId,
        user: ctx.user,
      }
      return new Response(`Hello ${ctx.user?.name}`)
    }, {
      globalMiddleware: [requestIdMiddleware],
      directoryMiddleware: [authMiddleware],
    })

    const request = new Request('http://localhost/profile')
    const response = await router.handle(request, {})

    expect(await response.text()).toBe('Hello Alice')
    expect(capturedContext.requestId).toMatch(/^req-\d+$/)
    expect(capturedContext.user).toEqual({ id: '123', name: 'Alice' })
  })

  it('should work with routes that have no middleware', async () => {
    const router = createRouter()

    router.add('/simple', () => {
      return new Response('simple route')
    })

    const request = new Request('http://localhost/simple')
    const response = await router.handle(request, {})

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('simple route')
  })

  it('should handle onion-model execution correctly', async () => {
    const router = createRouter()
    const executionOrder: string[] = []

    const middleware1 = createMiddleware(async (ctx, next) => {
      executionOrder.push('m1-before')
      const response = await next()
      executionOrder.push('m1-after')
      return response
    })

    const middleware2 = createMiddleware(async (ctx, next) => {
      executionOrder.push('m2-before')
      const response = await next()
      executionOrder.push('m2-after')
      return response
    })

    const middleware3 = createMiddleware(async (ctx, next) => {
      executionOrder.push('m3-before')
      const response = await next()
      executionOrder.push('m3-after')
      return response
    })

    router.add('/onion', () => {
      executionOrder.push('handler')
      return new Response('OK')
    }, {
      globalMiddleware: [middleware1, middleware2, middleware3],
    })

    const request = new Request('http://localhost/onion')
    await router.handle(request, {})

    // Onion model: m1 → m2 → m3 → handler → m3 → m2 → m1
    expect(executionOrder).toEqual([
      'm1-before',
      'm2-before',
      'm3-before',
      'handler',
      'm3-after',
      'm2-after',
      'm1-after',
    ])
  })
})
