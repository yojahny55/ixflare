/**
 * Cookie Error Classes
 * Story 5-7: Secure Cookie Handling
 *
 * Type-safe error handling for cookie operations
 * Generic messages prevent information leakage
 */

import { AppError } from '@/errors'

/**
 * Base cookie error class
 */
export class CookieError extends AppError {
  constructor(code: string, message: string, status: number = 400) {
    super(`COOKIE.${code}`, message, status)
    this.name = 'CookieError'
  }
}

/**
 * Cookie validation error (prefix requirements, security violations)
 *
 * Used when cookie attributes don't meet security requirements
 */
export class CookieValidationError extends CookieError {
  constructor(code: string, message: string) {
    super(code, message, 400)
    this.name = 'CookieValidationError'
  }
}

/**
 * Cookie security error (production enforcement violations)
 *
 * Used when security requirements are not met in production
 */
export class CookieSecurityError extends CookieError {
  constructor(message: string = 'Cookie security requirements not met') {
    super('SECURITY_VIOLATION', message, 400)
    this.name = 'CookieSecurityError'
  }
}

/**
 * Cookie signature error (tamper detection)
 *
 * Generic message prevents information leakage about signature details
 * Note: Signed cookie functions return null instead of throwing this error
 * This error is only used for configuration or internal validation issues
 */
export class CookieSignatureError extends CookieError {
  constructor(message: string = 'Cookie signature validation failed') {
    super('SIGNATURE_INVALID', message, 400)
    this.name = 'CookieSignatureError'
  }
}
