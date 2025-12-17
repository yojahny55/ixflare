/**
 * CSRF Cookie Management
 * Story 5-6: CSRF Protection
 *
 * Cookie handling for CSRF tokens with secure defaults
 * Note: CSRF cookies MUST have httpOnly=false for JavaScript access
 */

import { setCookie as setBaseCookie, getCookie as getBaseCookie } from '@/auth/cookie'
import type { CSRFConfig } from './types'

/**
 * Default CSRF cookie configuration
 */
const DEFAULT_CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // MUST be false for JavaScript access (fetch, XHR)
  secure: true, // HTTPS only in production
  sameSite: 'strict' as const, // Strict for CSRF protection
  path: '/',
}

/**
 * Set CSRF cookie on response
 *
 * CSRF cookies require httpOnly=false to be readable by client-side JavaScript
 * for use in fetch requests (X-CSRF-Token header)
 *
 * SameSite=Strict provides defense-in-depth CSRF protection
 *
 * @param response - Response object to add cookie to
 * @param signedToken - Signed CSRF token value
 * @param config - CSRF configuration (optional overrides)
 * @returns Response with CSRF cookie set
 */
export function setCSRFCookie(
  response: Response,
  signedToken: string,
  config?: Partial<CSRFConfig>
): Response {
  const cookieName = config?.cookie ?? '__csrf'
  const sameSite = config?.sameSite ?? 'strict'

  return setBaseCookie(response, cookieName, signedToken, {
    ...DEFAULT_CSRF_COOKIE_OPTIONS,
    sameSite,
  })
}

/**
 * Get CSRF cookie from request
 *
 * @param request - Request object with Cookie header
 * @param config - CSRF configuration (optional)
 * @returns Signed CSRF token or null if not found
 */
export function getCSRFCookie(request: Request, config?: Partial<CSRFConfig>): string | null {
  const cookieName = config?.cookie ?? '__csrf'
  return getBaseCookie(request, cookieName)
}
