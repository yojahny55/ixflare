/**
 * @module tests/utils/redact
 * @description Tests for secret redaction utilities
 */

import { describe, it, expect } from 'vitest'
import { redactSecrets, redactString, isSensitiveKey } from '../../src/utils/redact'

describe('redactSecrets', () => {
  it('should redact API_KEY values', () => {
    const input = {
      DATABASE_URL: 'postgres://localhost/db',
      API_KEY: 'sk_live_abc123',
      DEBUG: true,
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      API_KEY: '[REDACTED]',
      DEBUG: true,
    })
  })

  it('should redact SECRET values', () => {
    const input = {
      JWT_SECRET: 'supersecret',
      SESSION_SECRET: 'anothersecret',
      PORT: 3000,
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      JWT_SECRET: '[REDACTED]',
      SESSION_SECRET: '[REDACTED]',
      PORT: 3000,
    })
  })

  it('should redact TOKEN values', () => {
    const input = {
      ACCESS_TOKEN: 'eyJhbGci...',
      REFRESH_TOKEN: 'abc123',
      API_VERSION: 'v1',
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      ACCESS_TOKEN: '[REDACTED]',
      REFRESH_TOKEN: '[REDACTED]',
      API_VERSION: 'v1',
    })
  })

  it('should redact PASSWORD values', () => {
    const input = {
      DATABASE_PASSWORD: 'dbpass123',
      ADMIN_PASSWORD: 'admin123',
      USERNAME: 'admin',
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      DATABASE_PASSWORD: '[REDACTED]',
      ADMIN_PASSWORD: '[REDACTED]',
      USERNAME: 'admin',
    })
  })

  it('should redact CREDENTIAL values', () => {
    const input = {
      AWS_CREDENTIALS: 'AKIAIOSFODNN7EXAMPLE',
      DATABASE_URL: 'postgres://localhost/db',
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      AWS_CREDENTIALS: '[REDACTED]',
      DATABASE_URL: 'postgres://localhost/db',
    })
  })

  it('should redact PRIVATE_KEY values', () => {
    const input = {
      PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----',
      PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----',
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      PRIVATE_KEY: '[REDACTED]',
      PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----',
    })
  })

  it('should redact AUTH values', () => {
    const input = {
      AUTH_TOKEN: 'bearer abc123',
      OAUTH_CLIENT_SECRET: 'clientsecret',
      DATABASE_URL: 'postgres://localhost/db',
    }

    const result = redactSecrets(input)

    expect(result).toEqual({
      AUTH_TOKEN: '[REDACTED]',
      OAUTH_CLIENT_SECRET: '[REDACTED]',
      DATABASE_URL: 'postgres://localhost/db',
    })
  })

  it('should support custom sensitive patterns', () => {
    const input = {
      CUSTOM_VALUE: 'sensitive',
      NORMAL_VALUE: 'public',
    }

    const customPatterns = [/CUSTOM/i]
    const result = redactSecrets(input, customPatterns)

    expect(result).toEqual({
      CUSTOM_VALUE: '[REDACTED]',
      NORMAL_VALUE: 'public',
    })
  })

  it('should handle empty objects', () => {
    const result = redactSecrets({})
    expect(result).toEqual({})
  })

  it('should not mutate original object', () => {
    const input = {
      API_KEY: 'sk_live_abc123',
      DEBUG: true,
    }

    redactSecrets(input)

    expect(input.API_KEY).toBe('sk_live_abc123')
    expect(input.DEBUG).toBe(true)
  })
})

describe('redactString', () => {
  it('should redact API_KEY in string', () => {
    const input = 'Connection failed with API_KEY=sk_live_abc123'
    const result = redactString(input)
    expect(result).toBe('Connection failed with API_KEY=[REDACTED]')
  })

  it('should redact SECRET in string', () => {
    const input = 'JWT_SECRET: supersecret'
    const result = redactString(input)
    expect(result).toBe('JWT_SECRET=[REDACTED]')
  })

  it('should redact multiple secrets in string', () => {
    const input = 'API_KEY=abc123 and JWT_SECRET=secret123'
    const result = redactString(input)
    expect(result).toBe('API_KEY=[REDACTED] and JWT_SECRET=[REDACTED]')
  })

  it('should not redact non-sensitive values', () => {
    const input = 'DATABASE_URL=postgres://localhost/db'
    const result = redactString(input)
    expect(result).toBe('DATABASE_URL=postgres://localhost/db')
  })

  it('should handle empty strings', () => {
    const result = redactString('')
    expect(result).toBe('')
  })

  it('should support custom patterns', () => {
    const input = 'CUSTOM_VALUE=sensitive'
    const customPatterns = [/CUSTOM/i]
    const result = redactString(input, customPatterns)
    expect(result).toBe('CUSTOM_VALUE=[REDACTED]')
  })
})

describe('isSensitiveKey', () => {
  it('should return true for API_KEY', () => {
    expect(isSensitiveKey('API_KEY')).toBe(true)
    expect(isSensitiveKey('api_key')).toBe(true)
    expect(isSensitiveKey('API-KEY')).toBe(true)
  })

  it('should return true for SECRET', () => {
    expect(isSensitiveKey('JWT_SECRET')).toBe(true)
    expect(isSensitiveKey('SESSION_SECRET')).toBe(true)
    expect(isSensitiveKey('secret')).toBe(true)
  })

  it('should return true for TOKEN', () => {
    expect(isSensitiveKey('ACCESS_TOKEN')).toBe(true)
    expect(isSensitiveKey('REFRESH_TOKEN')).toBe(true)
  })

  it('should return true for PASSWORD', () => {
    expect(isSensitiveKey('DATABASE_PASSWORD')).toBe(true)
    expect(isSensitiveKey('password')).toBe(true)
  })

  it('should return false for non-sensitive keys', () => {
    expect(isSensitiveKey('DATABASE_URL')).toBe(false)
    expect(isSensitiveKey('PORT')).toBe(false)
    expect(isSensitiveKey('DEBUG')).toBe(false)
  })

  it('should support custom patterns', () => {
    const customPatterns = [/CUSTOM/i]
    expect(isSensitiveKey('CUSTOM_VALUE', customPatterns)).toBe(true)
    expect(isSensitiveKey('NORMAL_VALUE', customPatterns)).toBe(false)
  })
})
