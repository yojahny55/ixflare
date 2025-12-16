import { describe, it, expect } from 'vitest'
import {
  redactValue,
  redactString,
  redactObject,
  redactConsoleArgs,
} from '../../../src/security/secrets/redactor'
import { DEFAULT_REDACT_PATTERNS } from '../../../src/security/secrets/patterns'

describe('redactString', () => {
  it('should redact JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const result = redactString(jwt, DEFAULT_REDACT_PATTERNS)
    expect(result).toBe('[REDACTED]')
  })

  it('should redact Stripe secret keys', () => {
    const input = 'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const result = redactString(input, DEFAULT_REDACT_PATTERNS)
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('sk_live_')
  })

  it('should redact multiple secrets in one string', () => {
    const input = 'API Key: sk_live_51HvI9aB2C3D4E5F6G7H8I9J and JWT: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature'
    const result = redactString(input, DEFAULT_REDACT_PATTERNS)
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('sk_live_')
    expect(result).not.toContain('eyJhbGci')
  })

  it('should preserve non-secret content', () => {
    const input = 'User logged in at 2025-12-16'
    const result = redactString(input, DEFAULT_REDACT_PATTERNS)
    expect(result).toBe(input)
  })

  it('should use custom placeholder', () => {
    const input = 'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const result = redactString(input, DEFAULT_REDACT_PATTERNS, '[SECRET]')
    expect(result).toContain('[SECRET]')
    expect(result).not.toContain('[REDACTED]')
  })

  it('should handle empty strings', () => {
    const result = redactString('', DEFAULT_REDACT_PATTERNS)
    expect(result).toBe('')
  })

  it('should handle strings with no matches', () => {
    const input = 'This is a normal string'
    const result = redactString(input, DEFAULT_REDACT_PATTERNS)
    expect(result).toBe(input)
  })
})

describe('redactObject', () => {
  it('should redact password field', () => {
    const input = { username: 'john', password: 'secret123' }
    const result = redactObject(input)
    expect(result).toEqual({
      username: 'john',
      password: '[REDACTED]',
    })
  })

  it('should redact token field', () => {
    const input = { userId: '123', accessToken: 'abc123xyz789' }
    const result = redactObject(input)
    expect(result).toEqual({
      userId: '123',
      accessToken: '[REDACTED]',
    })
  })

  it('should redact multiple sensitive fields', () => {
    const input = {
      email: 'user@example.com',
      password: 'secret',
      apiKey: 'key123',
      token: 'token456',
    }
    const result = redactObject(input)
    expect(result).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      token: '[REDACTED]',
    })
  })

  it('should redact nested objects', () => {
    const input = {
      user: {
        name: 'John',
        auth: {
          password: 'secret',
          apiKey: 'key123',
        },
      },
    }
    const result = redactObject(input)
    // "auth" is a sensitive field, so the whole value gets redacted
    expect(result.user.name).toBe('John')
    expect(result.user.auth).toBe('[REDACTED]')
  })

  it('should redact arrays', () => {
    const input = {
      users: [
        { name: 'John', password: 'secret1' },
        { name: 'Jane', password: 'secret2' },
      ],
    }
    const result = redactObject(input)
    expect(result.users).toEqual([
      { name: 'John', password: '[REDACTED]' },
      { name: 'Jane', password: '[REDACTED]' },
    ])
  })

  it('should redact pattern matches in string values', () => {
    const input = {
      message: 'Error with token: sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
    }
    const result = redactObject(input)
    expect(result.message).toContain('[REDACTED]')
    expect(result.message).not.toContain('sk_live_')
  })

  it('should respect whitelist', () => {
    const input = {
      userId: '123',
      password: 'secret',
      token: 'abc123',
    }
    const result = redactObject(input, {
      whitelist: ['token'],
    })
    expect(result).toEqual({
      userId: '123',
      password: '[REDACTED]',
      token: 'abc123', // Not redacted due to whitelist
    })
  })

  it('should handle custom fields', () => {
    const input = {
      ssn: '123-45-6789',
      creditCard: '4111111111111111',
      name: 'John',
    }
    const result = redactObject(input, {
      fields: ['ssn', 'creditCard'],
    })
    expect(result).toEqual({
      ssn: '[REDACTED]',
      creditCard: '[REDACTED]',
      name: 'John',
    })
  })

  it('should use custom placeholder', () => {
    const input = { password: 'secret' }
    const result = redactObject(input, { placeholder: '[HIDDEN]' })
    expect(result.password).toBe('[HIDDEN]')
  })

  it('should preserve null values in sensitive fields', () => {
    const input = { name: 'John', password: null }
    const result = redactObject(input)
    expect(result).toEqual({ name: 'John', password: null })
  })

  it('should preserve undefined values in sensitive fields', () => {
    const input = { name: 'John', password: undefined }
    const result = redactObject(input)
    expect(result).toEqual({ name: 'John', password: undefined })
  })

  it('should handle mixed types', () => {
    const input = {
      id: 123,
      active: true,
      password: 'secret',
      created: 1733311800000,
    }
    const result = redactObject(input)
    expect(result).toEqual({
      id: 123,
      active: true,
      password: '[REDACTED]',
      created: 1733311800000,
    })
  })

  it('should handle empty objects', () => {
    const result = redactObject({})
    expect(result).toEqual({})
  })

  it('should handle deeply nested structures', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            password: 'secret',
            data: 'public',
          },
        },
      },
    }
    const result = redactObject(input)
    expect(result.level1.level2.level3.password).toBe('[REDACTED]')
    expect(result.level1.level2.level3.data).toBe('public')
  })

  it('should NOT redact fields with sensitive keywords in innocent context', () => {
    const input = {
      description: 'This is a password reset email',
      keywordList: ['secret', 'token'],
    }
    const result = redactObject(input)
    // "description" should not be redacted just because it contains "key"
    expect(result.description).toBe('This is a password reset email')
  })
})

