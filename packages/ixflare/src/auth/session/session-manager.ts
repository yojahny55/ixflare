/**
 * Session Manager Facade
 * Story 5-2: Session Management
 *
 * Unified API for session management with strategy pattern
 * Supports JWT, hybrid, and database session strategies
 */

import { JWTSessionStrategy } from './jwt-strategy'
import { HybridSessionStrategy } from './hybrid-strategy'
import { setCookie } from '@/auth/cookie'
import type { SessionConfig, SessionStrategy, SessionData } from './types'

/**
 * Session Manager
 * Facade that delegates to the configured session strategy
 */
class SessionManager {
  private strategy: SessionStrategy | null = null
  private config: SessionConfig | null = null

  /**
   * Configure session management
   * Must be called before using session methods
   */
  configure(config: SessionConfig): void {
    this.config = config

    // Select strategy based on configuration
    if (config.strategy === 'jwt') {
      this.strategy = new JWTSessionStrategy(config)
    } else if (config.strategy === 'hybrid') {
      this.strategy = new HybridSessionStrategy(config)
    } else if (config.strategy === 'database') {
      // Database strategy not implemented in this story (deferred)
      throw new Error('Database session strategy not yet implemented')
    } else {
      throw new Error(`Unknown session strategy: ${config.strategy}`)
    }
  }

  /**
   * Create a new session
   * Returns a Response with Set-Cookie header
   *
   * @param data - Session data (userId, role, device)
   * @param response - Optional existing response to add cookie to
   * @returns Response with session cookie set
   */
  async create(
    data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>,
    response?: Response
  ): Promise<Response> {
    this.ensureConfigured()

    const { token } = await this.strategy!.create(data)

    // Set cookie on response
    const baseResponse = response || new Response(null, { status: 200 })

    return setCookie(baseResponse, this.config!.cookie.name, token, {
      httpOnly: this.config!.cookie.httpOnly,
      secure: this.config!.cookie.secure,
      sameSite: this.config!.cookie.sameSite,
      maxAge: this.config!.cookie.maxAge,
      path: this.config!.cookie.path,
      domain: this.config!.cookie.domain,
    })
  }

  /**
   * Get session data from request
   * Returns session data or null if no valid session
   */
  async get(request: Request): Promise<SessionData | null> {
    this.ensureConfigured()
    return this.strategy!.get(request)
  }

  /**
   * Destroy session
   * Clears the session cookie
   */
  destroy(response?: Response): Response {
    this.ensureConfigured()

    const baseResponse = response || new Response(null, { status: 200 })
    return this.strategy!.destroy(baseResponse)
  }

  /**
   * Regenerate session ID (session fixation prevention)
   * MUST be called after authentication (OWASP requirement)
   *
   * @param data - Updated session data
   * @param options - Regeneration options
   * @param options.oldSessionId - Old session ID to revoke (required for AC7 compliance with hybrid strategy)
   * @param options.response - Optional existing response to add cookie to
   * @returns Response with new session cookie
   */
  async regenerate(
    data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>,
    options?: { oldSessionId?: string; response?: Response }
  ): Promise<Response> {
    this.ensureConfigured()

    const { token } = await this.strategy!.regenerate(data, options?.oldSessionId)

    // Set cookie on response
    const baseResponse = options?.response || new Response(null, { status: 200 })

    return setCookie(baseResponse, this.config!.cookie.name, token, {
      httpOnly: this.config!.cookie.httpOnly,
      secure: this.config!.cookie.secure,
      sameSite: this.config!.cookie.sameSite,
      maxAge: this.config!.cookie.maxAge,
      path: this.config!.cookie.path,
      domain: this.config!.cookie.domain,
    })
  }

  /**
   * Regenerate session from request (convenience method)
   * Extracts current session, revokes it, and creates new session
   * This is the recommended method for session fixation prevention (AC7)
   *
   * @param request - Request with current session cookie
   * @param data - New session data
   * @param response - Optional existing response to add cookie to
   * @returns Response with new session cookie, or null if no valid session exists
   */
  async regenerateFromRequest(
    request: Request,
    data: Omit<SessionData, 'sessionId' | 'iat' | 'exp'>,
    response?: Response
  ): Promise<Response | null> {
    this.ensureConfigured()

    // Get current session to extract sessionId
    const currentSession = await this.get(request)

    if (!currentSession) {
      return null
    }

    // Regenerate with old session ID for revocation
    return this.regenerate(data, {
      oldSessionId: currentSession.sessionId,
      response,
    })
  }

  /**
   * Check if session is valid (hybrid/database strategies only)
   * For JWT strategy, this is equivalent to get() !== null
   */
  async isValid(request: Request): Promise<boolean> {
    this.ensureConfigured()

    if (this.strategy!.isValid) {
      return this.strategy!.isValid(request)
    }

    // Fallback for strategies without explicit isValid
    const session = await this.get(request)
    return session !== null
  }

  /**
   * Revoke specific session (hybrid/database strategies only)
   * @throws Error if strategy doesn't support revocation
   */
  async revoke(sessionId: string): Promise<void> {
    this.ensureConfigured()

    if (!this.strategy!.revoke) {
      throw new Error(`${this.config!.strategy} strategy does not support revocation`)
    }

    return this.strategy!.revoke(sessionId)
  }

  /**
   * Revoke all sessions for a user (hybrid/database strategies only)
   * @throws Error if strategy doesn't support revocation
   */
  async revokeAll(userId: string): Promise<void> {
    this.ensureConfigured()

    if (!this.strategy!.revokeAll) {
      throw new Error(`${this.config!.strategy} strategy does not support revokeAll`)
    }

    return this.strategy!.revokeAll(userId)
  }

  /**
   * Refresh session (sliding window)
   * Checks if session is near expiry and issues new token if needed
   *
   * @param request - Request with session cookie
   * @param response - Optional existing response
   * @returns Response with refreshed cookie, or original response if no refresh needed
   */
  async refresh(request: Request, response?: Response): Promise<Response | null> {
    this.ensureConfigured()

    const session = await this.get(request)

    if (!session) {
      return null
    }

    // Check if session is near expiry
    const now = Math.floor(Date.now() / 1000)
    const threshold = this.config!.refresh?.threshold || 300 // 5 minutes default

    if (session.exp - now <= threshold) {
      // Session near expiry, issue new token
      // Note: For refresh, we don't revoke old session as both are for the same user
      // Refresh is for convenience (sliding window), not security (like regenerate after auth)
      return this.regenerate(
        {
          userId: session.userId,
          role: session.role,
          device: session.device,
        },
        { response }
      )
    }

    // No refresh needed
    return response || null
  }

  /**
   * Ensure session manager is configured
   * @throws Error if configure() hasn't been called
   */
  private ensureConfigured(): void {
    if (!this.config || !this.strategy) {
      throw new Error('Session manager not configured. Call session.configure() first.')
    }
  }
}

// Export singleton instance
export const session = new SessionManager()
