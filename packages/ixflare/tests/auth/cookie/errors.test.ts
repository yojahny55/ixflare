/**
 * Cookie Error Classes Tests
 * Story 5-7: Secure Cookie Handling
 */

import { describe, it, expect } from 'vitest'
import {
  CookieError,
  CookieValidationError,
  CookieSecurityError,
  CookieSignatureError,
} from '@/auth/cookie/errors'

describe('CookieError', () => {
  it('should create cookie error with code prefix', () => {
    const error = new CookieError('TEST_CODE', 'Test message')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(CookieError)
    expect(error.name).toBe('CookieError')
    expect(error.code).toBe('COOKIE.TEST_CODE')
    expect(error.message).toBe('Test message')
    expect(error.status).toBe(400)
  })

  it('should allow custom status code', () => {
    const error = new CookieError('TEST_CODE', 'Test message', 500)

    expect(error.status).toBe(500)
  })

  it('should have timestamp', () => {
    const before = Date.now()
    const error = new CookieError('TEST_CODE', 'Test message')
    const after = Date.now()

    expect(error.timestamp).toBeGreaterThanOrEqual(before)
    expect(error.timestamp).toBeLessThanOrEqual(after)
  })
})

describe('CookieValidationError', () => {
  it('should create validation error', () => {
    const error = new CookieValidationError('INVALID_PREFIX', 'Prefix validation failed')

    expect(error).toBeInstanceOf(CookieError)
    expect(error).toBeInstanceOf(CookieValidationError)
    expect(error.name).toBe('CookieValidationError')
    expect(error.code).toBe('COOKIE.INVALID_PREFIX')
    expect(error.message).toBe('Prefix validation failed')
    expect(error.status).toBe(400)
  })
})

describe('CookieSecurityError', () => {
  it('should create security error with default message', () => {
    const error = new CookieSecurityError()

    expect(error).toBeInstanceOf(CookieError)
    expect(error).toBeInstanceOf(CookieSecurityError)
    expect(error.name).toBe('CookieSecurityError')
    expect(error.code).toBe('COOKIE.SECURITY_VIOLATION')
    expect(error.message).toBe('Cookie security requirements not met')
    expect(error.status).toBe(400)
  })

  it('should create security error with custom message', () => {
    const error = new CookieSecurityError('Custom security message')

    expect(error.message).toBe('Custom security message')
  })
})

describe('CookieSignatureError', () => {
  it('should create signature error with default message', () => {
    const error = new CookieSignatureError()

    expect(error).toBeInstanceOf(CookieError)
    expect(error).toBeInstanceOf(CookieSignatureError)
    expect(error.name).toBe('CookieSignatureError')
    expect(error.code).toBe('COOKIE.SIGNATURE_INVALID')
    expect(error.message).toBe('Cookie signature validation failed')
    expect(error.status).toBe(400)
  })

  it('should create signature error with custom message', () => {
    const error = new CookieSignatureError('Tampered cookie detected')

    expect(error.message).toBe('Tampered cookie detected')
  })
})

describe('Error Information Leakage Prevention', () => {
  it('should not leak implementation details in error messages', () => {
    const validationError = new CookieValidationError(
      'PREFIX_INVALID',
      'Prefix requirements not met'
    )
    const securityError = new CookieSecurityError()
    const signatureError = new CookieSignatureError()

    // Messages should be generic and not expose internal details
    expect(validationError.message).not.toContain('HMAC')
    expect(validationError.message).not.toContain('secret')
    expect(securityError.message).not.toContain('algorithm')
    expect(signatureError.message).not.toContain('key')
  })

  it('should provide toJSON for API error responses', () => {
    const error = new CookieValidationError('PREFIX_INVALID', 'Invalid prefix')
    const json = error.toJSON()

    expect(json).toHaveProperty('error')
    expect(json.error).toHaveProperty('code', 'COOKIE.PREFIX_INVALID')
    expect(json.error).toHaveProperty('message', 'Invalid prefix')
    expect(json.error).toHaveProperty('status', 400)
    expect(json.error).toHaveProperty('timestamp')
  })
})
