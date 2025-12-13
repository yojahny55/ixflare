/**
 * CSRF Middleware Tests
 * Story 5-6: CSRF Protection
 */

import { describe, it, expect } from 'vitest'
import { csrf } from '../../../src/auth/csrf/middleware'
import { createSignedToken } from '../../../src/auth/csrf/token'
import { setCSRFCookie } from '../../../src/auth/csrf/cookie'
import { CSRFInvalidError } from '../../../src/auth/csrf/errors'
import type { EdgeContext } from '../../../src/types/context'

const TEST_SECRET = 'test-secret-key-for-csrf-32-chars'

/**
 * Create a mock EdgeContext for testing
 */
function createMockContext(
  request: Request,
  session?: { id: string }
): EdgeContext {
  const url = new URL(request.url)

  return {
    request,
    env: {},
    ctx: {} as ExecutionContext,
    params: {},
    query: new URLSearchParams(url.search),
    url,
    method: request.method,
    headers: request.headers,
    session,
  } as any
}

describe('CSRF Middleware', () => {
  describe('Safe Methods (GET, HEAD, OPTIONS)', () => {
    it('should allow GET requests without CSRF token', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users', {
        method: 'GET',
      })
      const ctx = createMockContext(request)

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should allow HEAD requests without CSRF token', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users', {
        method: 'HEAD',
      })
      const ctx = createMockContext(request)

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      await middleware(ctx, next)

      expect(nextCalled).toBe(true)
    })

    it('should allow OPTIONS requests without CSRF token', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users', {
        method: 'OPTIONS',
      })
      const ctx = createMockContext(request)

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      await middleware(ctx, next)

      expect(nextCalled).toBe(true)
    })
  })

  describe('State-Changing Methods (POST, PUT, PATCH, DELETE)', () => {
    it('should require CSRF token for POST requests', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users', {
        method: 'POST',
      })
      const ctx = createMockContext(request, { id: 'session-123' })

      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should require CSRF token for PUT requests', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users/1', {
        method: 'PUT',
      })
      const ctx = createMockContext(request, { id: 'session-123' })

      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should require CSRF token for PATCH requests', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users/1', {
        method: 'PATCH',
      })
      const ctx = createMockContext(request, { id: 'session-123' })

      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should require CSRF token for DELETE requests', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users/1', {
        method: 'DELETE',
      })
      const ctx = createMockContext(request, { id: 'session-123' })

      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })
  })

  describe('Header-Based Token Validation', () => {
    it('should accept valid CSRF token in header', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Create request with CSRF token in header and cookie
      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should reject invalid token in header', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'invalid-token',
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should reject request with missing header token', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })
  })

  describe('Form-Based Token Validation', () => {
    it('should accept valid CSRF token in form body', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const formData = new FormData()
      formData.append('_csrf', token.value)
      formData.append('title', 'New Post')

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          Cookie: `__csrf=${token.signedToken}`,
        },
        body: formData,
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should accept token in URL-encoded form', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const body = new URLSearchParams()
      body.append('_csrf', token.value)
      body.append('title', 'New Post')

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `__csrf=${token.signedToken}`,
        },
        body: body.toString(),
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })
  })

  describe('Session Binding Validation', () => {
    it('should reject token from different session', async () => {
      const originalSession = 'session-123'
      const differentSession = 'session-456'

      // Create token bound to original session
      const token = await createSignedToken(originalSession, TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      // Request with different session
      const ctx = createMockContext(request, { id: differentSession })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should reject request without session', async () => {
      const token = await createSignedToken('session-123', TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      // No session provided
      const ctx = createMockContext(request)
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should support session from cookie fallback', async () => {
      const sessionId = 'session-from-cookie'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__session=${sessionId}; __csrf=${token.signedToken}`,
        },
      })

      // No session in context, should fall back to cookie
      const ctx = createMockContext(request)
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })
  })

  describe('Cookie Validation', () => {
    it('should reject request with missing CSRF cookie', async () => {
      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'some-token',
        },
      })

      const ctx = createMockContext(request, { id: 'session-123' })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should reject request with tampered cookie signature', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Tamper with signature
      const tamperedCookie = `${token.value}.tampered-signature`

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${tamperedCookie}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })
  })

  describe('Custom Configuration', () => {
    it('should support custom cookie name', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `_custom_csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET, cookie: '_custom_csrf' })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should support custom header name', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const request = new Request('https://example.com/api/users', {
        method: 'POST',
        headers: {
          'X-Custom-CSRF': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET, header: 'X-Custom-CSRF' })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should support custom body field name', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      const formData = new FormData()
      formData.append('_custom_token', token.value)

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          Cookie: `__csrf=${token.signedToken}`,
        },
        body: formData,
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET, bodyField: '_custom_token' })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.status).toBe(200)
    })
  })

  describe('Error Messages', () => {
    it('should not leak implementation details in errors', async () => {
      const middleware = csrf({ secret: TEST_SECRET })
      const request = new Request('https://example.com/api/users', {
        method: 'POST',
      })
      const ctx = createMockContext(request, { id: 'session-123' })
      const next = async () => new Response('OK')

      try {
        await middleware(ctx, next)
        expect.fail('Should have thrown CSRFInvalidError')
      } catch (error) {
        // Error message should be generic
        expect(error).toBeInstanceOf(CSRFInvalidError)
        expect((error as CSRFInvalidError).message).toBe('Invalid or missing CSRF token')

        // Should not indicate whether token, cookie, or session was missing
        expect((error as CSRFInvalidError).message).not.toContain('header')
        expect((error as CSRFInvalidError).message).not.toContain('cookie')
        expect((error as CSRFInvalidError).message).not.toContain('session')
      }
    })
  })

  describe('Configuration Validation', () => {
    it('should throw error if secret not provided', () => {
      expect(() => csrf({})).toThrow('CSRF middleware requires a secret')
    })

    it('should throw error if secret is empty string', () => {
      expect(() => csrf({ secret: '' })).toThrow('CSRF middleware requires a secret')
    })
  })
})
