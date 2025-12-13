/**
 * CSRF Protection Type Definitions
 * Story 5-6: CSRF Protection
 *
 * Type-safe configuration and token types for CSRF protection
 */

/**
 * CSRF protection configuration
 */
export interface CSRFConfig {
  /** Enable CSRF protection - default: true */
  enabled: boolean

  /** Cookie name for CSRF token - default: __csrf */
  cookie: string

  /** Header name for CSRF token - default: X-CSRF-Token */
  header: string

  /** Body field name for CSRF token - default: _csrf */
  bodyField: string

  /** HTTP methods that require CSRF protection - default: POST, PUT, PATCH, DELETE */
  methods: Array<'POST' | 'PUT' | 'PATCH' | 'DELETE'>

  /** SameSite cookie attribute - default: strict */
  sameSite: 'strict' | 'lax'

  /** HMAC secret for token signing (should be from env/config) */
  secret: string
}

/**
 * CSRF token structure
 */
export interface CSRFToken {
  /** Random token value (128-bit entropy) */
  value: string

  /** HMAC signature binding token to session */
  signature: string

  /** Session ID this token is bound to */
  sessionId: string

  /** Signed token format: value.signature */
  signedToken: string
}
