/**
 * Security Headers Middleware
 * Story 5-8: Security Headers Auto-Injection
 *
 * Middleware factory that auto-injects security headers into responses
 */

import type { Middleware } from '@/core/middleware'
import type { SecurityHeadersConfig } from './types'
import { buildCSPHeader, getCSPHeaderName, generateNonce, setRequestNonce, clearRequestNonce } from './csp'
import { buildHSTSHeader } from './hsts'
import { buildPermissionsPolicyHeader } from './permissions'
import {
  buildXContentTypeOptionsHeader,
  buildXFrameOptionsHeader,
  buildReferrerPolicyHeader,
  buildXXssProtectionHeader,
  buildCrossOriginEmbedderPolicyHeader,
  buildCrossOriginOpenerPolicyHeader,
  buildCrossOriginResourcePolicyHeader,
} from './common'
import { detectEnvironment } from '@/auth/cookie/security'

import type { ContentSecurityPolicyConfig, HSTSConfig } from './types'

/**
 * Default security headers configuration (OWASP best practices)
 */
export const DEFAULT_SECURITY_HEADERS_CONFIG = {
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  } as ContentSecurityPolicyConfig,
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false,
  } as HSTSConfig,
  xContentTypeOptions: true as const,
  xFrameOptions: 'DENY' as const,
  referrerPolicy: 'strict-origin-when-cross-origin' as const,
  xXssProtection: true as const,
  httpsRedirect: true as const,
} as const

/**
 * Create security headers middleware
 *
 * Automatically injects security headers into all responses based on configuration.
 * Supports global config with route-level overrides.
 *
 * Features:
 * - HTTP to HTTPS redirect (production only, enabled by default)
 * - Content-Security-Policy with nonce support
 * - HSTS with preload support
 * - X-Frame-Options for clickjacking protection
 * - X-Content-Type-Options for MIME sniffing protection
 * - Referrer-Policy for information leakage control
 * - Permissions-Policy for feature restriction
 * - Cross-Origin-* headers for Spectre mitigation
 *
 * @param config - Global security headers configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * import { defineConfig } from 'ixflare'
 * import { createSecurityHeadersMiddleware } from 'ixflare/security'
 *
 * export default defineConfig({
 *   middleware: [
 *     createSecurityHeadersMiddleware(),
 *   ],
 * })
 *
 * // Custom configuration
 * export default defineConfig({
 *   middleware: [
 *     createSecurityHeadersMiddleware({
 *       contentSecurityPolicy: {
 *         defaultSrc: ["'self'"],
 *         scriptSrc: ["'self'", 'https://cdn.example.com'],
 *       },
 *       strictTransportSecurity: {
 *         maxAge: 63072000,
 *         includeSubDomains: true,
 *         preload: true,
 *       },
 *       xFrameOptions: 'SAMEORIGIN',
 *     }),
 *   ],
 * })
 * ```
 */
