/**
 * CSRF Integration Tests
 * Story 5-6: CSRF Protection
 *
 * End-to-end tests for complete CSRF protection flow
 */

import { describe, it, expect } from 'vitest'
import { createSignedToken, setCSRFCookie, csrf, getCsrfToken } from '../../../src/auth/csrf'
import type { EdgeContext } from '../../../src/types/context'

const TEST_SECRET = 'integration-test-secret-32-chars'

/**
 * Create a mock EdgeContext for testing
 */
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

describe('CSRF Integration', () => {
  describe('Complete CSRF Flow', () => {
    it('should protect API endpoint with CSRF token', async () => {
      const sessionId = 'user-session-123'

      // Step 1: Generate signed CSRF token (server-side on initial page load)
      const token = await createSignedToken(sessionId, TEST_SECRET)

      // Step 2: Set CSRF cookie in response
      const initialResponse = new Response('Page loaded')
      const responseWithCookie = setCSRFCookie(initialResponse, token.signedToken)

      // Verify cookie is set
      const setCookieHeader = responseWithCookie.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('__csrf=')
      expect(setCookieHeader).toContain(token.signedToken)
      expect(setCookieHeader).toContain('SameSite=Strict')
      expect(setCookieHeader).not.toContain('HttpOnly') // Must be readable by JS

      // Step 3: Client makes POST request with token in header
      const postRequest = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token.value, // Token value from cookie (client-side)
          Cookie: `__csrf=${token.signedToken}`, // Signed token in cookie
        },
        body: JSON.stringify({ title: 'New Post' }),
      })

      // Step 4: CSRF middleware validates token
      const ctx = createMockContext(postRequest, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })

      let handlerCalled = false
      const next = async () => {
        handlerCalled = true
        return new Response(JSON.stringify({ id: 1, title: 'New Post' }))
      }

      const response = await middleware(ctx, next)

      // Verify request was allowed through
      expect(handlerCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should protect form submission with hidden input', async () => {
      const sessionId = 'user-session-456'

      // Step 1: Generate and set CSRF token
      const token = await createSignedToken(sessionId, TEST_SECRET)
      const pageResponse = setCSRFCookie(new Response('Form page'), token.signedToken)

      // Step 2: Form submitted with hidden _csrf field
      const formData = new FormData()
      formData.append('_csrf', token.value) // Hidden input value
      formData.append('title', 'New Post')
      formData.append('content', 'Post content')

      const formRequest = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          Cookie: `__csrf=${token.signedToken}`,
        },
        body: formData,
      })

      // Step 3: CSRF middleware validates token from form
      const ctx = createMockContext(formRequest, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })

      let handlerCalled = false
      const next = async () => {
        handlerCalled = true
        return new Response('Post created')
      }

      const response = await middleware(ctx, next)

      expect(handlerCalled).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should block request without CSRF token', async () => {
      const sessionId = 'user-session-789'

      // Request without CSRF token
      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Malicious Post' }),
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('Should not reach here')

      // Should throw CSRFInvalidError
      await expect(middleware(ctx, next)).rejects.toThrow('Invalid or missing CSRF token')
    })

    it('should block cross-site request with stolen token', async () => {
      const victimSession = 'victim-session-123'
      const attackerSession = 'attacker-session-456'

      // Attacker steals token from victim's session
      const stolenToken = await createSignedToken(victimSession, TEST_SECRET)

      // Attacker tries to use stolen token with their own session
      const maliciousRequest = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': stolenToken.value,
          Cookie: `__csrf=${stolenToken.signedToken}`,
        },
        body: JSON.stringify({ title: 'Malicious Post' }),
      })

      // Request has attacker's session (different from token's session)
      const ctx = createMockContext(maliciousRequest, { id: attackerSession })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('Should not reach here')

      // Should reject due to session mismatch
      await expect(middleware(ctx, next)).rejects.toThrow('Invalid or missing CSRF token')
    })
  })

  describe('Multi-Step Attack Scenarios', () => {
    it('should prevent session fixation + CSRF attack', async () => {
      // Attacker creates a token bound to their session
      const attackerSession = 'attacker-session'
      const attackerToken = await createSignedToken(attackerSession, TEST_SECRET)

      // Attacker tries to trick victim into using attacker's session
      // (e.g., via session fixation attack)
      const victimRequest = new Request('https://example.com/api/transfer', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': attackerToken.value,
          Cookie: `__csrf=${attackerToken.signedToken}`,
        },
        body: JSON.stringify({ to: 'attacker', amount: 1000 }),
      })

      // But victim has their own session
      const victimSession = 'victim-session'
      const ctx = createMockContext(victimRequest, { id: victimSession })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('Transfer complete')

      // Should reject because token is bound to attacker's session
      await expect(middleware(ctx, next)).rejects.toThrow('Invalid or missing CSRF token')
    })

    it('should prevent subdomain cookie injection attack', async () => {
      const sessionId = 'user-session-123'

      // Attacker on subdomain tries to set malicious CSRF cookie
      // But cookie signature won't verify because attacker doesn't have secret
      const maliciousToken = 'malicious-token'
      const maliciousSignature = 'fake-signature'
      const maliciousCookie = `${maliciousToken}.${maliciousSignature}`

      const request = new Request('https://example.com/api/posts', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': maliciousToken,
          Cookie: `__csrf=${maliciousCookie}`,
        },
        body: JSON.stringify({ title: 'Malicious Post' }),
      })

      const ctx = createMockContext(request, { id: sessionId })
      const middleware = csrf({ secret: TEST_SECRET })
      const next = async () => new Response('Should not reach here')

      // Should reject due to invalid signature
      await expect(middleware(ctx, next)).rejects.toThrow('Invalid or missing CSRF token')
    })
  })

  describe('Client-Side Integration', () => {
    it('should extract token from cookie for fetch requests', () => {
      // Simulate browser environment
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature; __session=sess-123',
      }

      const token = getCsrfToken()

      expect(token).toBe('token-value')

      delete (global as any).document
    })
  })

  describe('Export Verification', () => {
    it('should export all CSRF components from auth module', async () => {
      // Verify imports work as expected from main auth module
      const { csrf: csrfModule } = await import('../../../src/auth')

      expect(csrfModule).toBeDefined()
      expect(csrfModule.csrf).toBeDefined()
      expect(csrfModule.createSignedToken).toBeDefined()
      expect(csrfModule.setCSRFCookie).toBeDefined()
      expect(csrfModule.getCsrfToken).toBeDefined()
      expect(csrfModule.CSRFError).toBeDefined()
      expect(csrfModule.CSRFInvalidError).toBeDefined()
    })
  })
})
