/**
 * XSS Prevention Module
 *
 * Provides comprehensive XSS prevention utilities including:
 * - Context-specific encoding (HTML, attributes, JS, URL)
 * - HTML sanitization with allowlist-based filtering
 * - URL scheme validation
 * - Safe DOM manipulation helpers
 * - Pre-configured sanitization presets
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 *
 * @example
 * ```typescript
 * import { sanitizeHtml, escapeHtml, presets } from 'ixflare/security'
 *
 * // Sanitize rich HTML
 * const safe = sanitizeHtml(userInput, presets.rich)
 *
 * // Escape for plain text
 * const escaped = escapeHtml(userInput)
 * ```
 */

// Context-specific encoding
export {
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  escapeUrl,
} from './escape'

// HTML sanitization
export { sanitizeHtml } from './sanitizer'

// Sanitization presets
export { presets } from './presets'

// URL validation
export { isUrlSafe } from './url-validation'

// DOM-safe utilities
export { setTextContent, setAttribute, setInnerHTML } from './dom-utils'

// Error classes
export { XSSError, UnsafeUrlError, InvalidAttributeError } from './errors'

// Types
export type { SanitizeOptions, UrlValidationOptions, UrlValidationResult, EncodingContext } from './types'
