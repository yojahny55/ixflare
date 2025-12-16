import { describe, it, expect } from 'vitest'
import {
  DEFAULT_REDACT_FIELDS,
  DEFAULT_REDACT_PATTERNS,
  shouldRedactField,
  getRedactionPatterns,
} from '../../../src/security/secrets/patterns'

describe('DEFAULT_REDACT_FIELDS', () => {
  it('should include common password field names', () => {
    expect(DEFAULT_REDACT_FIELDS).toContain('password')
    expect(DEFAULT_REDACT_FIELDS).toContain('passwd')
    expect(DEFAULT_REDACT_FIELDS).toContain('pwd')
  })

  it('should include secret and token variants', () => {
    expect(DEFAULT_REDACT_FIELDS).toContain('secret')
    expect(DEFAULT_REDACT_FIELDS).toContain('token')
    expect(DEFAULT_REDACT_FIELDS).toContain('key')
    expect(DEFAULT_REDACT_FIELDS).toContain('apiKey')
    expect(DEFAULT_REDACT_FIELDS).toContain('api_key')
  })

  it('should include authorization fields', () => {
    expect(DEFAULT_REDACT_FIELDS).toContain('authorization')
    expect(DEFAULT_REDACT_FIELDS).toContain('auth')
    expect(DEFAULT_REDACT_FIELDS).toContain('bearer')
  })

  it('should include session fields', () => {
    expect(DEFAULT_REDACT_FIELDS).toContain('session')
    expect(DEFAULT_REDACT_FIELDS).toContain('sessionId')
    expect(DEFAULT_REDACT_FIELDS).toContain('sessionToken')
  })
})

describe('DEFAULT_REDACT_PATTERNS', () => {
  it('should match JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(jwt))
    expect(pattern).toBeDefined()
  })

  it('should match Stripe live secret keys', () => {
    const stripeKey = 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(stripeKey))
    expect(pattern).toBeDefined()
  })

  it('should match Stripe test secret keys', () => {
    const stripeKey = 'sk_test_51HvI9aB2C3D4E5F6G7H8I9J'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(stripeKey))
    expect(pattern).toBeDefined()
  })

  it('should match Stripe publishable keys', () => {
    const stripePubKey = 'pk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(stripePubKey))
    expect(pattern).toBeDefined()
  })

  it('should match AWS access key IDs', () => {
    const awsKey = 'AKIAIOSFODNN7EXAMPLE'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(awsKey))
    expect(pattern).toBeDefined()
  })

  it('should match GitHub tokens', () => {
    const ghToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(ghToken))
    expect(pattern).toBeDefined()
  })

  it('should match Bearer tokens', () => {
    const bearerToken = 'Bearer abc123def456ghi789jkl012mno345'
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(bearerToken))
    expect(pattern).toBeDefined()
  })

  it('should match Basic auth', () => {
    const basicAuth = 'Basic dXNlcjpwYXNzd29yZA=='
    const pattern = DEFAULT_REDACT_PATTERNS.find(p => p.test(basicAuth))
    expect(pattern).toBeDefined()
  })

  it('should NOT match regular text', () => {
    const text = 'This is just regular text without secrets'
    const hasMatch = DEFAULT_REDACT_PATTERNS.some(p => p.test(text))
    expect(hasMatch).toBe(false)
  })

  it('should NOT match short strings', () => {
    const shortString = 'abc123'
    const hasMatch = DEFAULT_REDACT_PATTERNS.some(p => p.test(shortString))
    expect(hasMatch).toBe(false)
  })

  it('should NOT match UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const hasMatch = DEFAULT_REDACT_PATTERNS.some(p => p.test(uuid))
    expect(hasMatch).toBe(false)
  })
})

describe('shouldRedactField', () => {
  it('should redact default password fields', () => {
    expect(shouldRedactField('password')).toBe(true)
    expect(shouldRedactField('userPassword')).toBe(true)
    expect(shouldRedactField('PASSWORD')).toBe(true)
  })

  it('should redact default token fields', () => {
    expect(shouldRedactField('token')).toBe(true)
    expect(shouldRedactField('accessToken')).toBe(true)
    expect(shouldRedactField('TOKEN')).toBe(true)
  })

  it('should redact default secret fields', () => {
    expect(shouldRedactField('secret')).toBe(true)
    expect(shouldRedactField('apiSecret')).toBe(true)
    expect(shouldRedactField('SECRET')).toBe(true)
  })

  it('should NOT redact non-sensitive fields', () => {
    expect(shouldRedactField('userId')).toBe(false)
    expect(shouldRedactField('email')).toBe(false)
    expect(shouldRedactField('name')).toBe(false)
  })

  it('should redact custom fields', () => {
    expect(shouldRedactField('internalId', ['internalId'])).toBe(true)
    expect(shouldRedactField('ssn', ['ssn'])).toBe(true)
  })

  it('should NOT redact whitelisted fields', () => {
    expect(shouldRedactField('password', [], ['password'])).toBe(false)
    expect(shouldRedactField('token', [], ['token'])).toBe(false)
  })

  it('should prioritize whitelist over default fields', () => {
    expect(shouldRedactField('userId', [], ['userId'])).toBe(false)
    expect(shouldRedactField('secret', [], ['secret'])).toBe(false)
  })

  it('should handle case-insensitive matching', () => {
    expect(shouldRedactField('PASSWORD')).toBe(true)
    expect(shouldRedactField('Token')).toBe(true)
    expect(shouldRedactField('SECRET')).toBe(true)
  })

  it('should match partial field names', () => {
    expect(shouldRedactField('userPassword')).toBe(true)
    expect(shouldRedactField('apiToken')).toBe(true)
    expect(shouldRedactField('clientSecret')).toBe(true)
  })

  it('should NOT match words that contain sensitive keywords', () => {
    // "description" contains "key" but shouldn't be redacted
    expect(shouldRedactField('description')).toBe(false)
    // This is a false positive case - handled by being specific with field names
  })
})

describe('getRedactionPatterns', () => {
  it('should return default patterns when no custom patterns provided', () => {
    const patterns = getRedactionPatterns()
    expect(patterns).toEqual(DEFAULT_REDACT_PATTERNS)
  })

  it('should combine default and custom patterns', () => {
    const customPattern = /custom-pattern/g
    const patterns = getRedactionPatterns([customPattern])
    expect(patterns).toHaveLength(DEFAULT_REDACT_PATTERNS.length + 1)
    expect(patterns).toContain(customPattern)
  })

  it('should preserve default patterns when adding custom', () => {
    const customPattern = /custom-pattern/g
    const patterns = getRedactionPatterns([customPattern])
    DEFAULT_REDACT_PATTERNS.forEach(defaultPattern => {
      expect(patterns).toContain(defaultPattern)
    })
  })

  it('should handle multiple custom patterns', () => {
    const custom1 = /pattern1/g
    const custom2 = /pattern2/g
    const patterns = getRedactionPatterns([custom1, custom2])
    expect(patterns).toContain(custom1)
    expect(patterns).toContain(custom2)
  })
})
