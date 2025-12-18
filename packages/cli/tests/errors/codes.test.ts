/**
 * Tests for error code registry
 */

import { describe, it, expect } from 'vitest'
import {
  ERROR_CODES,
  ERROR_DOCS_BASE_URL,
  getErrorMeta,
  getErrorDocsUrl,
  isValidErrorCode,
  getErrorCodesByCategory,
} from '@/errors/codes'

describe('ERROR_CODES', () => {
  it('should have configuration errors (IX_E1XX)', () => {
    expect(ERROR_CODES.IX_E101).toBeDefined()
    expect(ERROR_CODES.IX_E101.category).toBe('config')
    expect(ERROR_CODES.IX_E102).toBeDefined()
  })

  it('should have build errors (IX_E2XX)', () => {
    expect(ERROR_CODES.IX_E201).toBeDefined()
    expect(ERROR_CODES.IX_E201.category).toBe('build')
    expect(ERROR_CODES.IX_E202).toBeDefined()
  })

  it('should have deployment errors (IX_E3XX)', () => {
    expect(ERROR_CODES.IX_E301).toBeDefined()
    expect(ERROR_CODES.IX_E301.category).toBe('deploy')
    expect(ERROR_CODES.IX_E302).toBeDefined()
  })

  it('should have database errors (IX_E4XX)', () => {
    expect(ERROR_CODES.IX_E401).toBeDefined()
    expect(ERROR_CODES.IX_E401.category).toBe('database')
    expect(ERROR_CODES.IX_E402).toBeDefined()
  })

  it('should have authentication errors (IX_E5XX)', () => {
    expect(ERROR_CODES.IX_E501).toBeDefined()
    expect(ERROR_CODES.IX_E501.category).toBe('auth')
  })

  it('should have internal errors (IX_E9XX)', () => {
    expect(ERROR_CODES.IX_E901).toBeDefined()
    expect(ERROR_CODES.IX_E901.category).toBe('internal')
  })

  it('should have title and docsPath for all codes', () => {
    for (const [code, meta] of Object.entries(ERROR_CODES)) {
      expect(meta.title).toBeTruthy()
      expect(meta.docsPath).toMatch(/^\/errors\//)
      expect(meta.category).toBeTruthy()
      expect(meta.docsPath).toContain(code)
    }
  })
})

describe('getErrorMeta', () => {
  it('should return metadata for valid code', () => {
    const meta = getErrorMeta('IX_E101')

    expect(meta).toBeDefined()
    expect(meta?.category).toBe('config')
    expect(meta?.title).toBeTruthy()
  })

  it('should return undefined for invalid code', () => {
    const meta = getErrorMeta('INVALID_CODE')
    expect(meta).toBeUndefined()
  })
})

describe('getErrorDocsUrl', () => {
  it('should return full URL for valid code', () => {
    const url = getErrorDocsUrl('IX_E101')

    expect(url).toBe(`${ERROR_DOCS_BASE_URL}/errors/IX_E101`)
  })

  it('should return undefined for invalid code', () => {
    const url = getErrorDocsUrl('INVALID_CODE')
    expect(url).toBeUndefined()
  })
})

describe('isValidErrorCode', () => {
  it('should return true for valid codes', () => {
    expect(isValidErrorCode('IX_E101')).toBe(true)
    expect(isValidErrorCode('IX_E201')).toBe(true)
    expect(isValidErrorCode('IX_E301')).toBe(true)
    expect(isValidErrorCode('IX_E401')).toBe(true)
    expect(isValidErrorCode('IX_E501')).toBe(true)
    expect(isValidErrorCode('IX_E901')).toBe(true)
  })

  it('should return false for invalid codes', () => {
    expect(isValidErrorCode('INVALID')).toBe(false)
    expect(isValidErrorCode('IX_E999')).toBe(false)
    expect(isValidErrorCode('E101')).toBe(false)
    expect(isValidErrorCode('')).toBe(false)
  })
})

describe('getErrorCodesByCategory', () => {
  it('should return config error codes', () => {
    const codes = getErrorCodesByCategory('config')

    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('IX_E101')
    expect(codes).toContain('IX_E102')
    expect(codes.every((code) => code.startsWith('IX_E1'))).toBe(true)
  })

  it('should return build error codes', () => {
    const codes = getErrorCodesByCategory('build')

    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('IX_E201')
    expect(codes.every((code) => code.startsWith('IX_E2'))).toBe(true)
  })

  it('should return deploy error codes', () => {
    const codes = getErrorCodesByCategory('deploy')

    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('IX_E301')
    expect(codes.every((code) => code.startsWith('IX_E3'))).toBe(true)
  })

  it('should return database error codes', () => {
    const codes = getErrorCodesByCategory('database')

    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('IX_E401')
    expect(codes.every((code) => code.startsWith('IX_E4'))).toBe(true)
  })

  it('should return auth error codes', () => {
    const codes = getErrorCodesByCategory('auth')

    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('IX_E501')
    expect(codes.every((code) => code.startsWith('IX_E5'))).toBe(true)
  })

  it('should return internal error codes', () => {
    const codes = getErrorCodesByCategory('internal')

    expect(codes.length).toBeGreaterThan(0)
    expect(codes).toContain('IX_E901')
    expect(codes.every((code) => code.startsWith('IX_E9'))).toBe(true)
  })

  it('should return empty array for unknown category', () => {
    const codes = getErrorCodesByCategory('unknown')
    expect(codes).toEqual([])
  })
})
