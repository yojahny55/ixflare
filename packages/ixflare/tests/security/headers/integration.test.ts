/**
 * Security Headers Integration Tests
 * Story 5-8: Security Headers Auto-Injection
 *
 * End-to-end tests for security headers functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createSecurityHeadersMiddleware } from '@/security/headers/middleware'
import { getNonce } from '@/security/headers/csp'
import { createHttpsRedirectMiddleware } from '@/security/headers/hsts'
import { setEnvironment, clearEnvironment } from '@/auth/cookie/security'

describe('Security Headers Integration', () => {
  beforeEach(() => {
    clearEnvironment()
  })

  afterEach(() => {
    clearEnvironment()
  })

  it('should provide complete OWASP security headers by default', async () => {
    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    // Critical headers from OWASP recommendations
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
    expect(response.headers.get('Strict-Transport-Security')).toBeTruthy()
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('X-XSS-Protection')).toBe('0')
  })

  it('should support full security hardening configuration', async () => {
    const middleware = createSecurityHeadersMiddleware({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: true,
      },
      strictTransportSecurity: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
      xFrameOptions: 'DENY',
      xContentTypeOptions: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
      },
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    // Verify all headers are present
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(response.headers.get('Content-Security-Policy')).toContain('upgrade-insecure-requests')
    expect(response.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload'
    )
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()')
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp')
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin')
  })

  it('should support CSP nonce in SSR context', async () => {
    let capturedNonce: string | null = null

    const middleware = createSecurityHeadersMiddleware()
    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => {
      // Simulate accessing nonce during SSR
      capturedNonce = getNonce()
      return new Response('OK')
    }

    const response = await middleware(mockContext, mockNext)

    // Verify nonce was captured during request
    expect(capturedNonce).toBeTruthy()

    // Verify nonce is in CSP header
    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain(`'nonce-${capturedNonce}'`)
    expect(csp).toContain("'strict-dynamic'")
  })

  it('should combine HTTPS redirect with security headers', async () => {
    setEnvironment('production')

    const httpsRedirect = createHttpsRedirectMiddleware()
    const securityHeaders = createSecurityHeadersMiddleware()

    // Compose middleware manually (simulating middleware chain)
    const mockRequest = new Request('http://example.com/test')
    const mockContext = { request: mockRequest } as any

    // First middleware: HTTPS redirect
    const response1 = await httpsRedirect(mockContext, async () => {
      // If redirect doesn't happen, continue to security headers
      return await securityHeaders(mockContext, async () => {
        return new Response('OK')
      })
    })

    // Should redirect to HTTPS
    expect(response1.status).toBe(301)
    expect(response1.headers.get('Location')).toBe('https://example.com/test')
  })

  it('should support route-level security header customization', async () => {
    const middleware = createSecurityHeadersMiddleware({
      xFrameOptions: 'DENY',
    })

    // Route allows embedding for iframe use case
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
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    // Route-level config should override global
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')

    // Other headers should still be present
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should support disabling headers for specific routes', async () => {
    const middleware = createSecurityHeadersMiddleware()

    // Webhook route disables all security headers
    const mockRequest = new Request('https://example.com/api/webhook')
    const mockContext = {
      request: mockRequest,
      routeConfig: {
        security: {
          headers: false,
        },
      },
    } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    // No security headers should be present
    expect(response.headers.get('Content-Security-Policy')).toBeNull()
    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
    expect(response.headers.get('X-Content-Type-Options')).toBeNull()
    expect(response.headers.get('X-Frame-Options')).toBeNull()
  })

  it('should prevent XSS attacks with strict CSP', async () => {
    const middleware = createSecurityHeadersMiddleware({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    const csp = response.headers.get('Content-Security-Policy')

    // Strict CSP should not allow unsafe-inline or unsafe-eval
    expect(csp).not.toContain("'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")

    // Should use nonce-based approach
    expect(csp).toContain("'nonce-")
    expect(csp).toContain("'strict-dynamic'")

    // Should block objects
    expect(csp).toContain("object-src 'none'")
  })

  it('should prevent clickjacking attacks', async () => {
    const middleware = createSecurityHeadersMiddleware()

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    // X-Frame-Options should prevent iframe embedding
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')

    // CSP frame-ancestors should also prevent embedding
    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('should prevent MIME sniffing attacks', async () => {
    const middleware = createSecurityHeadersMiddleware()

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () =>
      new Response('OK', {
        headers: { 'Content-Type': 'application/json' },
      })

    const response = await middleware(mockContext, mockNext)

    // X-Content-Type-Options should be nosniff
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should enforce HTTPS with HSTS', async () => {
    const middleware = createSecurityHeadersMiddleware({
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    const hsts = response.headers.get('Strict-Transport-Security')
    expect(hsts).toBe('max-age=31536000; includeSubDomains')
  })

  it('should restrict browser features with Permissions-Policy', async () => {
    const middleware = createSecurityHeadersMiddleware({
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        usb: [],
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    const permissionsPolicy = response.headers.get('Permissions-Policy')
    expect(permissionsPolicy).toContain('camera=()')
    expect(permissionsPolicy).toContain('microphone=()')
    expect(permissionsPolicy).toContain('geolocation=()')
    expect(permissionsPolicy).toContain('usb=()')
  })

  it('should support CSP report-only mode for testing', async () => {
    const middleware = createSecurityHeadersMiddleware({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        reportOnly: true,
        reportUri: '/csp-violations',
      },
    })

    const mockRequest = new Request('https://example.com/test')
    const mockContext = { request: mockRequest } as any
    const mockNext = async () => new Response('OK')

    const response = await middleware(mockContext, mockNext)

    // Should use report-only header
    expect(response.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy()
    expect(response.headers.get('Content-Security-Policy')).toBeNull()

    // Should include report-uri
    const cspReportOnly = response.headers.get('Content-Security-Policy-Report-Only')
    expect(cspReportOnly).toContain('report-uri /csp-violations')
  })
})
