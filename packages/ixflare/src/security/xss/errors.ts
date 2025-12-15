/**
 * XSS Prevention - Error Classes
 *
 * Typed error classes for XSS prevention failures.
 */

import { AppError } from '@/errors'

/**
 * Base XSS error class
 */
export class XSSError extends AppError {
  constructor(code: string, message: string) {
    super(`XSS.${code}`, message, 400)
    this.name = 'XSSError'
  }
}

/**
 * Error thrown when a URL contains an unsafe scheme
 */
export class UnsafeUrlError extends XSSError {
  constructor(url: string, scheme?: string) {
    const msg = scheme
      ? `Unsafe URL scheme "${scheme}" detected in: ${url}`
      : `Unsafe URL detected: ${url}`
    super('UNSAFE_URL', msg)
    this.name = 'UnsafeUrlError'
  }
}

/**
 * Error thrown when attempting to set a dangerous attribute
 */
export class InvalidAttributeError extends XSSError {
  constructor(attributeName: string) {
    super(
      'INVALID_ATTRIBUTE',
      `Cannot set dangerous attribute "${attributeName}". Event handler attributes (on*) are not allowed.`
    )
    this.name = 'InvalidAttributeError'
  }
}
