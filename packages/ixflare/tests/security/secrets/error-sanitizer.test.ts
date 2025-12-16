import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  sanitizeError,
  sanitizeFetchError,
  createSafeError,
} from '../../../src/security/secrets/error-sanitizer'
import { getSecretTracker, resetGlobalTracker } from '../../../src/security/secrets/tracker'

describe('sanitizeError', () => {
  afterEach(() => {
    resetGlobalTracker()
  })

  it('should sanitize Error messages', () => {
    const error = new Error('API key is sk_live_51HvI9aB2C3D4E5F6G7H8I9J')
    const result = sanitizeError(error)

    expect(result).toHaveProperty('message')
    const sanitized = result as { message: string }
    expect(sanitized.message).toContain('[REDACTED]')
    expect(sanitized.message).not.toContain('sk_live_')
  })

  it('should sanitize stack traces', () => {
    const error = new Error('Failed')
    error.stack = `Error: Failed to auth with key sk_live_51HvI9aB2C3D4E5F6G7H8I9J\n  at test.ts:10`

    const result = sanitizeError(error) as { stack: string }
    expect(result.stack).toContain('[REDACTED]')
    expect(result.stack).not.toContain('sk_live_')
  })

  it('should preserve error name', () => {
    const error = new TypeError('Invalid token sk_live_51HvI9aB2C3D4E5F6G7H8I9J')
    const result = sanitizeError(error) as { name: string }

    expect(result.name).toBe('TypeError')
  })

  it('should sanitize custom error properties', () => {
    const error = new Error('Failed') as Error & { apiKey: string; userId: string }
    error.apiKey = 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    error.userId = '12345'

    const result = sanitizeError(error) as Record<string, unknown>

    expect(result.apiKey).toContain('[REDACTED]')
    expect(result.userId).toBe('12345')
  })

  it('should sanitize nested objects in errors', () => {
    const error = new Error('Failed') as Error & {
      context: { token: string; user: string }
    }
    error.context = {
      token: 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
      user: 'john',
    }

    const result = sanitizeError(error) as { context: Record<string, unknown> }

    expect(result.context.token).toContain('[REDACTED]')
    expect(result.context.user).toBe('john')
  })

  it('should handle non-Error objects', () => {
    const errorObj = {
      message: 'Failed with key sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
      code: 'AUTH_ERROR',
    }

    const result = sanitizeError(errorObj) as Record<string, unknown>

    expect(result.message).toContain('[REDACTED]')
    expect(result.code).toBe('AUTH_ERROR')
  })

  it('should handle string errors', () => {
    const error = 'Error: Invalid key sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const result = sanitizeError(error)

    expect(typeof result).toBe('string')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('sk_live_')
  })

  it('should handle primitive errors', () => {
    expect(sanitizeError(null)).toBe(null)
    expect(sanitizeError(undefined)).toBe(undefined)
    expect(sanitizeError(123)).toBe(123)
    expect(sanitizeError(true)).toBe(true)
  })

  it('should use tracker-based redaction', () => {
    const tracker = getSecretTracker()
    tracker.track('CUSTOM_SECRET', 'my_secret_value_123')

    const error = new Error('Failed with secret: my_secret_value_123')
    const result = sanitizeError(error) as { message: string }

    expect(result.message).toContain('[REDACTED:CUSTOM_SECRET]')
    expect(result.message).not.toContain('my_secret_value_123')
  })

  it('should respect custom redaction config', () => {
    const error = new Error('SSN: 123-45-6789')
    const result = sanitizeError(error, {
      patterns: [/\b\d{3}-\d{2}-\d{4}\b/g],
    }) as { message: string }

    expect(result.message).toContain('[REDACTED]')
    expect(result.message).not.toContain('123-45-6789')
  })
})

describe('sanitizeFetchError', () => {
  it('should sanitize basic fetch errors', () => {
    const error = new Error('Fetch failed') as Error & {
      url: string
      headers: Record<string, string>
    }
    error.url = 'https://api.stripe.com?key=sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    error.headers = {
      Authorization: 'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
      'Content-Type': 'application/json',
    }

    const result = sanitizeFetchError(error) as {
      url: string
      headers: Record<string, string>
    }

    expect(result.url).toContain('[REDACTED]')
    expect(result.url).not.toContain('sk_live_')

    expect(result.headers.Authorization).toContain('[REDACTED]')
    expect(result.headers['Content-Type']).toBe('application/json')
  })

  it('should sanitize request details', () => {
    const error = new Error('Request failed') as Error & {
      request: { headers: { authorization: string } }
    }
    error.request = {
      headers: {
        authorization: 'Bearer sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
      },
    }

    const result = sanitizeFetchError(error) as {
      request: { headers: { authorization: string } }
    }

    expect(result.request.headers.authorization).toContain('[REDACTED]')
  })

  it('should sanitize response details', () => {
    const error = new Error('Response error') as Error & {
      response: { data: { apiKey: string; message: string } }
    }
    error.response = {
      data: {
        apiKey: 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
        message: 'Invalid request',
      },
    }

    const result = sanitizeFetchError(error) as {
      response: { data: { apiKey: string; message: string } }
    }

    expect(result.response.data.apiKey).toContain('[REDACTED]')
    expect(result.response.data.message).toBe('Invalid request')
  })

  it('should handle errors without fetch-specific properties', () => {
    const error = new Error('Generic error')
    const result = sanitizeFetchError(error)

    expect(result).toHaveProperty('message', 'Generic error')
  })
})

