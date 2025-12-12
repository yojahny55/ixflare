/**
 * Session Error Classes
 * Story 5-2: Session Management
 *
 * Extends AuthError base class from Story 5-1
 * Implements Epic 5 requirement: typed errors with no information leakage
 */

import { AuthError } from '@/errors'

/**
 * Base session error class
 */
export class SessionError extends AuthError {
  constructor(code: string, message: string) {
    super(code, message)
    this.name = 'SessionError'
  }
}

/**
 * Session expired error
 * Thrown when JWT exp claim is in the past
 */
export class SessionExpiredError extends SessionError {
  readonly expiredAt: number

  constructor(expiredAt: number) {
    super('SESSION_EXPIRED', `Session expired at ${new Date(expiredAt * 1000).toISOString()}`)
    this.expiredAt = expiredAt
  }
}

/**
 * Session revoked error
 * Thrown when session is found in KV revocation list
 */
export class SessionRevokedError extends SessionError {
  constructor() {
    super('SESSION_REVOKED', 'Session has been revoked')
  }
}

/**
 * Session not found error
 * Thrown when session ID not found in database (database strategy)
 */
export class SessionNotFoundError extends SessionError {
  readonly sessionId: string

  constructor(sessionId: string) {
    super('SESSION_NOT_FOUND', 'Session not found')
    this.sessionId = sessionId
  }
}

/**
 * Invalid session error
 * Thrown when session data is malformed or invalid
 */
export class InvalidSessionError extends SessionError {
  constructor(reason: string) {
    super('INVALID_SESSION', `Invalid session: ${reason}`)
  }
}
