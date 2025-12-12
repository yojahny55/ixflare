/**
 * Session Manager Integration Tests
 * Story 5-2: Session Management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { session } from '../../../src/auth/session/session-manager'
import * as jwt from '../../../src/auth/jwt'
import type { SessionConfig } from '../../../src/auth/session/types'

/**
 * Mock KV namespace for testing
 */
class MockKV implements KVNamespace {
  private store = new Map<string, { value: string; expiration?: number }>()

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    if (!item) return null
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

  async delete(): Promise<void> {}
  async list(): Promise<any> {
    return {}
  }
  async getWithMetadata(): Promise<any> {
    return { value: null, metadata: null }
  }
}

describe('Session Manager', () => {
  beforeEach(() => {
    // Configure JWT for tests
    jwt.configure({
      algorithm: 'HS256',
      secret: 'test-secret-key-at-least-32-characters-long',
      defaultExpiresIn: '15m',
    })
  })

  describe('JWT Strategy', () => {
    beforeEach(() => {
      session.configure({
        strategy: 'jwt',
        cookie: {
          name: '__session',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 604800, // 7 days
        },
      })
    })

    it('should create session and set cookie', async () => {
      const response = await session.create({
        userId: 'user-123',
        role: 'admin',
        device: 'Mozilla/5.0',
      })

      const setCookieHeader = response.headers.get('Set-Cookie')
      expect(setCookieHeader).toBeTruthy()
      expect(setCookieHeader).toContain('__session=')
      expect(setCookieHeader).toContain('HttpOnly')
      expect(setCookieHeader).toContain('Secure')
    })

    it('should get session from request', async () => {
      const createResponse = await session.create({
        userId: 'user-123',
        role: 'admin',
      })

      const setCookieHeader = createResponse.headers.get('Set-Cookie')!
      const token = setCookieHeader.split(';')[0].split('=')[1]

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${token}`,
        },
      })

      const sessionData = await session.get(request)

      expect(sessionData).toMatchObject({
        userId: 'user-123',
        role: 'admin',
      })
    })

    it('should destroy session', async () => {
      const response = session.destroy()

      const setCookieHeader = response.headers.get('Set-Cookie')
      expect(setCookieHeader).toContain('Max-Age=0')
    })

    it('should regenerate session with new session ID', async () => {
      const original = await session.create({
        userId: 'user-123',
        role: 'user',
      })

      const originalToken = original.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]

      const regenerated = await session.regenerate(
        {
          userId: 'user-123',
          role: 'admin', // Changed role
        }
        // Note: oldSessionId not passed for JWT strategy (no revocation support)
      )

      const regeneratedToken = regenerated.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]

      // Tokens should be different
      expect(regeneratedToken).not.toBe(originalToken)

      // Verify new token has updated data
      const decoded = jwt.decode(regeneratedToken)
      expect(decoded.payload.role).toBe('admin')
    })

    it('should throw error when revoking (JWT does not support revocation)', async () => {
      await expect(session.revoke('session-123')).rejects.toThrow(
        'jwt strategy does not support revocation'
      )
    })

    it('should throw error when revoking all (JWT does not support revocation)', async () => {
      await expect(session.revokeAll('user-123')).rejects.toThrow(
        'jwt strategy does not support revokeAll'
      )
    })
  })

  describe('Hybrid Strategy', () => {
    let mockKV: MockKV

    beforeEach(() => {
      mockKV = new MockKV()

      session.configure({
        strategy: 'hybrid',
        cookie: {
          name: '__session',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 604800, // 7 days
        },
        kv: mockKV as unknown as KVNamespace,
      })
    })

    it('should create session with hybrid strategy', async () => {
      const response = await session.create({
        userId: 'user-123',
        role: 'admin',
      })

      const setCookieHeader = response.headers.get('Set-Cookie')
      expect(setCookieHeader).toBeTruthy()
      expect(setCookieHeader).toContain('__session=')
    })

    it('should revoke specific session', async () => {
      const createResponse = await session.create({
        userId: 'user-123',
        role: 'admin',
      })

      const setCookieHeader = createResponse.headers.get('Set-Cookie')!
      const token = setCookieHeader.split(';')[0].split('=')[1]
      const decoded = jwt.decode(token)
      const sessionId = decoded.payload.sessionId as string

      // Revoke session
      await session.revoke(sessionId)

      // Verify session is revoked
      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${token}`,
        },
      })

      const isValid = await session.isValid(request)
      expect(isValid).toBe(false)
    })

    it('should revoke all user sessions', async () => {
      const session1 = await session.create({
        userId: 'user-123',
        role: 'admin',
      })

      const session2 = await session.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Wait to ensure revocation timestamp is after token iat
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Revoke all user sessions
      await session.revokeAll('user-123')

      // Both sessions should be invalid
      const token1 = session1.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]
      const token2 = session2.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]

      const request1 = new Request('https://example.com', {
        headers: { Cookie: `__session=${token1}` },
      })

      const request2 = new Request('https://example.com', {
        headers: { Cookie: `__session=${token2}` },
      })

      expect(await session.isValid(request1)).toBe(false)
      expect(await session.isValid(request2)).toBe(false)
    })

    describe('Session Fixation Prevention (AC7)', () => {
      it('should revoke old session when using regenerate with oldSessionId', async () => {
        // Create initial session
        const createResponse = await session.create({
          userId: 'anonymous',
          role: 'guest',
        })

        const token = createResponse.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]
        const decoded = jwt.decode(token)
        const oldSessionId = decoded.payload.sessionId as string

        // Create request with old session
        const oldRequest = new Request('https://example.com', {
          headers: { Cookie: `__session=${token}` },
        })

        // Verify old session is valid
        expect(await session.isValid(oldRequest)).toBe(true)

        // Regenerate with old session ID (AC7: invalidate old session)
        await session.regenerate({ userId: 'user-123', role: 'admin' }, { oldSessionId })

        // CRITICAL: Old session MUST be revoked
        expect(await session.isValid(oldRequest)).toBe(false)
      })

      it('should regenerate and revoke old session using regenerateFromRequest', async () => {
        // Create initial session
        const createResponse = await session.create({
          userId: 'anonymous',
          role: 'guest',
        })

        const token = createResponse.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]

        // Create request with old session
        const request = new Request('https://example.com', {
          headers: { Cookie: `__session=${token}` },
        })

        // Verify old session is valid
        expect(await session.isValid(request)).toBe(true)

        // Use convenience method to regenerate from request
        const newResponse = await session.regenerateFromRequest(request, {
          userId: 'user-123',
          role: 'admin',
        })

        expect(newResponse).toBeTruthy()

        // Get new token
        const newToken = newResponse!.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]
        expect(newToken).not.toBe(token)

        // CRITICAL: Old session MUST be revoked
        expect(await session.isValid(request)).toBe(false)

        // New session should be valid
        const newRequest = new Request('https://example.com', {
          headers: { Cookie: `__session=${newToken}` },
        })
        expect(await session.isValid(newRequest)).toBe(true)
      })

      it('should return null from regenerateFromRequest if no valid session exists', async () => {
        const request = new Request('https://example.com')

        const result = await session.regenerateFromRequest(request, {
          userId: 'user-123',
          role: 'admin',
        })

        expect(result).toBeNull()
      })
    })
  })

  describe('Session Refresh (Sliding Window)', () => {
    beforeEach(() => {
      session.configure({
        strategy: 'jwt',
        cookie: {
          name: '__session',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 300, // 5 minutes (short for testing)
        },
        refresh: {
          threshold: 240, // Refresh when 4 minutes remaining
          gracePeriod: 60, // 1 minute grace period
        },
      })
    })

    it('should not refresh session far from expiry', async () => {
      const createResponse = await session.create({
        userId: 'user-123',
        role: 'admin',
      })

      const token = createResponse.headers.get('Set-Cookie')!.split(';')[0].split('=')[1]

      const request = new Request('https://example.com', {
        headers: { Cookie: `__session=${token}` },
      })

      const refreshResponse = await session.refresh(request)

      // No refresh needed (null returned)
      expect(refreshResponse).toBeNull()
    })
  })

  describe('Configuration', () => {
    it('should throw error when not configured', async () => {
      // Create new session manager instance (not configured)
      const unconfiguredSession = new (session.constructor as any)()

      await expect(
        unconfiguredSession.create({
          userId: 'user-123',
          role: 'admin',
        })
      ).rejects.toThrow('Session manager not configured')
    })

    it('should throw error for unknown strategy', () => {
      expect(() => {
        session.configure({
          strategy: 'unknown' as any,
          cookie: {
            name: '__session',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 604800,
          },
        })
      }).toThrow('Unknown session strategy')
    })

    it('should throw error for database strategy (not implemented)', () => {
      expect(() => {
        session.configure({
          strategy: 'database',
          cookie: {
            name: '__session',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 604800,
          },
        })
      }).toThrow('Database session strategy not yet implemented')
    })
  })
})
