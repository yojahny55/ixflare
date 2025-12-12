/**
 * Hybrid Session Strategy (JWT + KV Revocation)
 * Story 5-2: Session Management
 *
 * Combines JWT stateless sessions with KV-based revocation
 * Allows immediate session invalidation while maintaining JWT benefits
 */

import * as jwt from '@/auth/jwt'
import { getCookie, deleteCookie } from '@/auth/cookie'
import type { SessionStrategy, SessionData, SessionConfig } from './types'
import { SessionExpiredError, InvalidSessionError, SessionRevokedError } from './errors'
import { TokenExpiredError } from '@/auth/errors'
import type { JWTPayload } from '@/auth/types'

/**
 * Hybrid Session Strategy
 * JWT-based sessions with KV revocation list for immediate invalidation
 */
export class HybridSessionStrategy implements SessionStrategy {
  private config: SessionConfig
  private kv: KVNamespace

  constructor(config: SessionConfig) {
    if (!config.kv) {
      throw new Error('KV namespace required for hybrid session strategy')
    }

    this.config = config
    this.kv = config.kv
  }

  /**
   * Create a new session
   * Generates session ID and signs JWT token
   */
  async create(
    data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>
  ): Promise<{ token: string; sessionId: string }> {
    // Generate session ID with crypto.randomUUID (128-bit entropy, OWASP compliant)
    const sessionId = crypto.randomUUID()

    // Create JWT payload with session data
    const payload: JWTPayload = {
      sessionId,
      userId: data.userId,
      role: data.role,
      device: data.device,
    }

    // Sign JWT using existing jwt module
    const expiresIn = `${this.config.cookie.maxAge}s`
    const token = await jwt.sign(payload, { expiresIn })

    return { token, sessionId }
  }

  /**
   * Get session data from request
   * Verifies JWT and checks KV revocation list
   */
  async get(request: Request): Promise<SessionData | null> {
    // Extract cookie from request
    const token = getCookie(request, this.config.cookie.name)

    if (!token) {
      return null
    }

    try {
      // Verify JWT signature and expiry
      const payload = await jwt.verify(token)

      // Validate required session fields
      if (!payload.sessionId || !payload.userId || !payload.role) {
        throw new InvalidSessionError('Missing required session fields')
      }

      // Check if session is revoked in KV
      const isRevoked = await this.isRevoked(
        payload.sessionId as string,
        payload.userId as string,
        payload.iat!
      )

      if (isRevoked) {
        throw new SessionRevokedError()
      }

      // Return session data
      return {
        sessionId: payload.sessionId as string,
        userId: payload.userId as string,
        role: payload.role as string,
        device: payload.device as string | undefined,
        iat: payload.iat!,
        exp: payload.exp!,
      }
    } catch (error) {
      // Handle JWT errors
      if (error instanceof TokenExpiredError) {
        throw new SessionExpiredError(error.expiredAt)
      }

      // Re-throw session errors (revoked, invalid)
      if (error instanceof SessionRevokedError || error instanceof InvalidSessionError) {
        throw error
      }

      // Return null for invalid tokens (signature/format errors)
      return null
    }
  }

  /**
   * Check if session is valid (not revoked)
   */
  async isValid(request: Request): Promise<boolean> {
    try {
      const session = await this.get(request)
      return session !== null
    } catch {
      // Revoked or expired
      return false
    }
  }

  /**
   * Revoke specific session
   * Adds session ID to KV revocation list with TTL
   */
  async revoke(sessionId: string): Promise<void> {
    const key = `revoked:session:${sessionId}`
    const ttl = this.config.cookie.maxAge // Match session expiry

    // Store revocation with TTL for automatic cleanup
    await this.kv.put(key, JSON.stringify({ revokedAt: Date.now() }), { expirationTtl: ttl })
  }

  /**
   * Revoke all sessions for a user
   * Stores user revocation timestamp - sessions issued before this are invalid
   */
  async revokeAll(userId: string): Promise<void> {
    const key = `revoked:user:${userId}`
    const revokedAt = Math.floor(Date.now() / 1000) // Unix seconds
    const ttl = this.config.cookie.maxAge // Match session expiry

    // Store user revocation timestamp with TTL
    await this.kv.put(key, JSON.stringify({ revokedAt }), { expirationTtl: ttl })
  }

  /**
   * Check if session is revoked
   * Checks both individual session revocation and user-level revocation
   *
   * @param sessionId - Session ID to check
   * @param userId - User ID
   * @param iat - Token issued-at timestamp (Unix seconds)
   */
  private async isRevoked(sessionId: string, userId: string, iat: number): Promise<boolean> {
    // Check individual session revocation
    const sessionKey = `revoked:session:${sessionId}`
    const sessionRevoked = await this.kv.get(sessionKey)

    if (sessionRevoked) {
      return true
    }

    // Check user-level revocation
    const userKey = `revoked:user:${userId}`
    const userRevocation = await this.kv.get(userKey)

    if (userRevocation) {
      const data = JSON.parse(userRevocation) as { revokedAt: number }
      // If token was issued before user revocation, it's invalid
      return iat < data.revokedAt
    }

    return false
  }

  /**
   * Destroy session by clearing cookie
   */
  destroy(response: Response): Response {
    return deleteCookie(response, this.config.cookie.name, {
      path: this.config.cookie.path,
      domain: this.config.cookie.domain,
    })
  }

  /**
   * Regenerate session ID (session fixation prevention)
   * MUST be called after authentication (OWASP requirement)
   *
   * Creates new session with new ID and revokes old session if provided
   * AC7: "the old session is invalidated" - this is critical for session fixation prevention
   *
   * @param data - New session data
   * @param oldSessionId - Old session ID to revoke (RECOMMENDED for proper security)
   */
  async regenerate(
    data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>,
    oldSessionId?: string
  ): Promise<{ token: string; sessionId: string }> {
    // Revoke old session if provided (AC7 requirement: old session must be invalidated)
    if (oldSessionId) {
      await this.revoke(oldSessionId)
    }

    // Create new session with new session ID
    return this.create(data)
  }
}
