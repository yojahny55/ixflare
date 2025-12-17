/**
 * CSRF Protection Middleware
 * Story 5-6: CSRF Protection
 *
 * Validates CSRF tokens on state-changing requests using Signed Double-Submit Cookie pattern
 */

import type { Middleware } from '@/core/middleware'
import { verifyCSRFSignature } from './token'
import { getCSRFCookie } from './cookie'
import { CSRFInvalidError } from './errors'
import type { CSRFConfig } from './types'

/**
 * Safe HTTP methods that don't require CSRF protection
 * These methods should not have side effects per HTTP specification
 */
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE']

/**
 * Default CSRF configuration
 */
const DEFAULT_CSRF_CONFIG: CSRFConfig = {
  enabled: true,
  cookie: '__csrf',
  header: 'X-CSRF-Token',
  bodyField: '_csrf',
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  sameSite: 'strict',
  secret: '', // Must be provided by user
}

/**
 * Extract CSRF token from request header or body
 *
 * Supports two token submission methods:
 * 1. Header: X-CSRF-Token (recommended for API/fetch requests)
 * 2. Body: _csrf field (for form submissions)
 *
 * @param request - Request to extract token from
 * @param config - CSRF configuration
 * @returns Token value or null if not found
 */
async function extractToken(request: Request, config: CSRFConfig): Promise<string | null> {
  // Try header first (API/fetch requests)
  const headerToken = request.headers.get(config.header)
  if (headerToken) {
    return headerToken
  }

  // Try body field (form submissions)
  // Only parse body for form content types
  const contentType = request.headers.get('Content-Type') || ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const formData = await request.clone().formData()
      const bodyToken = formData.get(config.bodyField)
      return bodyToken ? String(bodyToken) : null
    } catch {
      // Body parsing failed, return null
      return null
    }
  }

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.clone().formData()
      const bodyToken = formData.get(config.bodyField)
      return bodyToken ? String(bodyToken) : null
    } catch {
      return null
    }
  }

  return null
}

/**
 * Get session ID from context
 *
 * Supports multiple session storage strategies:
 * 1. ctx.session.id (session middleware)
 * 2. JWT token in Authorization header
 * 3. Session cookie
 *
 * @param ctx - Edge context
 * @returns Session ID or null
 */
function getSessionId(ctx: any): string | null {
  // Try session from context (if session middleware is active)
  if (ctx.session?.id) {
    return ctx.session.id
  }

  // Fallback: Try session cookie
  const cookies = ctx.request.headers.get('Cookie') || ''
  const sessionCookieMatch = cookies.match(/__session=([^;]+)/)
  if (sessionCookieMatch) {
    return sessionCookieMatch[1]
  }

  return null
}

/**
 * CSRF protection middleware factory
 *
 * Validates CSRF tokens on state-changing requests:
 * - POST, PUT, PATCH, DELETE require valid tokens
 * - GET, HEAD, OPTIONS, TRACE are exempt (safe methods)
 * - Token must match signed cookie using HMAC verification
 * - Token must be bound to current session (prevents session fixation)
 *
 * @param config - CSRF configuration (partial, merged with defaults)
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Global CSRF protection
 * export default defineConfig({
 *   middleware: [csrf({ secret: env.CSRF_SECRET })],
 * })
 *
 * // Per-route CSRF protection
 * export const middleware = [csrf({ secret: env.CSRF_SECRET })]
 * ```
 */
export function csrf<Env = unknown>(config?: Partial<CSRFConfig>): Middleware<Env> {
  const opts = { ...DEFAULT_CSRF_CONFIG, ...config }

  // Validate secret is provided
  if (!opts.secret) {
    throw new Error('CSRF middleware requires a secret. Provide via config or environment.')
  }

  return async (ctx, next) => {
    // Skip CSRF validation for safe methods
    if (SAFE_METHODS.includes(ctx.method)) {
      return next()
    }

    // Skip if method not in protected methods list
    if (!opts.methods.includes(ctx.method as any)) {
      return next()
    }

    // Extract token from header or body
    const token = await extractToken(ctx.request, opts)

    if (!token) {
      throw new CSRFInvalidError('Invalid or missing CSRF token')
    }

    // Get signed cookie
    const signedCookie = getCSRFCookie(ctx.request, opts)

    if (!signedCookie) {
      throw new CSRFInvalidError('Invalid or missing CSRF token')
    }

    // Get session ID for binding verification
    const sessionId = getSessionId(ctx)

    if (!sessionId) {
      throw new CSRFInvalidError('Invalid or missing CSRF token')
    }

    // Extract token value from signed cookie (format: value.signature)
    const cookieTokenValue = signedCookie.split('.')[0]

    if (!cookieTokenValue) {
      throw new CSRFInvalidError('Invalid or missing CSRF token')
    }

    // Double-Submit Cookie Pattern:
    // 1. Token in header/body must match token value in cookie
    // 2. Cookie signature must verify against session ID

    // Check 1: Token value must match
    if (token !== cookieTokenValue) {
      throw new CSRFInvalidError('Invalid or missing CSRF token')
    }

    // Check 2: Verify signature is valid and bound to session
    const isValid = await verifyCSRFSignature(signedCookie, sessionId, opts.secret)

    if (!isValid) {
      throw new CSRFInvalidError('Invalid or missing CSRF token')
    }

    // Token is valid, proceed to next middleware/handler
    return next()
  }
}
