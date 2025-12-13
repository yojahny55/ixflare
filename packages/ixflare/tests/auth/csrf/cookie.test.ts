/**
 * CSRF Cookie Management Tests
 * Story 5-6: CSRF Protection
 */

import { describe, it, expect } from 'vitest'
import { setCSRFCookie, getCSRFCookie } from '../../../src/auth/csrf/cookie'

describe('CSRF Cookie Management', () => {
  describe('setCSRFCookie', () => {
    it('should set CSRF cookie with default name', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('__csrf=')
      expect(setCookieHeader).toContain(signedToken)
    })

    it('should set cookie with custom name', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken, {
        cookie: '_custom_csrf',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('_custom_csrf=')
      expect(setCookieHeader).toContain(signedToken)
    })

    it('should set httpOnly=false for JavaScript access', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      // Should NOT contain HttpOnly (httpOnly=false)
      expect(setCookieHeader).not.toContain('HttpOnly')
    })

    it('should set Secure flag for HTTPS', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Secure')
    })

    it('should set SameSite=Strict by default', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('SameSite=Strict')
    })

    it('should allow custom SameSite value', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken, {
        sameSite: 'lax',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('SameSite=Lax')
    })

    it('should set Path=/', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Path=/')
    })

    it('should preserve original response body and status', () => {
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 201,
        statusText: 'Created',
      })
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      expect(result.status).toBe(201)
      expect(result.statusText).toBe('Created')
      expect(result.body).toBe(response.body)
    })
  })

  describe('getCSRFCookie', () => {
    it('should get CSRF cookie with default name', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '__csrf=token-value.signature',
        },
      })

      const token = getCSRFCookie(request)

      expect(token).toBe('token-value.signature')
    })

    it('should get cookie with custom name', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '_custom_csrf=token-value.signature',
        },
      })

      const token = getCSRFCookie(request, { cookie: '_custom_csrf' })

      expect(token).toBe('token-value.signature')
    })

    it('should return null if cookie not present', () => {
      const request = new Request('https://example.com')

      const token = getCSRFCookie(request)

      expect(token).toBeNull()
    })

    it('should parse cookie from multiple cookies', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '__session=sess-123; __csrf=token-value.signature; other=value',
        },
      })

      const token = getCSRFCookie(request)

      expect(token).toBe('token-value.signature')
    })

    it('should handle cookie with dots in value', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '__csrf=uuid-value.base64url-signature',
        },
      })

      const token = getCSRFCookie(request)

      expect(token).toBe('uuid-value.base64url-signature')
    })

    it('should return null for wrong cookie name', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '__csrf=token-value.signature',
        },
      })

      const token = getCSRFCookie(request, { cookie: '_different_name' })

      expect(token).toBeNull()
    })
  })

  describe('Security Requirements', () => {
    it('should create JavaScript-readable cookie (httpOnly=false)', () => {
      // CRITICAL: CSRF cookies MUST be readable by JavaScript for fetch requests
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).not.toContain('HttpOnly')
    })

    it('should apply SameSite for defense-in-depth', () => {
      // SameSite=Strict provides additional CSRF protection
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('SameSite=Strict')
    })

    it('should require HTTPS in production (Secure flag)', () => {
      const response = new Response('OK')
      const signedToken = 'token-value.signature'

      const result = setCSRFCookie(response, signedToken)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Secure')
    })
  })
})
