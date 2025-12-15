/**
 * XSS Prevention Types
 * Type definitions for HTML sanitization and XSS prevention
 */

/**
 * Configuration for HTML sanitization
 */
export interface SanitizeOptions {
  /**
   * Tags allowed in the sanitized output
   * @example ['p', 'b', 'i', 'a']
   */
  allowedTags?: string[]

  /**
   * Attributes allowed per tag
   * @example { a: ['href', 'title'], img: ['src', 'alt'] }
   */
  allowedAttributes?: Record<string, string[]>

  /**
   * URL schemes allowed in href/src attributes
   * @default ['http', 'https', 'mailto', 'tel']
   */
  allowedSchemes?: string[]

  /**
   * Whether to strip tags entirely or escape them
   * @default true
   */
  stripDisallowedTags?: boolean

  /**
   * Whether to allow comments in HTML
   * @default false
   */
  allowComments?: boolean
}

/**
 * Options for URL safety validation
 */
export interface UrlValidationOptions {
  /**
   * URL schemes to allow
   * @default ['http', 'https', 'mailto', 'tel']
   */
  allowedSchemes?: string[]

  /**
   * Whether to allow relative URLs
   * @default true
   */
  allowRelative?: boolean
}

/**
 * Context types for encoding
 */
export type EncodingContext = 'html' | 'attribute' | 'javascript' | 'url' | 'css'

/**
 * Result of URL validation
 */
export interface UrlValidationResult {
  /**
   * Whether the URL is safe
   */
  safe: boolean

  /**
   * The validated/normalized URL (if safe)
   */
  url?: string

  /**
   * Reason for rejection (if unsafe)
   */
  reason?: string

  /**
   * Detected scheme
   */
  scheme?: string
}