describe('redactValue', () => {
  it('should handle strings', () => {
    const input = 'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const result = redactValue(input)
    expect(typeof result).toBe('string')
    expect(result).toContain('[REDACTED]')
  })

  it('should handle objects', () => {
    const input = { password: 'secret' }
    const result = redactValue(input)
    expect(result).toEqual({ password: '[REDACTED]' })
  })

  it('should handle arrays', () => {
    const input = [
      { password: 'secret1' },
      { password: 'secret2' },
    ]
    const result = redactValue(input)
    expect(result).toEqual([
      { password: '[REDACTED]' },
      { password: '[REDACTED]' },
    ])
  })

  it('should handle null', () => {
    const result = redactValue(null)
    expect(result).toBe(null)
  })

  it('should handle undefined', () => {
    const result = redactValue(undefined)
    expect(result).toBe(undefined)
  })

  it('should handle numbers', () => {
    const result = redactValue(12345)
    expect(result).toBe(12345)
  })

  it('should handle booleans', () => {
    expect(redactValue(true)).toBe(true)
    expect(redactValue(false)).toBe(false)
  })

  it('should handle mixed arrays', () => {
    const input = ['text', 123, { password: 'secret' }, null]
    const result = redactValue(input)
    expect(result).toEqual(['text', 123, { password: '[REDACTED]' }, null])
  })
})

describe('redactConsoleArgs', () => {
  it('should redact all arguments', () => {
    const args = [
      'User authenticated',
      { userId: '123', token: 'secret' },
      'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
    ]
    const result = redactConsoleArgs(args)
    expect(result[0]).toBe('User authenticated')
    expect(result[1]).toEqual({ userId: '123', token: '[REDACTED]' })
    expect(result[2]).toContain('[REDACTED]')
  })

  it('should handle empty array', () => {
    const result = redactConsoleArgs([])
    expect(result).toEqual([])
  })

  it('should preserve argument order', () => {
    const args = ['first', 'second', 'third']
    const result = redactConsoleArgs(args)
    expect(result).toEqual(args)
  })

  it('should handle mixed primitive types', () => {
    const args = ['string', 123, true, null, undefined]
    const result = redactConsoleArgs(args)
    expect(result).toEqual(args)
  })
})

describe('redaction accuracy (security critical)', () => {
  it('should NOT have false positives on common data', () => {
    const input = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      requestId: 'req_abc123',
      email: 'user@example.com',
      timestamp: 1733311800000,
      description: 'Password reset requested',
    }
    const result = redactObject(input)
    // None of these should be redacted
    expect(result.userId).toBe(input.userId)
    expect(result.requestId).toBe(input.requestId)
    expect(result.email).toBe(input.email)
    expect(result.timestamp).toBe(input.timestamp)
  })

  it('should catch common secret formats', () => {
    const secretFormats = [
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig',
      'sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
      'pk_test_51HvI9aB2C3D4E5F6G7H8I9J',
      'AKIAIOSFODNN7EXAMPLE',
      'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
    ]

    secretFormats.forEach(secret => {
      const result = redactString(secret, DEFAULT_REDACT_PATTERNS)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toBe(secret)
    })
  })

  it('should handle edge case: empty secret value', () => {
    const input = { password: '' }
    const result = redactObject(input)
    expect(result.password).toBe('[REDACTED]')
  })

  it('should handle edge case: secret in array in object', () => {
    const input = {
      headers: [
        { name: 'Authorization', value: 'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J' },
        { name: 'Content-Type', value: 'application/json' },
      ],
    }
    const result = redactObject(input)
    expect(result.headers[0].value).toContain('[REDACTED]')
    expect(result.headers[1].value).toBe('application/json')
  })
})
