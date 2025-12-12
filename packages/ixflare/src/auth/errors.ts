/**
 * @module auth/errors
 * @description JWT-specific error classes
 */

import { AuthError } from '@/errors'

export class TokenExpiredError extends AuthError {
  readonly expiredAt: number

  constructor(expiredAt: number) {
    super('TOKEN_EXPIRED', `Token expired at ${new Date(expiredAt * 1000).toISOString()}`)
    this.name = 'TokenExpiredError'
    this.expiredAt = expiredAt
  }
}

export class TokenInvalidError extends AuthError {
  constructor(message: string = 'Token is invalid') {
    super('TOKEN_INVALID', message)
    this.name = 'TokenInvalidError'
  }
}

export class AlgorithmMismatchError extends AuthError {
  constructor(expected: string, received: string) {
    super('ALGORITHM_MISMATCH', `Algorithm mismatch: expected ${expected}, received ${received}`)
    this.name = 'AlgorithmMismatchError'
  }
}

export class SignatureVerificationError extends AuthError {
  constructor(message: string = 'Signature verification failed') {
    super('SIGNATURE_VERIFICATION_FAILED', message)
    this.name = 'SignatureVerificationError'
  }
}
