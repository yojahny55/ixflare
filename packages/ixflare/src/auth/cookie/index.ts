/**
 * Cookie Module
 * Story 5-7: Secure Cookie Handling
 *
 * Comprehensive cookie utilities with security features:
 * - Secure defaults (httpOnly, secure, sameSite)
 * - Cookie prefix validation (__Host-, __Secure-)
 * - Signed cookies (HMAC-SHA256)
 * - Production security enforcement
 * - Environment-aware defaults
 */

// Core cookie operations
export { setCookie, getCookie, parseCookies, deleteCookie } from './core'

// Signed cookie operations
export { signCookieValue, verifyCookieSignature, setSignedCookie, getSignedCookie } from './signed'

// Security enforcement
export {
  enforceSecureDefaults,
  detectEnvironment,
  setEnvironment,
  clearEnvironment,
  validateSecurityRequirements,
} from './security'

// Prefix validation
export { validateCookiePrefix } from './prefix-validator'

// Types
export type { CookieOptions, SignedCookieOptions, Environment } from './types'

// Errors
export {
  CookieError,
  CookieValidationError,
  CookieSecurityError,
  CookieSignatureError,
} from './errors'
