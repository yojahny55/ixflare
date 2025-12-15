/**
 * Security Headers Error Classes Tests
 * Story 5-8: Security Headers Auto-Injection
 */

import { describe, it, expect } from 'vitest'
import {
  SecurityHeaderError,
  CSPConfigError,
  HSTSConfigError,
  PermissionsPolicyError,
  NonceGenerationError,
} from '@/security/headers/errors'

describe('SecurityHeaderError', () => {
  it('should create error with message and default code', () => {
    const error = new SecurityHeaderError('Test error')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SecurityHeaderError)
    expect(error.message).toBe('Test error')
    expect(error.code).toBe('SECURITY_HEADER_ERROR')
    expect(error.name).toBe('SecurityHeaderError')
  })

  it('should create error with custom code', () => {
    const error = new SecurityHeaderError('Test error', 'CUSTOM_CODE')

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('CUSTOM_CODE')
  })

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new SecurityHeaderError('Test error')
    }).toThrow(SecurityHeaderError)

    try {
      throw new SecurityHeaderError('Test error', 'TEST_CODE')
    } catch (e) {
      expect(e).toBeInstanceOf(SecurityHeaderError)
      if (e instanceof SecurityHeaderError) {
        expect(e.code).toBe('TEST_CODE')
      }
    }
  })
})

describe('CSPConfigError', () => {
  it('should extend SecurityHeaderError', () => {
    const error = new CSPConfigError('Invalid CSP config')

    expect(error).toBeInstanceOf(SecurityHeaderError)
    expect(error).toBeInstanceOf(CSPConfigError)
    expect(error.message).toBe('Invalid CSP config')
    expect(error.code).toBe('CSP_CONFIG_ERROR')
    expect(error.name).toBe('CSPConfigError')
  })

  it('should support custom error codes', () => {
    const error = new CSPConfigError('Invalid directive', 'INVALID_CSP_DIRECTIVE')

    expect(error.code).toBe('INVALID_CSP_DIRECTIVE')
    expect(error.message).toBe('Invalid directive')
  })

  it('should be catchable as SecurityHeaderError', () => {
    try {
      throw new CSPConfigError('Test error')
    } catch (e) {
      expect(e).toBeInstanceOf(SecurityHeaderError)
      expect(e).toBeInstanceOf(CSPConfigError)
    }
  })
})

describe('HSTSConfigError', () => {
  it('should extend SecurityHeaderError', () => {
    const error = new HSTSConfigError('Invalid HSTS config')

    expect(error).toBeInstanceOf(SecurityHeaderError)
    expect(error).toBeInstanceOf(HSTSConfigError)
    expect(error.message).toBe('Invalid HSTS config')
    expect(error.code).toBe('HSTS_CONFIG_ERROR')
    expect(error.name).toBe('HSTSConfigError')
  })

  it('should support custom error codes', () => {
    const error = new HSTSConfigError('Preload requirements not met', 'HSTS_PRELOAD_REQUIREMENTS')

    expect(error.code).toBe('HSTS_PRELOAD_REQUIREMENTS')
    expect(error.message).toBe('Preload requirements not met')
  })
})

describe('PermissionsPolicyError', () => {
  it('should extend SecurityHeaderError', () => {
    const error = new PermissionsPolicyError('Invalid permissions policy')

    expect(error).toBeInstanceOf(SecurityHeaderError)
    expect(error).toBeInstanceOf(PermissionsPolicyError)
    expect(error.message).toBe('Invalid permissions policy')
    expect(error.code).toBe('PERMISSIONS_POLICY_ERROR')
    expect(error.name).toBe('PermissionsPolicyError')
  })

  it('should support custom error codes', () => {
    const error = new PermissionsPolicyError('Invalid allowlist', 'INVALID_PERMISSIONS_POLICY')

    expect(error.code).toBe('INVALID_PERMISSIONS_POLICY')
    expect(error.message).toBe('Invalid allowlist')
  })
})

describe('NonceGenerationError', () => {
  it('should extend SecurityHeaderError', () => {
    const error = new NonceGenerationError('Nonce generation failed')

    expect(error).toBeInstanceOf(SecurityHeaderError)
    expect(error).toBeInstanceOf(NonceGenerationError)
    expect(error.message).toBe('Nonce generation failed')
    expect(error.code).toBe('NONCE_GENERATION_ERROR')
    expect(error.name).toBe('NonceGenerationError')
  })

  it('should support custom error codes', () => {
    const error = new NonceGenerationError('WebCrypto unavailable', 'NONCE_GENERATION_FAILED')

    expect(error.code).toBe('NONCE_GENERATION_FAILED')
    expect(error.message).toBe('WebCrypto unavailable')
  })
})

describe('Error Hierarchy', () => {
  it('should allow catching all security header errors', () => {
    const errors = [
      new SecurityHeaderError('Base error'),
      new CSPConfigError('CSP error'),
      new HSTSConfigError('HSTS error'),
      new PermissionsPolicyError('Permissions error'),
      new NonceGenerationError('Nonce error'),
    ]

    for (const error of errors) {
      try {
        throw error
      } catch (e) {
        expect(e).toBeInstanceOf(SecurityHeaderError)
      }
    }
  })

  it('should allow catching specific error types', () => {
    try {
      throw new CSPConfigError('CSP specific error')
    } catch (e) {
      if (e instanceof CSPConfigError) {
        expect(e.code).toBe('CSP_CONFIG_ERROR')
      } else {
        throw new Error('Should have caught CSPConfigError')
      }
    }
  })
})
