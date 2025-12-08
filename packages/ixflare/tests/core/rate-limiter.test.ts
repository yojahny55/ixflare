import { describe, it, expect, beforeEach } from 'vitest'
import {
  rateLimit,
  parseWindow,
  calculateReset,
  extractIpKey,
  extractUserKey,
  extractApiKeyKey,
  resolveKeyBy,
} from '../../src/core/rate-limiter'
import { MemoryRateLimitStore } from '../../src/core/rate-limiter-store'
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

describe('Rate Limiter - Window Parsing', () => {
  describe('parseWindow', () => {
    it('should parse seconds format', () => {
      expect(parseWindow('10s')).toBe(10)
      expect(parseWindow('30s')).toBe(30)
    })

    it('should parse minutes format', () => {
      expect(parseWindow('1m')).toBe(60)
      expect(parseWindow('15m')).toBe(900)
    })

    it('should parse hours format', () => {
      expect(parseWindow('1h')).toBe(3600)
      expect(parseWindow('24h')).toBe(86400)
    })

    it('should parse days format', () => {
      expect(parseWindow('1d')).toBe(86400)
      expect(parseWindow('7d')).toBe(604800)
    })

    it('should accept numeric seconds', () => {
      expect(parseWindow(60)).toBe(60)
      expect(parseWindow(3600)).toBe(3600)
    })

    it('should throw on invalid format', () => {
      expect(() => parseWindow('invalid' as any)).toThrow('Invalid window format')
      expect(() => parseWindow('10x' as any)).toThrow('Invalid window format')
    })
  })

  describe('calculateReset', () => {
    it('should return future Unix timestamp', () => {
      const now = Math.floor(Date.now() / 1000)
      const reset = calculateReset(60)

      expect(reset).toBeGreaterThan(now)
      expect(reset).toBeLessThanOrEqual(now + 60)
    })
  })
})

