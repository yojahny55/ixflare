import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { formatConfigError, createConfigError, ConfigError } from '../../src/config/errors'
import { configSchema } from '../../src/config/schema'

describe('ConfigError', () => {
  it('should create error with message', () => {
    const error = new ConfigError('Test error')

    expect(error.message).toBe('Test error')
    expect(error.name).toBe('ConfigError')
    expect(error.issues).toEqual([])
  })

  it('should create error with issues', () => {
    const issues = [{ path: 'name', message: 'Required' }]
    const error = new ConfigError('Test error', issues)

    expect(error.issues).toEqual(issues)
  })

  it('should create error with file path', () => {
    const error = new ConfigError('Test error', [], '/path/to/config.ts')

    expect(error.filePath).toBe('/path/to/config.ts')
  })
})

describe('formatConfigError', () => {
  it('should format single validation error', () => {
    const result = configSchema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatConfigError(result.error)

      expect(formatted).toContain('Invalid edge.config.ts configuration')
      expect(formatted).toContain('name')
      expect(formatted).toContain('https://ixflare.dev/docs/configuration')
    }
  })

  it('should include file path when provided', () => {
    const result = configSchema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatConfigError(result.error, '/project/edge.config.ts')

      expect(formatted).toContain('in /project/edge.config.ts')
    }
  })

  it('should format multiple validation errors', () => {
    const result = configSchema.safeParse({
      name: '',
      cache: { defaultTtl: -1 },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatConfigError(result.error)

      // Should contain info about both errors
      expect(formatted).toContain('name')
    }
  })

  it('should include fix suggestions for known fields', () => {
    const result = configSchema.safeParse({
      name: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatConfigError(result.error)

      expect(formatted).toContain('Fix:')
      expect(formatted).toContain('non-empty string')
    }
  })

  it('should format type mismatch errors clearly', () => {
    const result = configSchema.safeParse({
      name: 123, // Should be string
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatConfigError(result.error)

      expect(formatted).toContain('name')
    }
  })

  it('should format nested path errors', () => {
    const result = configSchema.safeParse({
      name: 'test',
      database: {
        binding: '', // Invalid
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatConfigError(result.error)

      expect(formatted).toContain('database.binding')
    }
  })
})

describe('createConfigError', () => {
  it('should create ConfigError from Zod error', () => {
    const result = configSchema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      const error = createConfigError(result.error)

      expect(error).toBeInstanceOf(ConfigError)
      expect(error.issues.length).toBeGreaterThan(0)
    }
  })

  it('should include file path in ConfigError', () => {
    const result = configSchema.safeParse({})

    expect(result.success).toBe(false)
    if (!result.success) {
      const error = createConfigError(result.error, '/path/to/config.ts')

      expect(error.filePath).toBe('/path/to/config.ts')
      expect(error.message).toContain('/path/to/config.ts')
    }
  })

  it('should extract path from nested errors', () => {
    const result = configSchema.safeParse({
      name: 'test',
      cache: {
        defaultTtl: 'not-a-number',
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const error = createConfigError(result.error)

      const ttlIssue = error.issues.find((i) => i.path.includes('defaultTtl'))
      expect(ttlIssue).toBeDefined()
    }
  })

  it('should handle too_small validation errors', () => {
    const result = configSchema.safeParse({
      name: '', // Too small (min 1)
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const error = createConfigError(result.error)

      expect(
        error.issues.some(
          (i) =>
            i.message.toLowerCase().includes('at least') ||
            i.message.toLowerCase().includes('required')
        )
      ).toBe(true)
    }
  })

  it('should handle too_big validation errors', () => {
    const result = configSchema.safeParse({
      name: 'a'.repeat(101), // Too big (max 100)
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const error = createConfigError(result.error)

      expect(
        error.issues.some(
          (i) =>
            i.message.toLowerCase().includes('at most') || i.message.toLowerCase().includes('100')
        )
      ).toBe(true)
    }
  })
})
