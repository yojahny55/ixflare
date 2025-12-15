/**
 * Production Security Enforcement
 * Story 5-7: Secure Cookie Handling
 *
 * Environment-aware cookie security defaults
 */

import { CookieSecurityError } from './errors'
import type { CookieOptions, Environment } from './types'

/**
 * Detect environment from Cloudflare Workers context or NODE_ENV
 *
 * @returns Environment type
 */
export function detectEnvironment(): Environment {
  // Check if running in Cloudflare Workers
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis) {
    // In Workers, check environment from bindings or hostname patterns
    // Default to production for safety
    return 'production'
  }

  // Node.js environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    const env = process.env.NODE_ENV.toLowerCase()
    if (env === 'development' || env === 'dev') return 'development'
    if (env === 'test') return 'test'
  }

  // Default to production for safety
  return 'production'
}

/**
 * Enforce secure defaults based on environment
 *
 * Production enforcement:
 * - secure: true (REQUIRED)
 * - httpOnly: true for session/auth cookies (RECOMMENDED)
 * - Warning logged if insecure options attempted
 *
 * Development allowances:
 * - secure: false allowed for localhost testing
 * - Warnings still logged
 *
 * @param name - Cookie name
 * @param options - Cookie options to enforce
 * @param env - Environment (auto-detected if not provided)
 * @returns Enforced cookie options
 */
export function enforceSecureDefaults(
  name: string,
  options: CookieOptions,
  env: Environment = detectEnvironment()
): CookieOptions {
  const enforced = { ...options }

  // Production enforcement
  if (env === 'production') {
    // CRITICAL: Secure must be true in production
    if (enforced.secure === false) {
      console.warn(
        `[COOKIE SECURITY] Attempted to set insecure cookie "${name}" in production. Overriding secure=false to secure=true.`
      )
      enforced.secure = true
    } else if (enforced.secure === undefined) {
      enforced.secure = true
    }

    // RECOMMENDED: HttpOnly for session/auth cookies
    if (isAuthCookie(name) && enforced.httpOnly === false) {
      console.warn(
        `[COOKIE SECURITY] Auth/session cookie "${name}" set with httpOnly=false in production. Consider enabling httpOnly.`
      )
    }
  }

  // Development environment
  if (env === 'development') {
    // Allow secure=false for localhost testing but warn
    if (enforced.secure === false) {
      console.warn(
        `[COOKIE SECURITY] Cookie "${name}" set with secure=false in development. This would be rejected in production.`
      )
    }
  }

  return enforced
}

/**
 * Determine if cookie is an auth/session cookie based on name
 *
 * Auth cookies should always be httpOnly to prevent XSS theft
 *
 * @param name - Cookie name
 * @returns True if auth/session cookie
 */
function isAuthCookie(name: string): boolean {
  const authPatterns = ['session', 'token', 'auth', 'jwt', 'csrf']
  const lowerName = name.toLowerCase()

  return authPatterns.some((pattern) => lowerName.includes(pattern))
}

/**
 * Validate security requirements for cookie
 *
 * Throws error if security requirements are not met
 * Use this for strict enforcement mode
 *
 * @param name - Cookie name
 * @param options - Cookie options
 * @param env - Environment
 * @throws {CookieSecurityError} If security requirements not met
 */
export function validateSecurityRequirements(
  name: string,
  options: CookieOptions,
  env: Environment = detectEnvironment()
): void {
  if (env === 'production') {
    if (options.secure === false) {
      throw new CookieSecurityError(
        `Cookie "${name}" cannot be set with secure=false in production`
      )
    }

    if (isAuthCookie(name) && options.httpOnly === false) {
      throw new CookieSecurityError(
        `Auth cookie "${name}" must have httpOnly=true in production`
      )
    }
  }
}
