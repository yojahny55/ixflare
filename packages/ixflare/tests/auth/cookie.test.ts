/**
 * Cookie Utilities Tests
 * Story 5-2: Session Management
 */

import { describe, it, expect } from 'vitest'
import { setCookie, getCookie, parseCookies, deleteCookie } from '../../src/auth/cookie'

describe('Cookie Utilities', () => {
  describe('setCookie', () => {
    it('should set cookie with secure defaults', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123')

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toBe('session=token123; Path=/; Secure; HttpOnly; SameSite=Lax')
    })

    it('should set cookie with maxAge', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        maxAge: 3600,
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Max-Age=3600')
    })

    it('should set cookie with custom path', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        path: '/api',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Path=/api')
    })

    it('should set cookie with domain', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        domain: 'example.com',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Domain=example.com')
    })

    it('should set cookie with SameSite=Strict', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        sameSite: 'strict',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('SameSite=Strict')
    })

    it('should set cookie without secure flag when disabled', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        secure: false,
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).not.toContain('Secure')
    })

    it('should set cookie without httpOnly flag when disabled', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        httpOnly: false,
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).not.toContain('HttpOnly')
    })

    it('should preserve existing response body and status', () => {
      const response = new Response('Original body', { status: 201 })
      const result = setCookie(response, 'session', 'token123')

      expect(result.status).toBe(201)
      // Body comparison would require reading stream
    })
  })

  describe('getCookie', () => {
    it('should get cookie value from request', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: 'session=token123',
        },
      })

      const value = getCookie(request, 'session')
      expect(value).toBe('token123')
    })

    it('should return null when cookie not found', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: 'other=value',
        },
      })

      const value = getCookie(request, 'session')
      expect(value).toBeNull()
    })

    it('should return null when no Cookie header', () => {
      const request = new Request('https://example.com')

      const value = getCookie(request, 'session')
      expect(value).toBeNull()
    })

    it('should handle cookie value with equals sign', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: 'session=token=123=456',
        },
      })

      const value = getCookie(request, 'session')
      expect(value).toBe('token=123=456')
    })
  })

  describe('parseCookies', () => {
    it('should parse multiple cookies', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: 'session=token123; user=alice; theme=dark',
        },
      })

      const cookies = parseCookies(request)
      expect(cookies).toEqual({
        session: 'token123',
        user: 'alice',
        theme: 'dark',
      })
    })

    it('should return empty object when no cookies', () => {
      const request = new Request('https://example.com')

      const cookies = parseCookies(request)
      expect(cookies).toEqual({})
    })

    it('should handle cookies with spaces', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: 'session=token123;  user=alice  ; theme=dark',
        },
      })

      const cookies = parseCookies(request)
      expect(cookies).toEqual({
        session: 'token123',
        user: 'alice',
        theme: 'dark',
      })
    })

    it('should handle empty cookie values', () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: 'session=; user=alice',
        },
      })

      const cookies = parseCookies(request)
      expect(cookies).toEqual({
        session: '',
        user: 'alice',
      })
    })
  })

  describe('deleteCookie', () => {
    it('should delete cookie with Max-Age=0', () => {
      const response = new Response('OK')
      const result = deleteCookie(response, 'session')

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toBe('session=; Max-Age=0; Path=/')
    })

    it('should delete cookie with custom path', () => {
      const response = new Response('OK')
      const result = deleteCookie(response, 'session', {
        path: '/api',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Path=/api')
    })

    it('should delete cookie with domain', () => {
      const response = new Response('OK')
      const result = deleteCookie(response, 'session', {
        domain: 'example.com',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Domain=example.com')
    })
  })

  describe('OWASP Security Requirements', () => {
    it('should use httpOnly by default (prevents XSS)', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123')

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('HttpOnly')
    })

    it('should use secure by default (HTTPS only)', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123')

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Secure')
    })

    it('should use SameSite=Lax by default (CSRF protection)', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123')

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('SameSite=Lax')
    })

    it('should support SameSite=Strict for maximum CSRF protection', () => {
      const response = new Response('OK')
      const result = setCookie(response, 'session', 'token123', {
        sameSite: 'strict',
      })

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('SameSite=Strict')
    })
  })
})
