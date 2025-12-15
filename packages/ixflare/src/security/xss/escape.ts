/**
 * XSS Prevention - Context-Specific Encoding
 *
 * Implements OWASP-recommended encoding strategies for different contexts:
 * - HTML content context
 * - HTML attribute context
 * - JavaScript string context
 * - URL parameter context
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 */

/**
 * Escapes HTML special characters for safe insertion into HTML content
 *
 * Use when inserting untrusted data into HTML body context:
 * ```typescript
 * <div>{escapeHtml(userInput)}</div>
 * ```
 *
 * Encodes: & < > " '
 *
 * @param str - String to escape
 * @returns HTML-safe string
 */
export function escapeHtml(str: string): string {
  if (!str) return str

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Escapes all non-alphanumeric characters for safe insertion into HTML attributes
 *
 * Use when inserting untrusted data into HTML attributes (already quoted):
 * ```typescript
 * <div data-name="{escapeHtmlAttribute(userInput)}"></div>
 * ```
 *
 * Uses &#xHH; format for maximum compatibility.
 * More strict than escapeHtml to prevent attribute injection attacks.
 *
 * @param str - String to escape
 * @returns Attribute-safe string with all non-alphanumeric chars encoded
 */
export function escapeHtmlAttribute(str: string): string {
  if (!str) return str

  let result = ''
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const code = str.charCodeAt(i)

    // Allow only alphanumeric characters (a-z, A-Z, 0-9)
    if (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122) // a-z
    ) {
      result += char
    } else {
      // Encode everything else as &#xHH; or &#xHHHH;
      result += `&#x${code.toString(16)};`
    }
  }

  return result
}

/**
 * Escapes characters for safe insertion into JavaScript strings
 *
 * Use when inserting untrusted data into JavaScript string literals:
 * ```typescript
 * const msg = "{escapeJavaScript(userInput)}";
 * ```
 *
 * Escapes quotes, backslashes, newlines, and HTML script terminators.
 *
 * WARNING: This does NOT make data safe for execution contexts.
 * Never use untrusted data in: eval(), setTimeout(), Function(), etc.
 *
 * @param str - String to escape
 * @returns JavaScript-safe string
 */
export function escapeJavaScript(str: string): string {
  if (!str) return str

  return str
    .replace(/\\/g, '\\\\') // Backslash must be first
    .replace(/"/g, '\\"') // Double quote
    .replace(/'/g, "\\'") // Single quote
    .replace(/\n/g, '\\n') // Newline
    .replace(/\r/g, '\\r') // Carriage return
    .replace(/\t/g, '\\t') // Tab
    .replace(/\//g, '\\/') // Forward slash (prevents </script> terminator)
    .replace(/\u2028/g, '\\u2028') // Line separator
    .replace(/\u2029/g, '\\u2029') // Paragraph separator
}

/**
 * URL-encodes a string for safe insertion into URL parameters
 *
 * Use when inserting untrusted data into URL parameters:
 * ```typescript
 * const url = `/search?q={escapeUrl(userInput)}`;
 * ```
 *
 * Percent-encodes all characters except alphanumeric and: - . _ ~
 *
 * @param str - String to encode
 * @returns URL-encoded string
 */
export function escapeUrl(str: string): string {
  if (!str) return str

  return encodeURIComponent(str)
}
