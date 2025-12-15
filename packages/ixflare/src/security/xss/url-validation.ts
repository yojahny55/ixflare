/**
 * XSS Prevention - URL Validation
 *
 * Validates URLs to prevent XSS attacks via dangerous protocols.
 * Blocks javascript:, data:, vbscript:, and other unsafe schemes.
 *
 * This module implements comprehensive bypass prevention:
 * - HTML entity decoding (numeric, hex, and named entities)
 * - Control character stripping (prevents jav\tascript: bypasses)
 * - Multi-level URL encoding decoding
 * - Case-insensitive scheme matching
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
 * URL scheme pattern - matches scheme followed by colon
 */
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(.*)$/i

/**
 * Control characters pattern (ASCII 0x00-0x1F and 0x7F)
 * These can be used to bypass scheme detection: jav\tascript:
 * Using Unicode escapes to satisfy ESLint no-control-regex rule
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g

/**
 * Named HTML entities that could be used for XSS bypass
 * Comprehensive list including common attack vectors
 */
const NAMED_ENTITIES: Record<string, string> = {
  // Critical for URL scheme bypass
  '&colon;': ':',
  '&Colon;': ':',
  '&semi;': ';',
  '&Semi;': ';',
  '&sol;': '/',
  '&bsol;': '\\',
  '&period;': '.',
  '&comma;': ',',
  '&quest;': '?',
  '&num;': '#',
  '&percnt;': '%',
  '&amp;': '&',
  '&equals;': '=',
  '&plus;': '+',
  '&hyphen;': '-',
  '&minus;': '-',
  '&lowbar;': '_',

  // Whitespace entities (used for bypasses)
  '&nbsp;': ' ',
  '&ensp;': ' ',
  '&emsp;': ' ',
  '&thinsp;': ' ',
  '&Tab;': '\t',
  '&tab;': '\t',
  '&NewLine;': '\n',
  '&newline;': '\n',

  // Common HTML entities
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&lpar;': '(',
  '&rpar;': ')',
  '&lsqb;': '[',
  '&rsqb;': ']',
  '&lcub;': '{',
  '&rcub;': '}',
  '&vert;': '|',
  '&ast;': '*',
  '&Hat;': '^',
  '&grave;': '`',
  '&tilde;': '~',
  '&excl;': '!',
  '&dollar;': '$',
  '&commat;': '@',
}

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
 * isUrlSafe('javascript&colon;alert(1)') // false - entity decoded
 * isUrlSafe('jav\tascript:alert(1)') // false - control chars stripped
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

  // Normalize the URL through multiple decoding passes
  const normalized = normalizeUrl(url)

  // Extract scheme from normalized URL
  const match = normalized.match(SCHEME_PATTERN)

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
 * Normalizes a URL by decoding all possible bypass techniques
 *
 * Process:
 * 1. Decode HTML entities (named, numeric, hex)
 * 2. Decode URL encoding (multi-pass)
 * 3. Strip control characters
 * 4. Trim whitespace
 * 5. Lowercase for scheme comparison
 */
function normalizeUrl(url: string): string {
  let normalized = url

  // Iteratively decode until stable
  let previous = ''
  let iterations = 0

  while (normalized !== previous && iterations < MAX_DECODE_ITERATIONS) {
    previous = normalized

    // Step 1: Decode HTML entities
    normalized = decodeHtmlEntities(normalized)

    // Step 2: Decode URL encoding
    try {
      normalized = decodeURIComponent(normalized)
    } catch {
      // Invalid encoding, continue with current value
    }

    iterations++
  }

  // Step 3: Strip ALL control characters (prevents jav\tascript: bypass)
  normalized = normalized.replace(CONTROL_CHARS_PATTERN, '')

  // Step 4: Trim whitespace from ends
  normalized = normalized.trim()

  return normalized
}

/**
 * Decodes all HTML entities (named, numeric decimal, numeric hex)
 */
function decodeHtmlEntities(str: string): string {
  let result = str

  // Decode numeric decimal entities: &#106; -> j
  result = result.replace(/&#(\d+);?/gi, (_, dec) => {
    const code = parseInt(dec, 10)
    return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ''
  })

  // Decode numeric hex entities: &#x6a; -> j
  result = result.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
    const code = parseInt(hex, 16)
    return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ''
  })

  // Decode named entities (case-sensitive for most, case-insensitive for common)
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    // Create case-insensitive regex for this entity
    const escapedEntity = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedEntity, 'gi')
    result = result.replace(regex, char)
  }

  return result
}
