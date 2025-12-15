/**
 * Cookie Type Definitions
 * Story 5-7: Secure Cookie Handling
 */

export interface CookieOptions {
  /** HTTP only flag (prevents JavaScript access) - default: true */
  httpOnly?: boolean

  /** Secure flag (HTTPS only) - default: true in production */
  secure?: boolean

  /** SameSite attribute for CSRF protection - default: lax */
  sameSite?: 'lax' | 'strict' | 'none'

  /** Max age in seconds */
  maxAge?: number

  /** Expires attribute (alternative to maxAge) */
  expires?: Date | number

  /** Cookie path - default: / */
  path?: string

  /** Cookie domain (omit for strictest scope) */
  domain?: string

  /** Partitioned attribute for CHIPS (Cookies Having Independent Partitioned State) */
  partitioned?: boolean
}

export interface SignedCookieOptions extends CookieOptions {
  /** HMAC secret for signing (required) */
  secret: string
}

/**
 * Environment type for security enforcement
 */
export type Environment = 'production' | 'development' | 'test'