export function createSecurityHeadersMiddleware(
  globalConfig: SecurityHeadersConfig | boolean = true
): Middleware {
  return async (ctx, next) => {
    // Determine effective config early for HTTPS redirect check
    // Route config type assertion - routeConfig is dynamically added by router
    const routeConfig = (ctx as { routeConfig?: { security?: { headers?: SecurityHeadersConfig | false } } })
      .routeConfig?.security?.headers

    // If route disabled headers entirely, skip all processing including HTTPS redirect
    if (routeConfig === false) {
      return next()
    }

    // Build effective config for HTTPS redirect check
    let effectiveConfig: SecurityHeadersConfig

    if (globalConfig === false) {
      effectiveConfig = routeConfig || {}
    } else if (globalConfig === true) {
      effectiveConfig = {
        ...DEFAULT_SECURITY_HEADERS_CONFIG,
        ...(routeConfig || {}),
      }
    } else {
      effectiveConfig = {
        ...DEFAULT_SECURITY_HEADERS_CONFIG,
        ...globalConfig,
        ...(routeConfig || {}),
      }
    }

    // Handle HTTPS redirect BEFORE generating nonce (to avoid unnecessary work)
    // Only redirect in production environment
    if (effectiveConfig.httpsRedirect !== false) {
      const env = detectEnvironment()
      if (env === 'production') {
        const url = new URL(ctx.request.url)
        if (url.protocol === 'http:') {
          // Redirect HTTP to HTTPS with 301 Moved Permanently
          const httpsUrl = new URL(url.href)
          httpsUrl.protocol = 'https:'
          return Response.redirect(httpsUrl.href, 301)
        }
      }
    }

    // Generate nonce for this request
    const nonce = await generateNonce()
    setRequestNonce(nonce)

    try {
      // Get response from next middleware/handler
      const response = await next()

      // Clone response to add headers (Response is immutable)
      const headers = new Headers(response.headers)

      // Content-Security-Policy
      if (effectiveConfig.contentSecurityPolicy !== false && effectiveConfig.contentSecurityPolicy !== undefined) {
        const cspConfig = effectiveConfig.contentSecurityPolicy
        const csp = buildCSPHeader(cspConfig, nonce)
        const headerName = getCSPHeaderName(cspConfig.reportOnly)
        headers.set(headerName, csp)
      } else if (effectiveConfig.contentSecurityPolicy === undefined) {
        // Use default CSP
        const cspConfig = DEFAULT_SECURITY_HEADERS_CONFIG.contentSecurityPolicy
        const csp = buildCSPHeader(cspConfig, nonce)
        const headerName = getCSPHeaderName(cspConfig.reportOnly)
        headers.set(headerName, csp)
      }

      // Strict-Transport-Security
      if (effectiveConfig.strictTransportSecurity !== undefined && effectiveConfig.strictTransportSecurity !== false) {
        const hstsConfig = effectiveConfig.strictTransportSecurity === true
          ? DEFAULT_SECURITY_HEADERS_CONFIG.strictTransportSecurity
          : effectiveConfig.strictTransportSecurity
        const hsts = buildHSTSHeader(hstsConfig)
        headers.set('Strict-Transport-Security', hsts)
      }

      // X-Content-Type-Options
      if (effectiveConfig.xContentTypeOptions !== false) {
        const value = buildXContentTypeOptionsHeader()
        headers.set('X-Content-Type-Options', value)
      }

      // X-Frame-Options
      if (effectiveConfig.xFrameOptions !== false && effectiveConfig.xFrameOptions !== undefined) {
        const value = buildXFrameOptionsHeader(effectiveConfig.xFrameOptions)
        headers.set('X-Frame-Options', value)
      }

      // Referrer-Policy
      if (effectiveConfig.referrerPolicy !== false && effectiveConfig.referrerPolicy !== undefined) {
        const value = buildReferrerPolicyHeader(effectiveConfig.referrerPolicy)
        headers.set('Referrer-Policy', value)
      }

      // X-XSS-Protection (deprecated, always set to 0)
      if (effectiveConfig.xXssProtection !== false) {
        const value = buildXXssProtectionHeader()
        headers.set('X-XSS-Protection', value)
      }

      // Permissions-Policy
      if (effectiveConfig.permissionsPolicy) {
        const value = buildPermissionsPolicyHeader(effectiveConfig.permissionsPolicy)
        if (value) {
          headers.set('Permissions-Policy', value)
        }
      }

      // Cross-Origin-Embedder-Policy
      if (effectiveConfig.crossOriginEmbedderPolicy) {
        const value = buildCrossOriginEmbedderPolicyHeader(effectiveConfig.crossOriginEmbedderPolicy)
        headers.set('Cross-Origin-Embedder-Policy', value)
      }

      // Cross-Origin-Opener-Policy
      if (effectiveConfig.crossOriginOpenerPolicy) {
        const value = buildCrossOriginOpenerPolicyHeader(effectiveConfig.crossOriginOpenerPolicy)
        headers.set('Cross-Origin-Opener-Policy', value)
      }

      // Cross-Origin-Resource-Policy
      if (effectiveConfig.crossOriginResourcePolicy) {
        const value = buildCrossOriginResourcePolicyHeader(effectiveConfig.crossOriginResourcePolicy)
        headers.set('Cross-Origin-Resource-Policy', value)
      }

      // Return response with security headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } finally {
      // Always clear nonce after response, even if an error occurred
      // This prevents nonce leakage between requests in edge cases
      clearRequestNonce()
    }
  }
}
