/**
 * Common Security Headers
 * Story 5-8: Security Headers Auto-Injection
 *
 * Builders for X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
 * X-XSS-Protection, and Cross-Origin-* headers
 */

import type {
  XFrameOptions,
  ReferrerPolicy,
  CrossOriginEmbedderPolicy,
  CrossOriginOpenerPolicy,
  CrossOriginResourcePolicy,
} from './types'

/**
 * Build X-Content-Type-Options header value
 *
 * Always returns 'nosniff' to prevent MIME type sniffing attacks.
 *
 * @returns X-Content-Type-Options header value
 *
 * @example
 * ```typescript
 * const header = buildXContentTypeOptionsHeader()
 * // Returns: "nosniff"
 * ```
 */
export function buildXContentTypeOptionsHeader(): string {
  return 'nosniff'
}

/**
 * Build X-Frame-Options header value
 *
 * Controls whether the page can be embedded in iframes (clickjacking protection).
 *
 * @param option - X-Frame-Options value ('DENY' or 'SAMEORIGIN')
 * @returns X-Frame-Options header value
 *
 * @example
 * ```typescript
 * const header = buildXFrameOptionsHeader('DENY')
 * // Returns: "DENY"
 *
 * const header = buildXFrameOptionsHeader('SAMEORIGIN')
 * // Returns: "SAMEORIGIN"
 * ```
 */
export function buildXFrameOptionsHeader(option: XFrameOptions = 'DENY'): string {
  return option
}

/**
 * Build Referrer-Policy header value
 *
 * Controls how much referrer information is sent with requests.
 *
 * @param policy - Referrer-Policy value
 * @returns Referrer-Policy header value
 *
 * @example
 * ```typescript
 * const header = buildReferrerPolicyHeader('strict-origin-when-cross-origin')
 * // Returns: "strict-origin-when-cross-origin"
 * ```
 */
export function buildReferrerPolicyHeader(
  policy: ReferrerPolicy = 'strict-origin-when-cross-origin'
): string {
  return policy
}

/**
 * Build X-XSS-Protection header value
 *
 * DEPRECATED: Modern browsers use CSP instead.
 * Always returns '0' to disable the legacy XSS filter.
 *
 * The legacy XSS filter has known vulnerabilities and should be disabled.
 * Use Content-Security-Policy for XSS protection instead.
 *
 * @returns X-XSS-Protection header value
 *
 * @example
 * ```typescript
 * const header = buildXXssProtectionHeader()
 * // Returns: "0"
 * ```
 */
export function buildXXssProtectionHeader(): string {
  return '0'
}

/**
 * Build Cross-Origin-Embedder-Policy header value
 *
 * Controls cross-origin resource embedding (Spectre mitigation).
 *
 * @param policy - COEP value
 * @returns Cross-Origin-Embedder-Policy header value
 *
 * @example
 * ```typescript
 * const header = buildCrossOriginEmbedderPolicyHeader('require-corp')
 * // Returns: "require-corp"
 * ```
 */
export function buildCrossOriginEmbedderPolicyHeader(
  policy: CrossOriginEmbedderPolicy = 'unsafe-none'
): string {
  return policy
}

/**
 * Build Cross-Origin-Opener-Policy header value
 *
 * Controls cross-origin window references (Spectre mitigation).
 *
 * @param policy - COOP value
 * @returns Cross-Origin-Opener-Policy header value
 *
 * @example
 * ```typescript
 * const header = buildCrossOriginOpenerPolicyHeader('same-origin')
 * // Returns: "same-origin"
 * ```
 */
export function buildCrossOriginOpenerPolicyHeader(
  policy: CrossOriginOpenerPolicy = 'unsafe-none'
): string {
  return policy
}

/**
 * Build Cross-Origin-Resource-Policy header value
 *
 * Controls cross-origin resource access (Spectre mitigation).
 *
 * @param policy - CORP value
 * @returns Cross-Origin-Resource-Policy header value
 *
 * @example
 * ```typescript
 * const header = buildCrossOriginResourcePolicyHeader('same-origin')
 * // Returns: "same-origin"
 * ```
 */
export function buildCrossOriginResourcePolicyHeader(
  policy: CrossOriginResourcePolicy = 'same-site'
): string {
  return policy
}

/**
 * Default security headers values
 */
export const DEFAULT_SECURITY_HEADERS = {
  xContentTypeOptions: 'nosniff',
  xFrameOptions: 'DENY' as XFrameOptions,
  referrerPolicy: 'strict-origin-when-cross-origin' as ReferrerPolicy,
  xXssProtection: '0',
}
