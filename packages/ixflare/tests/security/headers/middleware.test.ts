/**
 * Security Headers Middleware Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSecurityHeadersMiddleware, DEFAULT_SECURITY_HEADERS_CONFIG } from '@/security/headers/middleware'
import { clearRequestNonce } from '@/security/headers/csp'
import { setEnvironment, clearEnvironment } from '@/auth/cookie/security'

describe('createSecurityHeadersMiddleware', () => {
  beforeEach(() => {
    clearRequestNonce()
    clearEnvironment()
  })

  afterEach(() => {
    clearRequestNonce()
    clearEnvironment()
  })

  it('should add default security headers to response', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
    expect(response.headers.get('Strict-Transport-Security')).toBeTruthy()
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('X-XSS-Protection')).toBe('0')
  })

  it('should include nonce in CSP header', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain("'nonce-")
    expect(csp).toContain("'strict-dynamic'")
  })

  it('should use custom CSP configuration', async () => {
    const middleware = createSecurityHeadersMiddleware({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.example.com'],
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain('https://cdn.example.com')
  })

  it('should use custom HSTS configuration', async () => {
    const middleware = createSecurityHeadersMiddleware({
      strictTransportSecurity: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    const hsts = response.headers.get('Strict-Transport-Security')
    expect(hsts).toBe('max-age=63072000; includeSubDomains; preload')
  })

  it('should allow disabling specific headers', async () => {
    const middleware = createSecurityHeadersMiddleware({
      contentSecurityPolicy: false,
      xFrameOptions: false,
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('Content-Security-Policy')).toBeNull()
    expect(response.headers.get('X-Frame-Options')).toBeNull()
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should support route-level config override', async () => {
    const middleware = createSecurityHeadersMiddleware()

    const mockRequest = new Request('https://example.com/embed')
    const mockContext = {
      request: mockRequest,
      routeConfig: {
        security: {
          headers: {
            xFrameOptions: 'SAMEORIGIN' as const,
          },
        },
      },
    } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })

  it('should allow disabling all headers at route level', async () => {
    const middleware = createSecurityHeadersMiddleware()

    const mockRequest = new Request('https://example.com/webhook')
    const mockContext = {
      request: mockRequest,
      routeConfig: {
        security: {
          headers: false,
        },
      },
    } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('Content-Security-Policy')).toBeNull()
    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
    expect(response.headers.get('X-Content-Type-Options')).toBeNull()
  })

  it('should add Permissions-Policy when configured', async () => {
    const middleware = createSecurityHeadersMiddleware({
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: ['self'],
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    const permissionsPolicy = response.headers.get('Permissions-Policy')
    expect(permissionsPolicy).toContain('camera=()')
    expect(permissionsPolicy).toContain('microphone=()')
    expect(permissionsPolicy).toContain('geolocation=(self)')
  })

  it('should add Cross-Origin headers when configured', async () => {
    const middleware = createSecurityHeadersMiddleware({
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp')
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin')
  })

  it('should support CSP report-only mode', async () => {
    const middleware = createSecurityHeadersMiddleware({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        reportOnly: true,
        reportUri: '/csp-report',
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy()
    expect(response.headers.get('Content-Security-Policy')).toBeNull()
  })

  it('should preserve response body and status', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const originalResponse = new Response('Test body', { status: 201, statusText: 'Created' })
    const mockNext = vi.fn().mockResolvedValue(originalResponse)

    const response = await middleware(mockContext, mockNext)

    expect(response.status).toBe(201)
    expect(response.statusText).toBe('Created')
    expect(await response.text()).toBe('Test body')
  })

  it('should preserve existing headers from response', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const originalHeaders = new Headers({ 'X-Custom-Header': 'custom-value' })
    const originalResponse = new Response('OK', { headers: originalHeaders })
    const mockNext = vi.fn().mockResolvedValue(originalResponse)

    const response = await middleware(mockContext, mockNext)

    expect(response.headers.get('X-Custom-Header')).toBe('custom-value')
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  it('should generate unique nonces for each request', async () => {
    const middleware = createSecurityHeadersMiddleware()

    const mockRequest1 = new Request('https://example.com/test1')
    const mockContext1 = { request: mockRequest1 } as any
    const mockNext1 = vi.fn().mockResolvedValue(new Response('OK'))

    const response1 = await middleware(mockContext1, mockNext1)
    const csp1 = response1.headers.get('Content-Security-Policy')

    clearRequestNonce()

    const mockRequest2 = new Request('https://example.com/test2')
    const mockContext2 = { request: mockRequest2 } as any
    const mockNext2 = vi.fn().mockResolvedValue(new Response('OK'))

    const response2 = await middleware(mockContext2, mockNext2)
    const csp2 = response2.headers.get('Content-Security-Policy')

    // Extract nonces
    const nonce1 = csp1?.match(/'nonce-([^']+)'/)?.[1]
    const nonce2 = csp2?.match(/'nonce-([^']+)'/)?.[1]

    expect(nonce1).toBeTruthy()
    expect(nonce2).toBeTruthy()
    expect(nonce1).not.toBe(nonce2)
  })

  it('should clear nonce after response', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

    await middleware(mockContext, mockNext)

    // Nonce should be cleared after middleware completes
    // Attempting to get nonce should throw
    const { getNonce } = await import('@/security/headers/csp')
    expect(() => getNonce()).toThrow()
  })

  it('should clear nonce even when handler throws an error', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = vi.fn().mockRejectedValue(new Error('Handler error'))

    // Middleware should propagate the error
    await expect(middleware(mockContext, mockNext)).rejects.toThrow('Handler error')

    // But nonce should still be cleared (via try/finally)
    const { getNonce } = await import('@/security/headers/csp')
    expect(() => getNonce()).toThrow()
  })

  describe('httpsRedirect', () => {
    it('should redirect HTTP to HTTPS in production by default', async () => {
      setEnvironment('production')

      const middleware = createSecurityHeadersMiddleware()
      const mockRequest = new Request('http://example.com/path?query=1')
      const mockContext = { request: mockRequest } as any
      const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

      const response = await middleware(mockContext, mockNext)

      expect(response.status).toBe(301)
      expect(response.headers.get('Location')).toBe('https://example.com/path?query=1')
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should not redirect if already HTTPS in production', async () => {
      setEnvironment('production')

      const middleware = createSecurityHeadersMiddleware()
      const mockRequest = new Request('https://example.com/path')
      const mockContext = { request: mockRequest } as any
      const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

      const response = await middleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.status).not.toBe(301)
    })

    it('should not redirect HTTP in development', async () => {
      setEnvironment('development')

      const middleware = createSecurityHeadersMiddleware()
      const mockRequest = new Request('http://localhost:3000/path')
      const mockContext = { request: mockRequest } as any
      const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

      const response = await middleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.status).not.toBe(301)
    })

    it('should not redirect HTTP in test environment', async () => {
      setEnvironment('test')

      const middleware = createSecurityHeadersMiddleware()
      const mockRequest = new Request('http://example.com/path')
      const mockContext = { request: mockRequest } as any
      const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

      const response = await middleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.status).not.toBe(301)
    })

    it('should not redirect when httpsRedirect is explicitly disabled', async () => {
      setEnvironment('production')

      const middleware = createSecurityHeadersMiddleware({
        httpsRedirect: false,
      })
      const mockRequest = new Request('http://example.com/path')
      const mockContext = { request: mockRequest } as any
      const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

      const response = await middleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.status).not.toBe(301)
    })

    it('should preserve path and query string during redirect', async () => {
      setEnvironment('production')

      const middleware = createSecurityHeadersMiddleware()
      const mockRequest = new Request('http://example.com/users/123?sort=asc&filter=active')
      const mockContext = { request: mockRequest } as any
      const mockNext = vi.fn()

      const response = await middleware(mockContext, mockNext)

      expect(response.headers.get('Location')).toBe('https://example.com/users/123?sort=asc&filter=active')
    })

    it('should skip redirect when route disables headers', async () => {
      setEnvironment('production')

      const middleware = createSecurityHeadersMiddleware()
      const mockRequest = new Request('http://example.com/webhook')
      const mockContext = {
        request: mockRequest,
        routeConfig: {
          security: {
            headers: false,
          },
        },
      } as any
      const mockNext = vi.fn().mockResolvedValue(new Response('OK'))

      const response = await middleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.status).not.toBe(301)
    })
  })
})

describe('DEFAULT_SECURITY_HEADERS_CONFIG', () => {
  it('should have OWASP recommended defaults', () => {
    expect(DEFAULT_SECURITY_HEADERS_CONFIG.contentSecurityPolicy).toBeDefined()
    expect(DEFAULT_SECURITY_HEADERS_CONFIG.strictTransportSecurity).toBeDefined()
    expect(DEFAULT_SECURITY_HEADERS_CONFIG.xContentTypeOptions).toBe(true)
    expect(DEFAULT_SECURITY_HEADERS_CONFIG.xFrameOptions).toBe('DENY')
    expect(DEFAULT_SECURITY_HEADERS_CONFIG.referrerPolicy).toBe('strict-origin-when-cross-origin')
    expect(DEFAULT_SECURITY_HEADERS_CONFIG.xXssProtection).toBe(true)
  })

  it('should have CSP default-src self', () => {
    const csp = DEFAULT_SECURITY_HEADERS_CONFIG.contentSecurityPolicy
    expect(csp).toHaveProperty('defaultSrc')
    expect(csp.defaultSrc).toContain("'self'")
  })

  it('should have HSTS with 1 year maxAge', () => {
    const hsts = DEFAULT_SECURITY_HEADERS_CONFIG.strictTransportSecurity
    expect(hsts).toHaveProperty('maxAge', 31536000)
    expect(hsts).toHaveProperty('includeSubDomains', true)
  })
})
