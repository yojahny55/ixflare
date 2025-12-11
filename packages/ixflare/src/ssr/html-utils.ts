/**
 * @module ssr/html-utils
 * @description Shared HTML utility functions for SSR rendering
 * @packageDocumentation
 */

/**
 * Escapes HTML special characters to prevent XSS injection.
 * @param str - String to escape
 * @returns Escaped string safe for HTML attribute/content
 * @example
 * ```typescript
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Builds HTML attributes string from a Record, escaping values for security.
 * @param attrs - Record of attribute name to value
 * @returns HTML attributes string like ' class="dark" dir="rtl"'
 * @example
 * ```typescript
 * buildAttributes({ class: 'dark', dir: 'rtl' })
 * // Returns: ' class="dark" dir="rtl"'
 * ```
 */
export function buildAttributes(attrs?: Record<string, string>): string {
  if (!attrs) return ''
  return Object.entries(attrs)
    .map(([name, value]) => ` ${escapeHtml(name)}="${escapeHtml(value)}"`)
    .join('')
}
