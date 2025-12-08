import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit } from '../../src/core/rate-limiter'
import { MemoryRateLimitStore } from '../../src/core/rate-limiter-store'
import { compose } from '../../src/core/middleware'
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

describe('Rate Limiting - Integration Tests', () => {
  let store: MemoryRateLimitStore

  beforeEach(() => {
    store = new MemoryRateLimitStore()
    store.clear()
  })

  describe('Middleware composition', () => {
    it('should work with compose() from Story 2.9', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const logger = async (ctx: EdgeContext, next: () => Promise<Response>) => {
        const response = await next()
        response.headers.set('X-Logger', 'enabled')
        return response
      }

      const handler = compose(
        logger,
        rateLimit({ max: 2, window: '1m', store })
      )(() => new Response('OK'))

      const response = await handler(ctx)
      expect(response.status).toBe(200)
      expect(response.headers.get('X-Logger')).toBe('enabled')
      expect(response.headers.get('X-RateLimit-Limit')).toBe('2')
    })

    it('should work in middleware array (route-level)', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      // Simulates: export const middleware = [auth, rateLimit(...)]
      const auth = async (ctx: EdgeContext, next: () => Promise<Response>) => {
        ;(ctx as any).user = { id: 'user-123' }
        return next()
      }

      const middleware = [auth, rateLimit({ max: 2, window: '1m', keyBy: 'user', store })]

      const handler = compose(...middleware)(() => new Response('OK'))

      const response1 = await handler(ctx)
      expect(response1.status).toBe(200)

      const response2 = await handler(ctx)
      expect(response2.status).toBe(200)

      const response3 = await handler(ctx)
      expect(response3.status).toBe(429)
    })

    it('should allow different limits for different routes', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      // Route 1: strict limit
      const route1Handler = compose(rateLimit({ max: 1, window: '1m', store }))(
        () => new Response('Route 1')
      )

      // Route 2: generous limit
      const route2Handler = compose(rateLimit({ max: 10, window: '1m', store }))(
        () => new Response('Route 2')
      )

      // Route 1 should be limited after 1 request
      const route1_1 = await route1Handler(ctx)
      expect(route1_1.status).toBe(200)

      const route1_2 = await route1Handler(ctx)
      expect(route1_2.status).toBe(429)

      // Route 2 should still allow requests
      const route2_1 = await route2Handler(ctx)
      expect(route2_1.status).toBe(200)
    })
  })

  describe('Rate limit headers', () => {
    it('should include X-RateLimit-Limit header', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 100, window: '15m', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response = await middleware(ctx, next)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100')
    })

    it('should include X-RateLimit-Remaining header', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 5, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response1 = await middleware(ctx, next)
      expect(response1.headers.get('X-RateLimit-Remaining')).toBe('4')

      const response2 = await middleware(ctx, next)
      expect(response2.headers.get('X-RateLimit-Remaining')).toBe('3')
    })

    it('should include X-RateLimit-Reset header', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 10, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response = await middleware(ctx, next)
      const reset = response.headers.get('X-RateLimit-Reset')

      expect(reset).toMatch(/^\d+$/) // Unix timestamp
      expect(parseInt(reset!)).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should include Retry-After header when limited', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 1, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toMatch(/^\d+$/)
      expect(parseInt(response.headers.get('Retry-After')!)).toBeGreaterThan(0)
    })
  })

  describe('429 Response format', () => {
    it('should return error envelope with rate limit details', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 1, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)

      const body = await response.json()
      // Verify architecture-compliant error envelope format
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED')
      expect(body.error).toHaveProperty('message', 'Too many requests')
      expect(body.error).toHaveProperty('status', 429)
      expect(body.error).toHaveProperty('timestamp')
      expect(typeof body.error.timestamp).toBe('number')
      expect(body.error).toHaveProperty('retryAfter')
      expect(typeof body.error.retryAfter).toBe('number')
    })

    it('should use custom onLimit response', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({
        max: 1,
        window: '1m',
        store,
        onLimit: (ctx) =>
          Response.json(
            {
              error: {
                code: 'PREMIUM_REQUIRED',
                message: 'Upgrade to premium for higher limits!',
                upgradeUrl: '/pricing',
              },
            },
            { status: 429 }
          ),
      })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)

      const body = await response.json()
      expect(body.error.code).toBe('PREMIUM_REQUIRED')
      expect(body.error.upgradeUrl).toBe('/pricing')
    })
  })

  describe('Key strategies', () => {
    it('should rate limit by IP (default)', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 2, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })

    it('should rate limit by user ID', async () => {
      const ctx = createMockContext()
      ;(ctx as any).user = { id: 'user-123' }

      const middleware = rateLimit({ max: 2, window: '1m', keyBy: 'user', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })

    it('should rate limit by API key', async () => {
      const request = new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer sk_test_123' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 2, window: '1m', keyBy: 'apiKey', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })

    it('should use custom key function for tenant-based limiting', async () => {
      const ctx = createMockContext()
      ;(ctx as any).request = new Request('http://localhost/test', {
        headers: { 'X-Tenant-ID': 'tenant-abc' },
      })
      ;(ctx as any).headers = (ctx as any).request.headers

      const middleware = rateLimit({
        max: 2,
        window: '1m',
        keyBy: (ctx) => {
          const tenantId = ctx.request.headers.get('X-Tenant-ID')
          return tenantId ? `tenant:${tenantId}` : null
        },
        store,
      })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })
  })

  describe('Window duration tests', () => {
    it('should handle 10 second window', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 5, window: '10s', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response = await middleware(ctx, next)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
    })

    it('should handle 1 hour window', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 1000, window: '1h', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response = await middleware(ctx, next)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('1000')
    })

    it('should handle numeric seconds', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 10, window: 60, store })
      const next = () => Promise.resolve(new Response('OK'))

      const response = await middleware(ctx, next)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    })
  })
})
