/**
 * Content-Security-Policy Builder
 * Story 5-8: Security Headers Auto-Injection
 *
 * Builds CSP headers with nonce support and strict-dynamic for XSS prevention
 */

import type { ContentSecurityPolicyConfig } from './types'
import { NonceGenerationError } from './errors'

/**
 * Request-scoped nonce storage
 * This is set at the start of each request and cleared after response
 */
let requestNonce: string | null = null

/**
 * Generate a cryptographically secure nonce (128-bit minimum)
 *
 * Uses WebCrypto API to generate random values.
 * Nonce is base64url encoded for use in CSP headers.
 *
 * @returns Base64url encoded nonce (minimum 128 bits)
 * @throws {NonceGenerationError} If nonce generation fails
 *
 * @example
 * ```typescript
 * const nonce = await generateNonce()
 * // Returns: "4Azqd8s_KjxRKLKj2P4vVA"
 * ```
 */
export async function generateNonce(): Promise<string> {
  try {
    // Generate 128 bits (16 bytes) of cryptographically secure random data
    const buffer = new Uint8Array(16)
    crypto.getRandomValues(buffer)

    // Convert to base64url encoding (URL-safe, no padding)
    const base64 = btoa(String.fromCharCode(...buffer))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch {
    throw new NonceGenerationError(
      'Failed to generate cryptographically secure nonce',
      'NONCE_GENERATION_FAILED'
    )
  }
}

/**
 * Get the current request's nonce
 *
 * This function retrieves the nonce that was generated and set for the current request.
 * It must be called within a request context after the security headers middleware
 * has set the nonce.
 *
 * @returns The current request nonce
 * @throws {NonceGenerationError} If called outside request context
 *
 * @example
 * ```typescript
 * // In a component during server-side rendering
 * import { getNonce } from 'ixflare/security'
 *
 * export function InlineScript() {
 *   return <script nonce={getNonce()}>console.log('Safe inline script')</script>
 * }
 * ```
 */
export function getNonce(): string {
  if (!requestNonce) {
    throw new NonceGenerationError(
      'getNonce() must be called within a request context. Ensure security headers middleware is applied.',
      'NO_REQUEST_NONCE'
    )
  }
  return requestNonce
}

/**
 * Set the nonce for the current request
 *
 * This is called by the security headers middleware to set the nonce
 * for the current request. It should not be called directly by application code.
 *
 * @param nonce - The nonce to set for this request
 * @internal
 */
export function setRequestNonce(nonce: string): void {
  requestNonce = nonce
}

/**
 * Clear the request nonce (called after response is sent)
 *
 * @internal
 */
export function clearRequestNonce(): void {
  requestNonce = null
}

/**
 * Build Content-Security-Policy header value from configuration
 *
 * Converts CSP configuration object into a valid CSP header string.
 * Supports all CSP directives and special handling for nonces with strict-dynamic.
 *
 * @param config - CSP configuration
 * @param nonce - Optional nonce to include in script-src and style-src
 * @returns CSP header value string
 *
 * @example
 * ```typescript
 * const csp = buildCSPHeader({
 *   defaultSrc: ["'self'"],
 *   scriptSrc: ["'self'"],
 *   styleSrc: ["'self'", "'unsafe-inline'"],
 * }, 'ABC123')
 * // Returns: "default-src 'self'; script-src 'self' 'nonce-ABC123' 'strict-dynamic'; style-src 'self' 'unsafe-inline' 'nonce-ABC123'"
 * ```
 */
export function buildCSPHeader(config: ContentSecurityPolicyConfig = {}, nonce?: string): string {
  const directives: string[] = []

  // Helper to convert camelCase to kebab-case directive names
  const toDirectiveName = (key: string): string => {
    return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  }

  // Process array-based directives
  const arrayDirectives: (keyof ContentSecurityPolicyConfig)[] = [
    'defaultSrc',
    'scriptSrc',
    'styleSrc',
    'imgSrc',
    'fontSrc',
    'connectSrc',
    'mediaSrc',
    'objectSrc',
    'frameSrc',
    'frameAncestors',
    'formAction',
    'baseUri',
    'workerSrc',
    'manifestSrc',
    'prefetchSrc',
    'childSrc',
  ]

  for (const key of arrayDirectives) {
    const value = config[key]
    if (value && Array.isArray(value)) {
      const sources = [...value]

      // Special handling for script-src and style-src with nonce
      if (nonce && (key === 'scriptSrc' || key === 'styleSrc')) {
        // Add nonce
        sources.push(`'nonce-${nonce}'`)

        // For script-src, add 'strict-dynamic' for better security
        // strict-dynamic makes the CSP more secure by only allowing scripts loaded
        // by scripts with the correct nonce, ignoring allowlist-based sources
        if (key === 'scriptSrc' && !sources.includes("'strict-dynamic'")) {
          sources.push("'strict-dynamic'")
        }
      }

      // Only add directive if sources is not empty
      if (sources.length > 0) {
        const directiveName = toDirectiveName(key)
        directives.push(`${directiveName} ${sources.join(' ')}`)
      }
    }
  }

  // Process boolean directives
  if (config.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests')
  }

  if (config.blockAllMixedContent) {
    directives.push('block-all-mixed-content')
  }

  // Process report directives
  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`)
  }

  if (config.reportTo) {
    directives.push(`report-to ${config.reportTo}`)
  }

  // If no directives were added, return a secure default
  if (directives.length === 0) {
    directives.push("default-src 'self'")
    if (nonce) {
      directives.push(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`)
    } else {
      directives.push("script-src 'self'")
    }
  }

  return directives.join('; ')
}

/**
 * Get the appropriate CSP header name based on report-only mode
 *
 * @param reportOnly - Whether to use report-only mode
 * @returns Header name to use
 */
export function getCSPHeaderName(reportOnly?: boolean): string {
  return reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
}

/**
 * Default CSP configuration (secure baseline)
 *
 * This is the default CSP applied if no custom configuration is provided.
 * It follows OWASP recommendations for a secure baseline.
 */
export const DEFAULT_CSP_CONFIG: ContentSecurityPolicyConfig = {
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
}
