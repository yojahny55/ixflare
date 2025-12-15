/**
 * XSS Prevention - URL Validation
 *
 * Validates URLs to prevent XSS attacks via dangerous protocols.
 * Blocks javascript:, data:, vbscript:, and other unsafe schemes.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */

import type { UrlValidationOptions } from './types'

/**
 * Default URL validation options
 */
const DEFAULT_OPTIONS: Required<UrlValidationOptions> = {
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowRelative: true,
}

/**
 * Schemes that are always dangerous and should be blocked
 */
const DANGEROUS_SCHEMES = ['javascript', 'data', 'vbscript', 'file']

/**
 * URL scheme pattern
 */
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(.*)$/i

/**
 * Checks if a URL is safe to use based on its protocol scheme
 *
 * By default, allows http, https, mailto, tel and relative URLs.
 * Always blocks dangerous schemes: javascript, data, vbscript, file.
 *
 * @example
 * ```typescript
 * isUrlSafe('https://example.com')  // true
 * isUrlSafe('javascript:alert(1)')  // false
 * isUrlSafe('/relative/path')       // true
 * isUrlSafe('data:text/html,<script>') // false
 * ```
 *
 * @param url - URL to validate
 * @param options - Validation options
 * @returns true if URL is safe, false otherwise
 */
export function isUrlSafe(
  url: string,
  options: UrlValidationOptions = {}
): boolean {
  if (!url) return false

  // Merge with defaults
  const opts: Required<UrlValidationOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    allowedSchemes: options.allowedSchemes || DEFAULT_OPTIONS.allowedSchemes,
  }

  // Trim and decode the URL to prevent encoding bypass
  const trimmed = url.trim()
  const decoded = decodeUrlSafely(trimmed)

  // Extract scheme
  const match = decoded.match(SCHEME_PATTERN)

  if (match) {
    const scheme = match[1].toLowerCase()

    // Always block dangerous schemes
    if (DANGEROUS_SCHEMES.includes(scheme)) {
      return false
    }

    // Check against allowed schemes
    return opts.allowedSchemes.includes(scheme)
  }

  // No scheme found - treat as relative URL
  return opts.allowRelative
}

/**
 * Maximum number of decoding iterations to prevent infinite loops
 */
const MAX_DECODE_ITERATIONS = 10

/**
 * Safely decodes a URL, handling multi-level encoding bypass attempts
 *
 * Attackers may use triple/quadruple encoding to bypass validation:
 * %25%36%61%25%36%31... → %6a%61... → javascript:
 *
 * This function decodes until the string is stable (no more changes)
 * or max iterations reached.
 */
function decodeUrlSafely(url: string): string {
  let decoded = url
  let previous = ''
  let iterations = 0

  // Loop until stable (no changes) or max iterations
  while (decoded !== previous && iterations < MAX_DECODE_ITERATIONS) {
    previous = decoded
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      // Malformed encoding - stop decoding, use current state
      break
    }
    iterations++
  }

  return decoded
}
