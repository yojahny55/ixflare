/**
 * CSRF Protection Module
 * Story 5-6: CSRF Protection
 *
 * Provides automatic CSRF protection using Signed Double-Submit Cookie pattern
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

export type { CSRFConfig, CSRFToken } from './types'
export { CSRFError, CSRFInvalidError } from './errors'
export {
  generateCSRFToken,
  signCSRFToken,
  verifyCSRFSignature,
  createSignedToken,
} from './token'
export { setCSRFCookie, getCSRFCookie } from './cookie'
export { csrf } from './middleware'
export type { CSRFInputProps } from './client'
export { csrfToken, getCsrfToken, getCSRFInputProps, CSRFInput } from './client'
