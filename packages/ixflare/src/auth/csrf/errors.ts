/**
 * CSRF Error Classes
 * Story 5-6: CSRF Protection
 *
 * Type-safe error handling for CSRF protection
 * Generic messages prevent information leakage
 */

import { AppError } from '@/errors'

/**
 * Base CSRF error class
 */
export class CSRFError extends AppError {
  constructor(code: string, message: string) {
    super(`CSRF.${code}`, message, 403)
    this.name = 'CSRFError'
  }
}

/**
 * Invalid or missing CSRF token error
 *
 * Generic message prevents information leakage about:
 * - Whether cookie or header was missing
 * - Whether signature validation failed
 * - Whether session binding failed
 */
export class CSRFInvalidError extends CSRFError {
  constructor(message: string = 'Invalid or missing CSRF token') {
    super('CSRF_INVALID', message)
    this.name = 'CSRFInvalidError'
  }
}
