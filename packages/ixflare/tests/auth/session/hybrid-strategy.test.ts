/**
 * Hybrid Session Strategy Tests
 * Story 5-2: Session Management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { HybridSessionStrategy } from '../../../src/auth/session/hybrid-strategy'
import * as jwt from '../../../src/auth/jwt'
import {
  SessionExpiredError,
  SessionRevokedError,
  InvalidSessionError,
} from '../../../src/auth/session/errors'
import type { SessionConfig } from '../../../src/auth/session/types'

/**
 * Mock KV namespace for testing
 */
class MockKV implements KVNamespace {
  private store = new Map<string, { value: string; expiration?: number }>()

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    if (!item) return null

    // Check expiration
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key)
      return null
    }

    return item.value
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined

    this.store.set(key, { value, expiration })
  }

  // Not implemented for tests
  async delete(): Promise<void> {}
  async list(): Promise<any> {
    return {}
  }
  async getWithMetadata(): Promise<any> {
    return { value: null, metadata: null }
  }
}

describe('HybridSessionStrategy', () => {
  let strategy: HybridSessionStrategy
  let config: SessionConfig
  let mockKV: MockKV

  beforeEach(() => {
    // Configure JWT with HS256
    jwt.configure({
      algorithm: 'HS256',
      secret: 'test-secret-key-at-least-32-characters-long',
      defaultExpiresIn: '15m',
    })

    mockKV = new MockKV()

    config = {
      strategy: 'hybrid',
      cookie: {
        name: '__session',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
      kv: mockKV as unknown as KVNamespace,
    }

    strategy = new HybridSessionStrategy(config)
  })

  describe('create', () => {
    it('should create session with JWT token', async () => {
      const result = await strategy.create({
        userId: 'user-123',
        role: 'admin',
        device: 'Mozilla/5.0',
      })

      expect(result.token).toBeTruthy()
      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )

      // Verify token is valid JWT
      const decoded = jwt.decode(result.token)
      expect(decoded.payload.sessionId).toBe(result.sessionId)
      expect(decoded.payload.userId).toBe('user-123')
      expect(decoded.payload.role).toBe('admin')
    })

    it('should generate unique session IDs', async () => {
      const result1 = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      const result2 = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      expect(result1.sessionId).not.toBe(result2.sessionId)
    })
  })

  describe('get', () => {
    it('should get session data from valid non-revoked JWT', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
        device: 'Mozilla/5.0',
      })

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      const session = await strategy.get(request)

      expect(session).toMatchObject({
        sessionId: created.sessionId,
        userId: 'user-123',
        role: 'admin',
        device: 'Mozilla/5.0',
      })
    })

    it('should throw SessionRevokedError for revoked session', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Revoke session
      await strategy.revoke(created.sessionId)

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      await expect(strategy.get(request)).rejects.toThrow(SessionRevokedError)
    })

    it('should throw SessionRevokedError when all user sessions revoked', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Wait 1100ms to ensure revocation timestamp is in a different second
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Revoke all user sessions
      await strategy.revokeAll('user-123')

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      await expect(strategy.get(request)).rejects.toThrow(SessionRevokedError)
    })

    it('should return null when no cookie present', async () => {
      const request = new Request('https://example.com')

      const session = await strategy.get(request)

      expect(session).toBeNull()
    })

    it('should return null for invalid JWT', async () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '__session=invalid.jwt.token',
        },
      })

      const session = await strategy.get(request)

      expect(session).toBeNull()
    })
  })

  describe('isValid', () => {
    it('should return true for valid non-revoked session', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      const isValid = await strategy.isValid(request)

      expect(isValid).toBe(true)
    })

    it('should return false for revoked session', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      await strategy.revoke(created.sessionId)

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      const isValid = await strategy.isValid(request)

      expect(isValid).toBe(false)
    })

    it('should return false for invalid token', async () => {
      const request = new Request('https://example.com', {
        headers: {
          Cookie: '__session=invalid.jwt.token',
        },
      })

      const isValid = await strategy.isValid(request)

      expect(isValid).toBe(false)
    })
  })

  describe('revoke', () => {
    it('should revoke specific session', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Revoke session
      await strategy.revoke(created.sessionId)

      // Verify session is revoked
      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      await expect(strategy.get(request)).rejects.toThrow(SessionRevokedError)
    })

    it('should store revocation in KV with correct key format', async () => {
      const sessionId = crypto.randomUUID()
      await strategy.revoke(sessionId)

      const key = `revoked:session:${sessionId}`
      const value = await mockKV.get(key)

      expect(value).toBeTruthy()
      const data = JSON.parse(value!)
      expect(data.revokedAt).toBeGreaterThan(0)
    })
  })

  describe('revokeAll', () => {
    it('should revoke all user sessions', async () => {
      const session1 = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      const session2 = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Wait 1100ms to ensure revocation timestamp is in a different second
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Revoke all user sessions
      await strategy.revokeAll('user-123')

      // Both sessions should be revoked
      const request1 = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${session1.token}`,
        },
      })

      const request2 = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${session2.token}`,
        },
      })

      await expect(strategy.get(request1)).rejects.toThrow(SessionRevokedError)
      await expect(strategy.get(request2)).rejects.toThrow(SessionRevokedError)
    })

    it('should not revoke sessions created after revokeAll', async () => {
      // Revoke all user sessions
      await strategy.revokeAll('user-123')

      // Wait 1100ms to ensure new session iat is in a different second
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Create new session after revocation
      const newSession = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${newSession.token}`,
        },
      })

      // New session should be valid
      const session = await strategy.get(request)
      expect(session).toBeTruthy()
      expect(session!.sessionId).toBe(newSession.sessionId)
    })

    it('should store revocation in KV with correct key format', async () => {
      await strategy.revokeAll('user-123')

      const key = 'revoked:user:user-123'
      const value = await mockKV.get(key)

      expect(value).toBeTruthy()
      const data = JSON.parse(value!)
      expect(data.revokedAt).toBeGreaterThan(0)
    })
  })

  describe('destroy', () => {
    it('should delete session cookie', () => {
      const response = new Response('OK')
      const result = strategy.destroy(response)

      const setCookieHeader = result.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('__session=')
      expect(setCookieHeader).toContain('Max-Age=0')
    })
  })

  describe('regenerate', () => {
    it('should create new session with new session ID', async () => {
      const original = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      const regenerated = await strategy.regenerate({
        userId: 'user-123',
        role: 'admin',
      })

      // New session ID
      expect(regenerated.sessionId).not.toBe(original.sessionId)

      // New token
      expect(regenerated.token).not.toBe(original.token)
    })
  })

  describe('Session Fixation Prevention (AC7)', () => {
    it('should regenerate session ID after authentication', async () => {
      // Simulate pre-auth session
      const preAuth = await strategy.create({
        userId: 'anonymous',
        role: 'guest',
      })

      // After login, regenerate session
      const postAuth = await strategy.regenerate({
        userId: 'user-123',
        role: 'admin',
      })

      // Session ID MUST be different
      expect(postAuth.sessionId).not.toBe(preAuth.sessionId)
    })
  })

  describe('OWASP Security Requirements', () => {
    it('should use crypto.randomUUID for session ID (128-bit entropy)', async () => {
      const result = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should check revocation before trusting session', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Revoke session
      await strategy.revoke(created.sessionId)

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created.token}`,
        },
      })

      // Should reject revoked session
      await expect(strategy.get(request)).rejects.toThrow(SessionRevokedError)
    })
  })

  describe('Configuration Validation', () => {
    it('should throw error when KV namespace not provided', () => {
      const invalidConfig = {
        strategy: 'hybrid' as const,
        cookie: {
          name: '__session',
          httpOnly: true,
          secure: true,
          sameSite: 'lax' as const,
          maxAge: 604800,
        },
        // Missing kv
      }

      expect(() => new HybridSessionStrategy(invalidConfig)).toThrow(
        'KV namespace required for hybrid session strategy'
      )
    })
  })
})
