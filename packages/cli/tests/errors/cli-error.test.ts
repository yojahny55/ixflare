/**
 * Tests for CLIError base class
 */

import { describe, it, expect } from 'vitest'
import { CLIError, isCLIError } from '@/errors/cli-error'

describe('CLIError', () => {
  it('should create error with required fields', () => {
    const error = new CLIError({
      code: 'IX_E101',
      message: 'Test error',
    })

    expect(error.code).toBe('IX_E101')
    expect(error.message).toBe('Test error')
    expect(error.name).toBe('CLIError')
    expect(error.severity).toBe('error') // default
    expect(error.causes).toEqual([])
    expect(error.fixes).toEqual([])
  })

  it('should create error with all fields', () => {
    const error = new CLIError({
      code: 'IX_E102',
      message: 'Configuration missing',
      causes: ['File not found', 'Invalid path'],
      fixes: ['Create config file', 'Check path'],
      docsUrl: 'https://ixflare.dev/errors/IX_E102',
      severity: 'warning',
      sourceLocation: {
        file: 'edge.config.ts',
        line: 10,
        column: 5,
      },
    })

    expect(error.code).toBe('IX_E102')
    expect(error.message).toBe('Configuration missing')
    expect(error.causes).toEqual(['File not found', 'Invalid path'])
    expect(error.fixes).toEqual(['Create config file', 'Check path'])
    expect(error.docsUrl).toBe('https://ixflare.dev/errors/IX_E102')
    expect(error.severity).toBe('warning')
    expect(error.sourceLocation).toEqual({
      file: 'edge.config.ts',
      line: 10,
      column: 5,
    })
  })

  it('should maintain proper stack trace', () => {
    const error = new CLIError({
      code: 'IX_E103',
      message: 'Test error',
    })

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('CLIError')
  })

  it('should convert to JSON', () => {
    const error = new CLIError({
      code: 'IX_E104',
      message: 'Test error',
      causes: ['Cause 1'],
      fixes: ['Fix 1'],
    })

    const json = error.toJSON()

    expect(json).toMatchObject({
      name: 'CLIError',
      code: 'IX_E104',
      message: 'Test error',
      causes: ['Cause 1'],
      fixes: ['Fix 1'],
      severity: 'error',
    })
    expect(json.stack).toBeDefined()
  })

  it('should wrap original error', () => {
    const originalError = new Error('Original error message')
    const error = new CLIError({
      code: 'IX_E901',
      message: 'Wrapped error',
      originalError,
    })

    expect(error.originalError).toBe(originalError)
    expect(error.originalError?.message).toBe('Original error message')
  })
})

describe('isCLIError', () => {
  it('should return true for CLIError instances', () => {
    const error = new CLIError({
      code: 'IX_E101',
      message: 'Test',
    })

    expect(isCLIError(error)).toBe(true)
  })

  it('should return false for regular Error', () => {
    const error = new Error('Regular error')
    expect(isCLIError(error)).toBe(false)
  })

  it('should return false for non-error values', () => {
    expect(isCLIError(null)).toBe(false)
    expect(isCLIError(undefined)).toBe(false)
    expect(isCLIError('error')).toBe(false)
    expect(isCLIError({})).toBe(false)
  })
})