describe('createSafeError', () => {
  afterEach(() => {
    resetGlobalTracker()
  })

  it('should create safe error without stack trace', () => {
    const error = new Error('Sensitive error sk_live_51HvI9aB2C3D4E5F6G7H8I9J')
    error.stack = 'Error: ...\n  at test.ts:10'

    const result = createSafeError(error)

    expect(result).toHaveProperty('name', 'Error')
    expect(result.message).toContain('[REDACTED]')
    expect(result).not.toHaveProperty('stack')
  })

  it('should preserve custom properties except stack', () => {
    const error = new Error('Failed') as Error & {
      code: string
      timestamp: number
    }
    error.code = 'AUTH_ERROR'
    error.timestamp = 1733311800000

    const result = createSafeError(error)

    expect(result.name).toBe('Error')
    expect(result.message).toBe('Failed')
    expect(result.code).toBe('AUTH_ERROR')
    expect(result.timestamp).toBe(1733311800000)
    expect(result).not.toHaveProperty('stack')
  })

  it('should sanitize custom properties', () => {
    const error = new Error('Failed') as Error & { apiKey: string }
    error.apiKey = 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J'

    const result = createSafeError(error)

    expect(result.apiKey).toContain('[REDACTED]')
  })

  it('should handle non-Error objects', () => {
    const errorObj = {
      type: 'ValidationError',
      details: 'Invalid token sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
    }

    const result = createSafeError(errorObj)

    expect(result.name).toBe('Error')
    // When passing a non-Error object, the message becomes "Unknown error"
    expect(result.message).toBe('Unknown error')
  })

  it('should handle string errors', () => {
    const error = 'Something went wrong with key sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    const result = createSafeError(error)

    expect(result.name).toBe('Error')
    expect(result.message).toContain('[REDACTED]')
    expect(result.message).not.toContain('sk_live_')
  })

  it('should handle null/undefined', () => {
    expect(createSafeError(null)).toEqual({
      name: 'Error',
      message: 'null',
    })

    expect(createSafeError(undefined)).toEqual({
      name: 'Error',
      message: 'undefined',
    })
  })

  it('should use tracker redaction', () => {
    const tracker = getSecretTracker()
    tracker.track('DB_PASSWORD', 'super_secret_pass')

    const error = new Error('Database connection failed: super_secret_pass')
    const result = createSafeError(error)

    expect(result.message).toContain('[REDACTED:DB_PASSWORD]')
    expect(result.message).not.toContain('super_secret_pass')
  })
})

describe('integration: error sanitization with various secret types', () => {
  afterEach(() => {
    resetGlobalTracker()
  })

  it('should sanitize JWT tokens in errors', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const error = new Error(`Invalid token: ${jwt}`)

    const result = sanitizeError(error) as { message: string }

    expect(result.message).toContain('[REDACTED]')
    expect(result.message).not.toContain('eyJ')
  })

  it('should sanitize multiple secret types in one error', () => {
    const error = new Error(
      'Auth failed: API key sk_live_51HvI9aB2C3D4E5F6G7H8I9J and JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig'
    )

    const result = sanitizeError(error) as { message: string }

    expect(result.message).toContain('[REDACTED]')
    expect(result.message).not.toContain('sk_live_')
    expect(result.message).not.toContain('eyJ')
  })

  it('should sanitize tracked secrets and patterns together', () => {
    const tracker = getSecretTracker()
    tracker.track('DATABASE_URL', 'postgres://user:pass@localhost/db')

    const error = new Error(
      'Connection failed: postgres://user:pass@localhost/db with key sk_live_51HvI9aB2C3D4E5F6G7H8I9J'
    )

    const result = sanitizeError(error) as { message: string }

    expect(result.message).toContain('[REDACTED:DATABASE_URL]')
    expect(result.message).toContain('[REDACTED]') // For the Stripe key
    expect(result.message).not.toContain('postgres://user:pass')
    expect(result.message).not.toContain('sk_live_')
  })
})
