/**
 * XSS Prevention - HTML Sanitizer
 *
 * Lightweight, DOM-free HTML sanitizer for edge environments.
 * Uses allowlist-based approach per OWASP recommendations.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */

import type { SanitizeOptions } from './types'
import { escapeHtml } from './escape'

/**
 * Default sanitization options - text only (safest)
 */
const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  stripDisallowedTags: true,
  allowComments: false,
}

/**
 * Dangerous URL schemes that should always be blocked
 */
const DANGEROUS_SCHEMES = ['javascript', 'data', 'vbscript', 'file']

/**
 * Event handler attributes that should always be stripped
 */
const EVENT_HANDLERS = /^on[a-z]+$/i

/**
 * HTML tag pattern
 */
const TAG_PATTERN = /<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi

/**
 * HTML comment pattern
 */
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g

/**
 * Attribute pattern
 */
const ATTR_PATTERN = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi

/**
 * URL scheme pattern
 */
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(.*)$/i

/**
 * Sanitizes HTML by removing disallowed tags and attributes
 *
 * @example
 * ```typescript
 * const safe = sanitizeHtml('<p>Hello</p><script>alert(1)</script>', {
 *   allowedTags: ['p']
 * })
 * // Result: '<p>Hello</p>'
 * ```
 *
 * @param input - HTML string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  input: string,
  options: SanitizeOptions = {}
): string {
  if (!input) return input

  // Merge with defaults
  const opts: Required<SanitizeOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    allowedAttributes: options.allowedAttributes || {},
    allowedSchemes: options.allowedSchemes || DEFAULT_OPTIONS.allowedSchemes,
  }

  let result = input

  // Remove comments if not allowed
  if (!opts.allowComments) {
    result = result.replace(COMMENT_PATTERN, '')
  }

  // Process tags
  result = result.replace(TAG_PATTERN, (match, tagName, attributes) => {
    const lowerTag = tagName.toLowerCase()
    const isClosing = match.startsWith('</')

    // Check if tag is allowed
    if (!opts.allowedTags.includes(lowerTag)) {
      if (opts.stripDisallowedTags) {
        // Strip the tag completely
        return ''
      } else {
        // Escape the tag
        return escapeHtml(match)
      }
    }

    // For closing tags, just return them as-is if tag is allowed
    if (isClosing) {
      return `</${lowerTag}>`
    }

    // Process attributes for opening tags
    const allowedAttrs = opts.allowedAttributes[lowerTag] || []
    const sanitizedAttrs = sanitizeAttributes(
      attributes,
      allowedAttrs,
      opts.allowedSchemes
    )

    // Self-closing tag
    if (match.endsWith('/>')) {
      return sanitizedAttrs ? `<${lowerTag} ${sanitizedAttrs}/>` : `<${lowerTag}/>`
    }

    // Regular opening tag
    return sanitizedAttrs ? `<${lowerTag} ${sanitizedAttrs}>` : `<${lowerTag}>`
  })

  return result
}

/**
 * Sanitizes attributes, keeping only allowed ones and validating URLs
 */
function sanitizeAttributes(
  attributesStr: string,
  allowedAttrs: string[],
  allowedSchemes: string[]
): string {
  if (!attributesStr || allowedAttrs.length === 0) {
    return ''
  }

  const sanitized: string[] = []

  // Reset regex state
  ATTR_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = ATTR_PATTERN.exec(attributesStr)) !== null) {
    const attrName = match[1].toLowerCase()
    const attrValue = match[2] || match[3] || match[4] || ''

    // Skip event handlers
    if (EVENT_HANDLERS.test(attrName)) {
      continue
    }

    // Check if attribute is allowed
    if (!allowedAttrs.includes(attrName)) {
      continue
    }

    // Validate URL attributes
    if (attrName === 'href' || attrName === 'src') {
      if (!isUrlSafe(attrValue, allowedSchemes)) {
        // Skip unsafe URLs
        continue
      }
    }

    // Add sanitized attribute
    sanitized.push(`${attrName}="${escapeHtml(attrValue)}"`)
  }

  return sanitized.join(' ')
}

/**
 * Checks if a URL is safe based on allowed schemes
 */
function isUrlSafe(url: string, allowedSchemes: string[]): boolean {
  if (!url) return false

  // Decode HTML entities to check the actual URL
  const decoded = decodeHtmlEntities(url.trim())

  // Check for dangerous schemes
  const match = decoded.match(SCHEME_PATTERN)

  if (match) {
    const scheme = match[1].toLowerCase()

    // Block explicitly dangerous schemes
    if (DANGEROUS_SCHEMES.includes(scheme)) {
      return false
    }

    // Check against allowed schemes
    return allowedSchemes.includes(scheme)
  }

  // Relative URLs are allowed by default (no scheme)
  return true
}

/**
 * Decodes common HTML entities
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
}