describe('Rate Limiter - Key Extraction', () => {
  describe('extractIpKey', () => {
    it('should extract IP from CF-Connecting-IP header', () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractIpKey(ctx)).toBe('ip:203.0.113.42')
    })

    it('should fall back to X-Forwarded-For first IP', () => {
      const request = new Request('http://localhost/test', {
        headers: { 'X-Forwarded-For': '198.51.100.1, 192.0.2.1' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractIpKey(ctx)).toBe('ip:198.51.100.1')
    })

    it('should return null if no IP headers present', () => {
      const ctx = createMockContext()
      expect(extractIpKey(ctx)).toBeNull()
    })

    it('should prioritize CF-Connecting-IP over X-Forwarded-For', () => {
      const request = new Request('http://localhost/test', {
        headers: {
          'CF-Connecting-IP': '203.0.113.42',
          'X-Forwarded-For': '198.51.100.1',
        },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractIpKey(ctx)).toBe('ip:203.0.113.42')
    })
  })

  describe('extractUserKey', () => {
    it('should extract user ID from context', () => {
      const ctx = createMockContext()
      ;(ctx as any).user = { id: 'user-123', name: 'Jordan' }

      expect(extractUserKey(ctx)).toBe('user:user-123')
    })

    it('should return null if user not set', () => {
      const ctx = createMockContext()
      expect(extractUserKey(ctx)).toBeNull()
    })

    it('should return null if user has no id', () => {
      const ctx = createMockContext()
      ;(ctx as any).user = { name: 'Jordan' }

      expect(extractUserKey(ctx)).toBeNull()
    })
  })

  describe('extractApiKeyKey', () => {
    it('should extract from Authorization Bearer header', () => {
      const request = new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer sk_test_1234567890abcdefghijklmnop' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractApiKeyKey(ctx)).toBe('apiKey:sk_test_12345678')
    })

    it('should extract from X-API-Key header', () => {
      const request = new Request('http://localhost/test', {
        headers: { 'X-API-Key': 'api_key_1234567890abcdefghijklmnop' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractApiKeyKey(ctx)).toBe('apiKey:api_key_12345678')
    })

    it('should return null if no API key headers present', () => {
      const ctx = createMockContext()
      expect(extractApiKeyKey(ctx)).toBeNull()
    })

    it('should prioritize Authorization over X-API-Key', () => {
      const request = new Request('http://localhost/test', {
        headers: {
          Authorization: 'Bearer sk_test_auth',
          'X-API-Key': 'api_key_header',
        },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractApiKeyKey(ctx)).toBe('apiKey:sk_test_auth')
    })
  })

  describe('resolveKeyBy', () => {
    it('should default to IP strategy', () => {
      const extractor = resolveKeyBy()
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      expect(extractor(ctx)).toBe('ip:203.0.113.42')
    })

    it('should resolve "ip" strategy', () => {
      const extractor = resolveKeyBy('ip')
      expect(typeof extractor).toBe('function')
    })

    it('should resolve "user" strategy', () => {
      const extractor = resolveKeyBy('user')
      expect(typeof extractor).toBe('function')
    })

    it('should resolve "apiKey" strategy', () => {
      const extractor = resolveKeyBy('apiKey')
      expect(typeof extractor).toBe('function')
    })

    it('should accept custom function', () => {
      const customExtractor = (ctx: EdgeContext) => `custom:${ctx.params.id}`
      const extractor = resolveKeyBy(customExtractor)

      expect(extractor).toBe(customExtractor)
    })

    it('should throw on unknown strategy', () => {
      expect(() => resolveKeyBy('unknown' as any)).toThrow('Unknown key strategy')
    })
  })
})

describe('Rate Limiter - Middleware Factory', () => {
  let store: MemoryRateLimitStore

  beforeEach(() => {
    store = new MemoryRateLimitStore()
    store.clear()
  })

  describe('rateLimit factory', () => {
    it('should create middleware function', () => {
      const middleware = rateLimit({ max: 10, window: '1m', store })

      expect(typeof middleware).toBe('function')
    })

    it('should parse window configuration', () => {
      expect(() => rateLimit({ max: 10, window: '15m', store })).not.toThrow()
      expect(() => rateLimit({ max: 10, window: 60, store })).not.toThrow()
    })
  })

  describe('Rate limiting behavior', () => {
    it('should allow requests under limit', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 3, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response1 = await middleware(ctx, next)
      expect(response1.status).toBe(200)
      expect(response1.headers.get('X-RateLimit-Limit')).toBe('3')
      expect(response1.headers.get('X-RateLimit-Remaining')).toBe('2')

      const response2 = await middleware(ctx, next)
      expect(response2.status).toBe(200)
      expect(response2.headers.get('X-RateLimit-Remaining')).toBe('1')

      const response3 = await middleware(ctx, next)
      expect(response3.status).toBe(200)
      expect(response3.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('should block requests over limit with 429', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 2, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      // First 2 requests should pass
      await middleware(ctx, next)
      await middleware(ctx, next)

      // 3rd request should be rate limited
      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)

      const body = await response.json()
      expect(body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED')
      expect(body).toHaveProperty('message', 'Too many requests')
      expect(body).toHaveProperty('retryAfter')
      expect(response.headers.get('Retry-After')).toBeDefined()
    })

    it('should set rate limit headers on all responses', async () => {
      const request = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 10, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      const response = await middleware(ctx, next)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9')
      expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/)
    })

    it('should skip rate limiting if no key extracted', async () => {
      const ctx = createMockContext() // No IP headers

      const middleware = rateLimit({ max: 1, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      // Should not rate limit without key
      const response1 = await middleware(ctx, next)
      expect(response1.status).toBe(200)

      const response2 = await middleware(ctx, next)
      expect(response2.status).toBe(200)
    })

    it('should use custom onLimit handler', async () => {
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
            { error: { code: 'CUSTOM_LIMIT', message: 'Custom rate limit message' } },
            { status: 429 }
          ),
      })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)

      const body = await response.json()
      expect(body.error.code).toBe('CUSTOM_LIMIT')
      expect(body.error.message).toBe('Custom rate limit message')
    })

    it('should rate limit different IPs separately', async () => {
      const request1 = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '203.0.113.42' },
      })
      const ctx1 = createMockContext({ request: request1, headers: request1.headers })

      const request2 = new Request('http://localhost/test', {
        headers: { 'CF-Connecting-IP': '198.51.100.1' },
      })
      const ctx2 = createMockContext({ request: request2, headers: request2.headers })

      const middleware = rateLimit({ max: 1, window: '1m', store })
      const next = () => Promise.resolve(new Response('OK'))

      // Both IPs should get 1 request
      const response1 = await middleware(ctx1, next)
      expect(response1.status).toBe(200)

      const response2 = await middleware(ctx2, next)
      expect(response2.status).toBe(200)

      // Second request from IP1 should be limited
      const response3 = await middleware(ctx1, next)
      expect(response3.status).toBe(429)

      // Second request from IP2 should also be limited
      const response4 = await middleware(ctx2, next)
      expect(response4.status).toBe(429)
    })

    it('should rate limit by user ID when specified', async () => {
      const ctx = createMockContext()
      ;(ctx as any).user = { id: 'user-123' }

      const middleware = rateLimit({ max: 2, window: '1m', keyBy: 'user', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })

    it('should rate limit by API key when specified', async () => {
      const request = new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer sk_test_123456789' },
      })
      const ctx = createMockContext({ request, headers: request.headers })

      const middleware = rateLimit({ max: 2, window: '1m', keyBy: 'apiKey', store })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })

    it('should use custom key function', async () => {
      const ctx = createMockContext({ params: { tenantId: 'tenant-abc' } })

      const middleware = rateLimit({
        max: 2,
        window: '1m',
        keyBy: (ctx) => `tenant:${ctx.params.tenantId}`,
        store,
      })
      const next = () => Promise.resolve(new Response('OK'))

      await middleware(ctx, next)
      await middleware(ctx, next)

      const response = await middleware(ctx, next)
      expect(response.status).toBe(429)
    })
  })
})
