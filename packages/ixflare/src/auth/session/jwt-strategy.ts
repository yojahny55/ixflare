/**
 * JWT Session Strategy (Stateless)
 * Story 5-2: Session Management
 *
 * Uses JWT tokens for stateless session management
 * Integrates with existing JWT module from Story 5-1
 */

import * as jwt from '@/auth/jwt'
import { getCookie, deleteCookie } from '@/auth/cookie'
import type { SessionStrategy, SessionData, SessionConfig } from './types'
import { SessionExpiredError, InvalidSessionError } from './errors'
import { TokenExpiredError } from '@/auth/errors'
import type { JWTPayload } from '@/auth/types'

/**
 * JWT Session Strategy
 * Stateless sessions using JWT tokens stored in cookies
 */
export class JWTSessionStrategy implements SessionStrategy {
  private config: SessionConfig

  constructor(config: SessionConfig) {
    this.config = config
  }

  /**
   * Create a new session
   * Generates a new session ID and signs a JWT token
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
   * Extracts JWT from cookie and verifies it
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

      // Re-throw session errors
      if (error instanceof InvalidSessionError) {
        throw error
      }

      // Return null for invalid tokens (signature/format errors)
      return null
    }
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
   * Creates new session with new session ID.
   * NOTE: JWT strategy is stateless - old tokens remain valid until expiry.
   * For immediate revocation, use hybrid strategy instead.
   *
   * @param data - New session data
   * @param _oldSessionId - Ignored for JWT strategy (no revocation support)
   */
  async regenerate(
    data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>,
    _oldSessionId?: string
  ): Promise<{ token: string; sessionId: string }> {
    // Simply create a new session with a new session ID
    // The old token will naturally expire (stateless, no revocation capability)
    // For immediate revocation, use hybrid strategy
    return this.create(data)
  }
}
