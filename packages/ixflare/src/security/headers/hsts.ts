/**
 * Strict-Transport-Security (HSTS) Header Builder
 * Story 5-8: Security Headers Auto-Injection
 *
 * Builds HSTS headers and provides HTTP to HTTPS redirect middleware
 */

import type { HSTSConfig } from './types'
import type { Middleware } from '@/core/middleware'
import { HSTSConfigError } from './errors'
import { detectEnvironment } from '@/auth/cookie/security'

/**
 * Default HSTS configuration (secure baseline)
 *
 * - maxAge: 31536000 (1 year) - minimum for security
 * - includeSubDomains: true - protect all subdomains
 * - preload: false - not enabled by default (permanent decision)
 */
export const DEFAULT_HSTS_CONFIG: Required<HSTSConfig> = {
  maxAge: 31536000, // 1 year in seconds
  includeSubDomains: true,
  preload: false,
}

/**
 * Minimum maxAge required for HSTS preload list submission
 */
export const HSTS_PRELOAD_MIN_MAX_AGE = 31536000 // 1 year

/**
 * Build Strict-Transport-Security header value
 *
 * Validates preload requirements and logs warnings for invalid configurations.
 *
 * @param config - HSTS configuration (or true for defaults)
 * @returns HSTS header value string
 * @throws {HSTSConfigError} If configuration is invalid
 *
 * @example
 * ```typescript
 * // Use defaults
 * const hsts = buildHSTSHeader(true)
 * // Returns: "max-age=31536000; includeSubDomains"
 *
 * // Custom configuration
 * const hsts = buildHSTSHeader({
 *   maxAge: 63072000,
 *   includeSubDomains: true,
 *   preload: true,
 * })
 * // Returns: "max-age=63072000; includeSubDomains; preload"
 * ```
 */
export function buildHSTSHeader(config: HSTSConfig | boolean): string {
  // If config is true, use defaults
  const mergedConfig: Required<HSTSConfig> =
    config === true
      ? DEFAULT_HSTS_CONFIG
      : {
          ...DEFAULT_HSTS_CONFIG,
          ...config,
        }

  // Validate maxAge
  if (mergedConfig.maxAge < 0) {
    throw new HSTSConfigError('HSTS maxAge must be a positive number', 'INVALID_MAX_AGE')
  }

  // Validate preload requirements
  if (mergedConfig.preload) {
    if (mergedConfig.maxAge < HSTS_PRELOAD_MIN_MAX_AGE) {
      console.warn(
        `[HSTS] Preload requires maxAge >= ${HSTS_PRELOAD_MIN_MAX_AGE} (1 year). Current: ${mergedConfig.maxAge}. ` +
          `For HSTS preload list submission, set maxAge to at least ${HSTS_PRELOAD_MIN_MAX_AGE}.`
      )
    }

    if (!mergedConfig.includeSubDomains) {
      console.warn(
        '[HSTS] Preload requires includeSubDomains to be true. ' +
          'Enable includeSubDomains for HSTS preload list submission.'
      )
    }
  }

  // Build header value
  let header = `max-age=${mergedConfig.maxAge}`

  if (mergedConfig.includeSubDomains) {
    header += '; includeSubDomains'
  }

  if (mergedConfig.preload) {
    header += '; preload'
  }

  return header
}

/**
 * Validate HSTS preload requirements
 *
 * Checks if HSTS configuration meets requirements for preload list submission.
 * Use this for strict validation before enabling preload.
 *
 * @param config - HSTS configuration
 * @returns true if preload requirements are met
 *
 * @example
 * ```typescript
 * const config = { maxAge: 63072000, includeSubDomains: true, preload: true }
 * if (validateHSTSPreloadRequirements(config)) {
 *   console.log('Ready for HSTS preload submission')
 * }
 * ```
 */
export function validateHSTSPreloadRequirements(config: HSTSConfig): boolean {
  if (!config.preload) {
    return true // Validation only applies if preload is requested
  }

  const isValid =
    (config.maxAge ?? DEFAULT_HSTS_CONFIG.maxAge) >= HSTS_PRELOAD_MIN_MAX_AGE &&
    (config.includeSubDomains ?? DEFAULT_HSTS_CONFIG.includeSubDomains) === true

  return isValid
}

/**
 * Create HTTPS redirect middleware
 *
 * Redirects HTTP requests to HTTPS in production environment.
 * Preserves path and query string during redirect.
 *
 * In development, allows HTTP for localhost testing.
 *
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'ixflare'
 * import { createHttpsRedirectMiddleware } from 'ixflare/security'
 *
 * export default defineConfig({
 *   middleware: [
 *     createHttpsRedirectMiddleware(),
 *   ],
 * })
 * ```
 */
export function createHttpsRedirectMiddleware(): Middleware {
  return async (ctx, next) => {
    const env = detectEnvironment()

    // Only enforce HTTPS redirect in production
    if (env !== 'production') {
      return next()
    }

    const url = new URL(ctx.request.url)

    // If request is HTTP, redirect to HTTPS
    if (url.protocol === 'http:') {
      const httpsUrl = new URL(url.href)
      httpsUrl.protocol = 'https:'

      return Response.redirect(httpsUrl.href, 301) // 301 Moved Permanently
    }

    return next()
  }
}
