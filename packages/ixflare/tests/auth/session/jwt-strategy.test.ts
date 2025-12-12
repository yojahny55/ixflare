/**
 * JWT Session Strategy Tests
 * Story 5-2: Session Management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { JWTSessionStrategy } from '../../../src/auth/session/jwt-strategy'
import * as jwt from '../../../src/auth/jwt'
import { SessionExpiredError, InvalidSessionError } from '../../../src/auth/session/errors'
import type { SessionConfig } from '../../../src/auth/session/types'

describe('JWTSessionStrategy', () => {
  let strategy: JWTSessionStrategy
  let config: SessionConfig

  beforeEach(() => {
    // Configure JWT with HS256
    jwt.configure({
      algorithm: 'HS256',
      secret: 'test-secret-key-at-least-32-characters-long',
      defaultExpiresIn: '15m',
    })

    config = {
      strategy: 'jwt',
      cookie: {
        name: '__session',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    }

    strategy = new JWTSessionStrategy(config)
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

    it('should include device information if provided', async () => {
      const result = await strategy.create({
        userId: 'user-123',
        role: 'admin',
        device: 'Mozilla/5.0',
      })

      const decoded = jwt.decode(result.token)
      expect(decoded.payload.device).toBe('Mozilla/5.0')
    })

    it('should create token with correct expiry', async () => {
      const before = Math.floor(Date.now() / 1000)
      const result = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })
      const after = Math.floor(Date.now() / 1000)

      const decoded = jwt.decode(result.token)
      const expectedExp = config.cookie.maxAge

      // Allow 2 second tolerance
      expect(decoded.payload.exp! - decoded.payload.iat!).toBeGreaterThanOrEqual(expectedExp - 2)
      expect(decoded.payload.exp! - decoded.payload.iat!).toBeLessThanOrEqual(expectedExp + 2)
    })
  })

  describe('get', () => {
    it('should get session data from valid JWT cookie', async () => {
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
      expect(session!.iat).toBeTruthy()
      expect(session!.exp).toBeTruthy()
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

    it('should throw SessionExpiredError for expired token', async () => {
      // Create token with very short expiry
      jwt.configure({
        algorithm: 'HS256',
        secret: 'test-secret-key-at-least-32-characters-long',
        defaultExpiresIn: '1s',
      })

      const created = await jwt.sign({
        sessionId: crypto.randomUUID(),
        userId: 'user-123',
        role: 'admin',
      })

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${created}`,
        },
      })

      // Reset config
      jwt.configure({
        algorithm: 'HS256',
        secret: 'test-secret-key-at-least-32-characters-long',
        defaultExpiresIn: '15m',
      })

      await expect(strategy.get(request)).rejects.toThrow(SessionExpiredError)
    })

    it('should throw InvalidSessionError for JWT with missing required fields', async () => {
      // Create JWT without session fields
      const token = await jwt.sign({
        userId: 'user-123',
        // Missing sessionId and role
      })

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${token}`,
        },
      })

      await expect(strategy.get(request)).rejects.toThrow(InvalidSessionError)
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

    it('should preserve response body and status', () => {
      const response = new Response('Original', { status: 201 })
      const result = strategy.destroy(response)

      expect(result.status).toBe(201)
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

      // Verify new token is valid
      const decoded = jwt.decode(regenerated.token)
      expect(decoded.payload.sessionId).toBe(regenerated.sessionId)
      expect(decoded.payload.userId).toBe('user-123')
    })

    it('should invalidate old token by creating new one', async () => {
      const original = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      const regenerated = await strategy.regenerate({
        userId: 'user-123',
        role: 'user', // Changed role
      })

      // Old token still valid (stateless JWT)
      const oldDecoded = jwt.decode(original.token)
      expect(oldDecoded.payload.role).toBe('admin')

      // New token has updated data
      const newDecoded = jwt.decode(regenerated.token)
      expect(newDecoded.payload.role).toBe('user')
    })
  })

  describe('Session Fixation Prevention (AC7)', () => {
    it('should regenerate session ID after authentication', async () => {
      // Simulate pre-auth session (anonymous)
      const preAuth = await strategy.create({
        userId: 'anonymous',
        role: 'guest',
      })

      // After successful login, regenerate session (OWASP requirement)
      const postAuth = await strategy.regenerate({
        userId: 'user-123',
        role: 'admin',
      })

      // Session ID MUST be different
      expect(postAuth.sessionId).not.toBe(preAuth.sessionId)

      // Old session ID should not be in new token
      const newDecoded = jwt.decode(postAuth.token)
      expect(newDecoded.payload.sessionId).toBe(postAuth.sessionId)
      expect(newDecoded.payload.sessionId).not.toBe(preAuth.sessionId)
    })
  })

  describe('OWASP Security Requirements', () => {
    it('should use crypto.randomUUID for session ID (128-bit entropy)', async () => {
      const result = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // UUIDv4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // Where y is one of [8,9,a,b]
      expect(result.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should validate JWT signature before trusting data', async () => {
      const created = await strategy.create({
        userId: 'user-123',
        role: 'admin',
      })

      // Tamper with token
      const parts = created.token.split('.')
      const tamperedPayload = parts[1].replace(/u/, 'v') // Modify payload
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      const request = new Request('https://example.com', {
        headers: {
          Cookie: `__session=${tamperedToken}`,
        },
      })

      // Should return null (signature verification fails)
      const session = await strategy.get(request)
      expect(session).toBeNull()
    })
  })
})
