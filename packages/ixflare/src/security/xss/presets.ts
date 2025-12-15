/**
 * XSS Prevention - Sanitization Presets
 *
 * Pre-configured sanitization options for common use cases.
 * These provide sensible defaults while allowing custom configuration.
 */

import type { SanitizeOptions } from './types'

/**
 * TEXT preset - Strip all HTML, text only (safest)
 *
 * Use when you want to display user input as plain text with no formatting.
 *
 * @example
 * ```typescript
 * const safe = sanitizeHtml(userInput, presets.text)
 * // "<p>Hello</p>" → "Hello"
 * ```
 */
export const text: Required<SanitizeOptions> = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: [],
  stripDisallowedTags: true,
  allowComments: false,
}

/**
 * BASIC preset - Bold, italic, links, and line breaks only
 *
 * Use for simple user comments or basic formatted text.
 * Allows minimal formatting without structural elements.
 *
 * Allowed tags: b, i, a, br
 * Allowed attributes: a[href, title]
 *
 * @example
 * ```typescript
 * const safe = sanitizeHtml(userComment, presets.basic)
 * // Allows: <b>Bold</b> <i>Italic</i> <a href="/">Link</a>
 * ```
 */
export const basic: Required<SanitizeOptions> = {
  allowedTags: ['b', 'i', 'a', 'br'],
  allowedAttributes: {
    a: ['href', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  stripDisallowedTags: true,
  allowComments: false,
}

/**
 * RICH preset - Full content formatting
 *
 * Use for rich user content like blog posts, articles, or documentation.
 * Allows paragraphs, headings, lists, links, images, code blocks.
 *
 * Allowed tags: p, h1-h6, ul, ol, li, a, img, blockquote, code, pre, br
 * Allowed attributes:
 * - a[href, title]
 * - img[src, alt, title]
 *
 * @example
 * ```typescript
 * const safe = sanitizeHtml(blogPost, presets.rich)
 * // Allows full formatting but strips scripts and event handlers
 * ```
 */
export const rich: Required<SanitizeOptions> = {
  allowedTags: [
    // Text structure
    'p',
    'br',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Lists
    'ul',
    'ol',
    'li',
    // Inline formatting
    'b',
    'i',
    'strong',
    'em',
    // Links and media
    'a',
    'img',
    // Code
    'code',
    'pre',
    // Quotes
    'blockquote',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  stripDisallowedTags: true,
  allowComments: false,
}

/**
 * All sanitization presets
 */
export const presets = {
  text,
  basic,
  rich,
} as const
