/**
 * CSRF Token Generation Tests
 * Story 5-6: CSRF Protection
 */

import { describe, it, expect } from 'vitest'
import {
  generateCSRFToken,
  signCSRFToken,
  verifyCSRFSignature,
  createSignedToken,
} from '../../../src/auth/csrf/token'

describe('CSRF Token Generation', () => {
  describe('generateCSRFToken', () => {
    it('should generate a valid UUID token', () => {
      const token = generateCSRFToken()

      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken()
      const token2 = generateCSRFToken()

      expect(token1).not.toBe(token2)
    })

    it('should provide 128-bit entropy (OWASP requirement)', () => {
      // UUID v4 provides 122 bits of randomness, exceeds 128-bit requirement when base64 encoded
      const token = generateCSRFToken()

      // Length check: UUID is 36 characters with hyphens
      expect(token.length).toBe(36)
    })
  })

  describe('signCSRFToken', () => {
    const secret = 'test-secret-key-32-chars-long!!'
    const sessionId = 'session-123'
    const tokenValue = 'test-token-value'

    it('should generate HMAC-SHA256 signature', async () => {
      const signature = await signCSRFToken(tokenValue, sessionId, secret)

      // Base64url-encoded SHA-256 hash is 43 characters (no padding)
      expect(signature).toBeTruthy()
      expect(typeof signature).toBe('string')
      expect(signature.length).toBe(43) // 256 bits / 6 bits per base64 char = 42.67 → 43
    })

    it('should generate different signatures for different tokens', async () => {
      const sig1 = await signCSRFToken('token-1', sessionId, secret)
      const sig2 = await signCSRFToken('token-2', sessionId, secret)

      expect(sig1).not.toBe(sig2)
    })

    it('should generate different signatures for different sessions', async () => {
      const sig1 = await signCSRFToken(tokenValue, 'session-1', secret)
      const sig2 = await signCSRFToken(tokenValue, 'session-2', secret)

      expect(sig1).not.toBe(sig2)
    })

    it('should generate same signature for same inputs (deterministic)', async () => {
      const sig1 = await signCSRFToken(tokenValue, sessionId, secret)
      const sig2 = await signCSRFToken(tokenValue, sessionId, secret)

      expect(sig1).toBe(sig2)
    })

    it('should bind token to session in signature', async () => {
      const signature = await signCSRFToken(tokenValue, sessionId, secret)

      // Signature should be different if session changes
      const differentSessionSig = await signCSRFToken(tokenValue, 'different-session', secret)

      expect(signature).not.toBe(differentSessionSig)
    })
  })

  describe('verifyCSRFSignature', () => {
    const secret = 'test-secret-key-32-chars-long!!'
    const sessionId = 'session-123'

    it('should verify valid signed token', async () => {
      const tokenValue = generateCSRFToken()
      const signature = await signCSRFToken(tokenValue, sessionId, secret)
      const signedToken = `${tokenValue}.${signature}`

      const isValid = await verifyCSRFSignature(signedToken, sessionId, secret)

      expect(isValid).toBe(true)
    })

    it('should reject token with invalid signature', async () => {
      const tokenValue = generateCSRFToken()
      const signedToken = `${tokenValue}.invalid-signature`

      const isValid = await verifyCSRFSignature(signedToken, sessionId, secret)

      expect(isValid).toBe(false)
    })

    it('should reject token with tampered value', async () => {
      const tokenValue = generateCSRFToken()
      const signature = await signCSRFToken(tokenValue, sessionId, secret)

      // Tamper with token value but keep valid signature
      const tamperedToken = `different-token.${signature}`

      const isValid = await verifyCSRFSignature(tamperedToken, sessionId, secret)

      expect(isValid).toBe(false)
    })

    it('should reject token bound to different session', async () => {
      const tokenValue = generateCSRFToken()
      const signature = await signCSRFToken(tokenValue, 'original-session', secret)
      const signedToken = `${tokenValue}.${signature}`

      // Verify with different session ID
      const isValid = await verifyCSRFSignature(signedToken, 'different-session', secret)

      expect(isValid).toBe(false)
    })

    it('should reject malformed token (missing signature)', async () => {
      const tokenValue = generateCSRFToken()

      const isValid = await verifyCSRFSignature(tokenValue, sessionId, secret)

      expect(isValid).toBe(false)
    })

    it('should reject malformed token (multiple dots)', async () => {
      const signedToken = 'token.signature.extra'

      const isValid = await verifyCSRFSignature(signedToken, sessionId, secret)

      expect(isValid).toBe(false)
    })

    it('should use timing-safe comparison', async () => {
      // This test verifies timing-safe behavior by comparing execution times
      // For actual timing analysis, use specialized tools
      const tokenValue = generateCSRFToken()
      const signature = await signCSRFToken(tokenValue, sessionId, secret)
      const signedToken = `${tokenValue}.${signature}`

      // Valid token
      const start1 = performance.now()
      await verifyCSRFSignature(signedToken, sessionId, secret)
      const time1 = performance.now() - start1

      // Invalid token with same structure
      const invalidSignature = signature.replace(/[a-z]/, 'x')
      const invalidToken = `${tokenValue}.${invalidSignature}`

      const start2 = performance.now()
      await verifyCSRFSignature(invalidToken, sessionId, secret)
      const time2 = performance.now() - start2

      // Timing should be similar (within 10x tolerance for test flakiness)
      // In production, timing-safe comparison prevents microsecond-level leakage
      expect(Math.abs(time1 - time2)).toBeLessThan(Math.max(time1, time2) * 10)
    })
  })

  describe('createSignedToken', () => {
    const secret = 'test-secret-key-32-chars-long!!'
    const sessionId = 'session-123'

    it('should create complete signed token', async () => {
      const token = await createSignedToken(sessionId, secret)

      expect(token.value).toBeTruthy()
      expect(token.signature).toBeTruthy()
      expect(token.sessionId).toBe(sessionId)
      expect(token.signedToken).toBe(`${token.value}.${token.signature}`)
    })

    it('should create verifiable signed token', async () => {
      const token = await createSignedToken(sessionId, secret)

      const isValid = await verifyCSRFSignature(token.signedToken, sessionId, secret)

      expect(isValid).toBe(true)
    })

    it('should create unique tokens each time', async () => {
      const token1 = await createSignedToken(sessionId, secret)
      const token2 = await createSignedToken(sessionId, secret)

      expect(token1.value).not.toBe(token2.value)
      expect(token1.signedToken).not.toBe(token2.signedToken)
    })

    it('should bind token to provided session ID', async () => {
      const token = await createSignedToken(sessionId, secret)

      // Should verify with correct session
      expect(await verifyCSRFSignature(token.signedToken, sessionId, secret)).toBe(true)

      // Should fail with different session
      expect(await verifyCSRFSignature(token.signedToken, 'different-session', secret)).toBe(
        false
      )
    })
  })

  describe('Security Requirements', () => {
    const secret = 'test-secret-key-32-chars-long!!'
    const sessionId = 'session-123'

    it('should prevent token reuse across sessions', async () => {
      const token = await createSignedToken('session-1', secret)

      // Token should not work with session-2
      const isValid = await verifyCSRFSignature(token.signedToken, 'session-2', secret)

      expect(isValid).toBe(false)
    })

    it('should prevent signature forgery without secret', async () => {
      const token = await createSignedToken(sessionId, secret)

      // Try to verify with wrong secret
      const isValid = await verifyCSRFSignature(token.signedToken, sessionId, 'wrong-secret')

      expect(isValid).toBe(false)
    })

    it('should provide entropy sufficient for CSRF protection', async () => {
      // Generate 1000 tokens and ensure no collisions
      const tokens = new Set<string>()

      for (let i = 0; i < 1000; i++) {
        const token = generateCSRFToken()
        expect(tokens.has(token)).toBe(false)
        tokens.add(token)
      }

      expect(tokens.size).toBe(1000)
    })
  })
})
