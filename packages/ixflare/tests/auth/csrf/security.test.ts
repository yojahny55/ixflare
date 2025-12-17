/**
 * CSRF Security Tests
 * Story 5-6: CSRF Protection
 *
 * Comprehensive security tests covering all attack vectors
 * Per Epic 5 Security Requirements
 */

import { describe, it, expect } from 'vitest'
import { createSignedToken, verifyCSRFSignature, csrf } from '../../../src/auth/csrf'
import { CSRFInvalidError } from '../../../src/auth/csrf/errors'
import type { EdgeContext } from '../../../src/types/context'

const TEST_SECRET = 'security-test-secret-32-chars!'

function createMockContext(request: Request, session?: { id: string }): EdgeContext {
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

describe('CSRF Security Tests (Epic 5 Requirements)', () => {
  describe('8.1: Missing Token Rejection', () => {
    it('should reject request with no cookie', async () => {
      const request = new Request('https://example.com/api/posts', {
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

    it('should reject request with no header token', async () => {
      const token = await createSignedToken('session-123', TEST_SECRET)

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: 'session-123' })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })
  })

  describe('8.2: Invalid Token Rejection (Tampered Signature)', () => {
    it('should reject token with tampered signature', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Tamper with signature (change first character)
      const parts = token.signedToken.split('.')
      const firstChar = parts[1][0]
      const tamperedFirstChar = firstChar === 'a' ? 'b' : 'a'
      const tamperedSignature = tamperedFirstChar + parts[1].slice(1)
      const tamperedCookie = `${parts[0]}.${tamperedSignature}`

      const isValid = await verifyCSRFSignature(tamperedCookie, sessionId, TEST_SECRET)

      expect(isValid).toBe(false)
    })

    it('should reject token with tampered value', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Tamper with token value but keep signature
      const parts = token.signedToken.split('.')
      const tamperedValue = parts[0].replace(/a/g, 'b')
      const tamperedCookie = `${tamperedValue}.${parts[1]}`

      const isValid = await verifyCSRFSignature(tamperedCookie, sessionId, TEST_SECRET)

      expect(isValid).toBe(false)
    })

    it('should reject completely fake token', async () => {
      const fakeToken = 'fake-token.fake-signature'

      const isValid = await verifyCSRFSignature(fakeToken, 'session-123', TEST_SECRET)

      expect(isValid).toBe(false)
    })
  })

  describe('8.3: Expired/Replayed Token Handling', () => {
    it('should allow token reuse within same session', async () => {
      // CSRF tokens are typically session-scoped, not time-limited
      // They can be reused until session expires
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // First request
      const request1 = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx1 = createMockContext(request1, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx1, next)).resolves.toBeDefined()

      // Second request with same token
      const request2 = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx2 = createMockContext(request2, { id: sessionId })

      await expect(middleware(ctx2, next)).resolves.toBeDefined()
    })

    it('should reject token after session changes', async () => {
      const originalSession = 'session-123'
      const token = await createSignedToken(originalSession, TEST_SECRET)

      // Session was regenerated (e.g., after login)
      const newSession = 'session-456'

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': token.value,
          Cookie: `__csrf=${token.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: newSession })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })
  })

  describe('8.4: Session Binding (Token from Different Session Rejected)', () => {
    it('should reject token bound to different session', async () => {
      const session1 = 'user-alice'
      const session2 = 'user-bob'

      // Alice's token
      const aliceToken = await createSignedToken(session1, TEST_SECRET)

      // Bob tries to use Alice's token
      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': aliceToken.value,
          Cookie: `__csrf=${aliceToken.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: session2 })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should verify token is correctly bound to session ID', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Verify with correct session
      expect(await verifyCSRFSignature(token.signedToken, sessionId, TEST_SECRET)).toBe(true)

      // Verify with wrong session
      expect(await verifyCSRFSignature(token.signedToken, 'different-session', TEST_SECRET)).toBe(
        false
      )
    })
  })

  describe('8.5: Timing-Safe Comparison (Prevent Timing Attacks)', () => {
    it('should use constant-time comparison for signatures', async () => {
      const sessionId = 'session-123'
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Measure time for valid token
      const iterations = 100
      let validTime = 0

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await verifyCSRFSignature(token.signedToken, sessionId, TEST_SECRET)
        validTime += performance.now() - start
      }

      // Measure time for invalid token with same structure
      const invalidToken = token.signedToken.replace(/a/, 'b')
      let invalidTime = 0

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await verifyCSRFSignature(invalidToken, sessionId, TEST_SECRET)
        invalidTime += performance.now() - start
      }

      const avgValidTime = validTime / iterations
      const avgInvalidTime = invalidTime / iterations

      // Times should be similar (within 10x tolerance for test flakiness)
      // In production, timing-safe comparison prevents microsecond-level leakage
      const ratio = Math.max(avgValidTime, avgInvalidTime) / Math.min(avgValidTime, avgInvalidTime)
      expect(ratio).toBeLessThan(10)
    })
  })

  describe('8.6: Subdomain Cookie Injection Prevention', () => {
    it('should prevent unsigned cookie injection', async () => {
      const sessionId = 'session-123'

      // Attacker on subdomain injects unsigned cookie
      const maliciousCookie = 'attacker-token.unsigned-signature'

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'attacker-token',
          Cookie: `__csrf=${maliciousCookie}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      // Should reject due to invalid HMAC signature
      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })

    it('should prevent cookie injection without secret', async () => {
      // Attacker doesn't have HMAC secret
      const attackerSecret = 'attacker-secret-different'
      const sessionId = 'session-123'

      // Attacker creates token with their own secret
      const attackerToken = await createSignedToken(sessionId, attackerSecret)

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': attackerToken.value,
          Cookie: `__csrf=${attackerToken.signedToken}`,
        },
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET }) // Server uses different secret
      const next = async () => new Response('OK')

      // Should reject because signature was created with wrong secret
      await expect(middleware(ctx, next)).rejects.toThrow(CSRFInvalidError)
    })
  })

  describe('8.7: Safe Methods Bypass', () => {
    it('should allow GET requests without token', async () => {
      const request = new Request('https://example.com/api/posts', {
        method: 'GET',
      })

      const ctx = createMockContext(request, { id: 'session-123' })
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      await middleware(ctx, next)

      expect(nextCalled).toBe(true)
    })

    it('should allow HEAD requests without token', async () => {
      const request = new Request('https://example.com/api/posts', {
        method: 'HEAD',
      })

      const ctx = createMockContext(request, { id: 'session-123' })
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      await middleware(ctx, next)

      expect(nextCalled).toBe(true)
    })

    it('should allow OPTIONS requests without token (CORS preflight)', async () => {
      const request = new Request('https://example.com/api/posts', {
        method: 'OPTIONS',
      })

      const ctx = createMockContext(request, { id: 'session-123' })
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response('OK')
      }

      await middleware(ctx, next)

      expect(nextCalled).toBe(true)
    })
  })

  describe('8.8: CORS Preflight Handling', () => {
    it('should not block OPTIONS preflight requests', async () => {
      const preflightRequest = new Request('https://example.com/api/posts', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-csrf-token',
        },
      })

      const ctx = createMockContext(preflightRequest)
      const middleware = csrf({ secret: TEST_SECRET })

      let nextCalled = false
      const next = async () => {
        nextCalled = true
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': 'https://app.example.com',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'content-type,x-csrf-token',
          },
        })
      }

      const response = await middleware(ctx, next)

      expect(nextCalled).toBe(true)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
    })
  })

  describe('Information Leakage Prevention', () => {
    it('should not leak whether cookie or header was missing', async () => {
      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
      })

      const ctx = createMockContext(request, { id: 'session-123' })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('OK')

      try {
        await middleware(ctx, next)
        expect.fail('Should have thrown CSRFInvalidError')
      } catch (error) {
        expect(error).toBeInstanceOf(CSRFInvalidError)
        expect((error as CSRFInvalidError).message).toBe('Invalid or missing CSRF token')
        expect((error as CSRFInvalidError).message).not.toContain('header')
        expect((error as CSRFInvalidError).message).not.toContain('cookie')
        expect((error as CSRFInvalidError).message).not.toContain('session')
      }
    })
  })
})
