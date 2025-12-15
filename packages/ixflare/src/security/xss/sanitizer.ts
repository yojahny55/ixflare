/**
 * XSS Prevention - HTML Sanitizer
 *
 * Lightweight, DOM-free HTML sanitizer for edge environments.
 * Uses allowlist-based approach per OWASP recommendations.
 *
 * ## Security Notice
 *
 * This sanitizer uses regex-based parsing for edge runtime compatibility
 * (no DOM APIs available in Cloudflare Workers). While this handles most
 * common XSS attack vectors, regex-based HTML parsing has inherent limitations:
 *
 * **Known Limitations:**
 * - May not catch all mutation XSS (mXSS) vectors where browsers parse
 *   malformed HTML differently than the regex expects
 * - Nullbyte injection and some Unicode edge cases may not be fully handled
 * - CDATA sections are not explicitly processed
 *
 * **Defense in Depth Recommendations:**
 * 1. Always use Content Security Policy (CSP) as a secondary defense
 * 2. Prefer React's built-in JSX escaping for most use cases
 * 3. For high-security contexts, consider DOMPurify in browser/Node environments
 * 4. Never modify sanitized output before rendering
 *
 * For most user-generated content (comments, posts), this sanitizer provides
 * robust protection. For extremely high-risk contexts (e.g., embedding arbitrary
 * HTML from untrusted sources), additional server-side validation is recommended.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */

import type { SanitizeOptions } from './types'
import { escapeHtml } from './escape'
import { isUrlSafe as validateUrlSafe } from './url-validation'

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
 * Event handler attributes that should always be stripped
 */
const EVENT_HANDLERS = /^on[a-z]+$/i

/**
 * Attributes that contain URLs and need scheme validation
 */
const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'srcset',
  'action',
  'formaction',
  'poster',
  'data',
  'cite',
  'background',
  'longdesc',
  'usemap',
  'xlink:href',
])

/**
 * HTML tag pattern - handles > inside quoted attribute values
 * Captures: tag name and attributes string
 * Pattern breakdown:
 * - <\/? - opening < with optional /
 * - ([a-z][a-z0-9]*) - tag name (captured)
 * - \b - word boundary
 * - ((?:[^>"']|"[^"]*"|'[^']*')*) - attributes (handles > inside quotes)
 * - \/? - optional self-closing /
 * - > - closing >
 */
const TAG_PATTERN = /<\/?([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/gi

/**
 * HTML comment pattern
 */
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g

/**
 * Attribute pattern - extracts name and value
 */
const ATTR_PATTERN = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi

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

  // Normalize allowedAttrs to lowercase for case-insensitive matching
  const normalizedAllowedAttrs = allowedAttrs.map((attr) => attr.toLowerCase())

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

    // Check if attribute is allowed (case-insensitive)
    if (!normalizedAllowedAttrs.includes(attrName)) {
      continue
    }

    // Validate URL attributes
    if (URL_ATTRIBUTES.has(attrName)) {
      // Handle srcset specially (contains multiple URLs)
      if (attrName === 'srcset') {
        if (!isSrcsetSafe(attrValue, allowedSchemes)) {
          continue
        }
      } else if (!isUrlSafe(attrValue, allowedSchemes)) {
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
 * Delegates to the comprehensive URL validator in url-validation.ts
 */
function isUrlSafe(url: string, allowedSchemes: string[]): boolean {
  return validateUrlSafe(url, { allowedSchemes, allowRelative: true })
}

/**
 * Validates srcset attribute which contains multiple URLs
 * Format: "url1 1x, url2 2x" or "url1 100w, url2 200w"
 */
function isSrcsetSafe(srcset: string, allowedSchemes: string[]): boolean {
  if (!srcset) return false

  // Split by comma to get individual sources
  const sources = srcset.split(',')

  for (const source of sources) {
    // Each source is "url [descriptor]" - extract the URL part
    const trimmed = source.trim()
    const spaceIndex = trimmed.search(/\s/)
    const url = spaceIndex > 0 ? trimmed.substring(0, spaceIndex) : trimmed

    if (!isUrlSafe(url, allowedSchemes)) {
      return false
    }
  }

  return true
}
