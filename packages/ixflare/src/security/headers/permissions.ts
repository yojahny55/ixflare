/**
 * Permissions-Policy Header Builder
 * Story 5-8: Security Headers Auto-Injection
 *
 * Builds Permissions-Policy headers to restrict browser feature usage
 */

import type { PermissionsPolicyConfig } from './types'

/**
 * Convert allowlist array to Permissions-Policy directive value
 *
 * - Empty array [] becomes ()
 * - ['self'] becomes (self)
 * - ['self', 'https://example.com'] becomes (self "https://example.com")
 * - ['*'] becomes *
 *
 * @param allowlist - Array of allowed origins
 * @returns Formatted directive value
 */
function formatAllowlist(allowlist: string[]): string {
  if (allowlist.length === 0) {
    return '()'
  }

  // Special case: * means allow all origins
  if (allowlist.length === 1 && allowlist[0] === '*') {
    return '*'
  }

  // Format as (origin1 origin2 ...)
  // 'self' becomes self (no quotes)
  // URLs become "https://example.com" (with quotes)
  const formatted = allowlist.map((origin) => {
    if (origin === 'self' || origin === '*') {
      return origin
    }
    return `"${origin}"`
  })

  return `(${formatted.join(' ')})`
}

/**
 * Build Permissions-Policy header value from configuration
 *
 * Converts permissions policy configuration into a valid header string.
 *
 * @param config - Permissions-Policy configuration
 * @returns Permissions-Policy header value string
 *
 * @example
 * ```typescript
 * const policy = buildPermissionsPolicyHeader({
 *   camera: [],                  // Disable camera
 *   microphone: [],              // Disable microphone
 *   geolocation: ['self'],       // Same origin only
 *   payment: ['self', 'https://stripe.com'],
 * })
 * // Returns: "camera=(), microphone=(), geolocation=(self), payment=(self "https://stripe.com")"
 * ```
 */
export function buildPermissionsPolicyHeader(config: PermissionsPolicyConfig): string {
  const directives: string[] = []

  // Helper to convert camelCase to kebab-case
  const toDirectiveName = (key: string): string => {
    return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  }

  // Process each feature policy
  for (const [key, value] of Object.entries(config)) {
    if (value && Array.isArray(value)) {
      const directiveName = toDirectiveName(key)
      const allowlist = formatAllowlist(value)
      directives.push(`${directiveName}=${allowlist}`)
    }
  }

  return directives.join(', ')
}

/**
 * Default Permissions-Policy configuration (restrictive baseline)
 *
 * Disables sensitive features by default:
 * - camera: Disabled
 * - microphone: Disabled
 * - geolocation: Disabled
 * - payment: Disabled
 * - usb: Disabled
 *
 * Applications should enable features as needed.
 */
export const DEFAULT_PERMISSIONS_POLICY_CONFIG: PermissionsPolicyConfig = {
  camera: [],
  microphone: [],
  geolocation: [],
  payment: [],
  usb: [],
}
