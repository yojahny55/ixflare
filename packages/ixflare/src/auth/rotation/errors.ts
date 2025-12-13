/**
 * @module auth/rotation/errors
 * @description Error classes for key rotation
 */

import { AuthError } from '@/errors'

/**
 * Thrown when key rotation fails
 * @extends AuthError
 */
export class KeyRotationError extends AuthError {
  constructor(message: string) {
    super('KEY_ROTATION_FAILED', message)
    this.name = 'KeyRotationError'
  }
}

/**
 * Thrown when a requested key is not found or has expired
 * @extends AuthError
 */
export class KeyNotFoundError extends AuthError {
  constructor(_kid: string) {
    // Don't leak the kid in production - security best practice
    super('KEY_NOT_FOUND', 'Signing key not found or expired')
    this.name = 'KeyNotFoundError'
  }
}

/**
 * Thrown when rotation configuration is invalid
 * @extends AuthError
 */
export class InvalidRotationConfigError extends AuthError {
  constructor(message: string) {
    super('INVALID_ROTATION_CONFIG', message)
    this.name = 'InvalidRotationConfigError'
  }
}
