/**
 * XSS Prevention - DOM-Safe Utilities
 *
 * Safe DOM manipulation helpers for client-side code.
 * Prevents DOM-based XSS by using safe sinks.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
 */

import { InvalidAttributeError } from './errors'
import { sanitizeHtml } from './sanitizer'
import type { SanitizeOptions } from './types'

/**
 * Event handler attribute pattern
 */
const EVENT_HANDLER_PATTERN = /^on[a-z]+$/i

/**
 * Safely sets text content on an element using textContent (not innerHTML)
 *
 * This is the SAFE way to insert user data into the DOM.
 * Uses textContent which automatically escapes HTML.
 *
 * @example
 * ```typescript
 * // Safe - uses textContent
 * setTextContent(element, userInput)
 *
 * // Dangerous - DON'T DO THIS
 * element.innerHTML = userInput
 * ```
 *
 * @param element - DOM element to update
 * @param content - Text content to set (will be automatically escaped)
 */
export function setTextContent(element: HTMLElement, content: string): void {
  element.textContent = content
}

/**
 * Safely sets an attribute on an element with validation
 *
 * Blocks event handler attributes (on*) which could execute code.
 * Safe for other attributes like class, id, data-*, etc.
 *
 * @example
 * ```typescript
 * // Safe
 * setAttribute(element, 'class', 'active')
 * setAttribute(element, 'data-id', userId)
 *
 * // Blocked - throws InvalidAttributeError
 * setAttribute(element, 'onclick', 'alert(1)')
 * ```
 *
 * @param element - DOM element to update
 * @param name - Attribute name (lowercase)
 * @param value - Attribute value
 * @throws {InvalidAttributeError} If attribute name is an event handler (on*)
 */
export function setAttribute(
  element: HTMLElement,
  name: string,
  value: string
): void {
  // Block event handler attributes
  if (EVENT_HANDLER_PATTERN.test(name)) {
    throw new InvalidAttributeError(name)
  }

  // Use safe setAttribute method
  element.setAttribute(name, value)
}

/**
 * Safely sets innerHTML on an element after sanitizing the content
 *
 * This is the SAFE way to set innerHTML with untrusted HTML.
 * Combines sanitization and assignment in one step to prevent mistakes.
 *
 * @example
 * ```typescript
 * import { setInnerHTML, presets } from 'ixflare/security'
 *
 * // Safe - sanitizes before setting
 * setInnerHTML(element, userHtml, presets.rich)
 *
 * // Dangerous - DON'T DO THIS
 * element.innerHTML = userHtml
 * ```
 *
 * @param element - DOM element to update
 * @param content - Untrusted HTML content (will be sanitized)
 * @param options - Sanitization options (use presets for common cases)
 */
export function setInnerHTML(
  element: HTMLElement,
  content: string,
  options: SanitizeOptions
): void {
  const sanitized = sanitizeHtml(content, options)
  element.innerHTML = sanitized
}
