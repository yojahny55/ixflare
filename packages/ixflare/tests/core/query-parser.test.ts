/**
 * @fileoverview Tests for query parameter parsing utilities
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseQuery } from '@/core/query-parser'
import { ValidationError } from '@/errors'

describe('parseQuery', () => {
  // ========================================================================
  // Basic Query Parsing Tests
  // ========================================================================

  it('should parse basic query parameters with Zod coercion', () => {
    const schema = z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    })

    const request = new Request('https://example.com/api/users?page=2&limit=10')
    const query = parseQuery(request, schema)

    expect(query).toEqual({ page: 2, limit: 10 })
  })

  it('should apply default values when parameters are missing', () => {
    const schema = z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    })

    const request = new Request('https://example.com/api/users')
    const query = parseQuery(request, schema)

    expect(query).toEqual({ page: 1, limit: 20 })
  })

  it('should handle empty query string', () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
    })

    const request = new Request('https://example.com/api/users?')
    const query = parseQuery(request, schema)

    expect(query).toEqual({ page: 1 })
  })

  // ========================================================================
  // Zod Coercion Tests
  // ========================================================================

  it('should coerce string to number using z.coerce.number()', () => {
    const schema = z.object({
      page: z.coerce.number(),
    })

    const request = new Request('https://example.com?page=42')
    const query = parseQuery(request, schema)

    expect(query.page).toBe(42)
    expect(typeof query.page).toBe('number')
  })

  it('should handle decimal numbers with coercion', () => {
    const schema = z.object({
      price: z.coerce.number(),
    })

    const request = new Request('https://example.com?price=19.99')
    const query = parseQuery(request, schema)

    expect(query.price).toBe(19.99)
  })

  it('should validate coerced numbers against constraints', () => {
    const schema = z.object({
      page: z.coerce.number().positive(),
    })

    const request = new Request('https://example.com?page=-5')

    expect(() => parseQuery(request, schema)).toThrow(ValidationError)
    expect(() => parseQuery(request, schema)).toThrow('Query parameter validation failed')
  })

  // ========================================================================
  // Enum Validation Tests
  // ========================================================================

  it('should validate enum values correctly', () => {
    const schema = z.object({
      sort: z.enum(['name', 'createdAt', 'email']),
    })

    const request = new Request('https://example.com?sort=name')
    const query = parseQuery(request, schema)

    expect(query.sort).toBe('name')
  })

  it('should throw ValidationError for invalid enum value', () => {
    const schema = z.object({
      sort: z.enum(['name', 'createdAt', 'email']),
    })

    const request = new Request('https://example.com?sort=invalid')

    expect(() => parseQuery(request, schema)).toThrow(ValidationError)
  })

  it('should handle optional enum parameters', () => {
    const schema = z.object({
      sort: z.enum(['name', 'createdAt', 'email']).optional(),
    })

    const request = new Request('https://example.com')
    const query = parseQuery(request, schema)

    expect(query.sort).toBeUndefined()
  })

  // ========================================================================
  // Optional Parameters Tests
  // ========================================================================

  it('should handle optional parameters correctly', () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
      filter: z.string().optional(),
    })

    const request = new Request('https://example.com?page=2')
    const query = parseQuery(request, schema)

    expect(query).toEqual({ page: 2, filter: undefined })
  })

  it('should include optional parameters when provided', () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
      filter: z.string().optional(),
    })

    const request = new Request('https://example.com?page=2&filter=active')
    const query = parseQuery(request, schema)

    expect(query).toEqual({ page: 2, filter: 'active' })
  })

  // ========================================================================
  // Multiple Values Support Tests (AC3)
  // ========================================================================

  it('should handle multiple values with same key as array', () => {
    const schema = z.object({
      id: z.array(z.string()),
    })

    const request = new Request('https://example.com?id=1&id=2&id=3')
    const query = parseQuery(request, schema)

    expect(query.id).toEqual(['1', '2', '3'])
    expect(Array.isArray(query.id)).toBe(true)
  })

  it('should coerce array of strings to numbers', () => {
    const schema = z.object({
      ids: z.preprocess(
        v => (Array.isArray(v) ? v : [v]),
        z.array(z.coerce.number())
      ),
    })

    const request = new Request('https://example.com?ids=1&ids=2&ids=3')
    const query = parseQuery(request, schema)

    expect(query.ids).toEqual([1, 2, 3])
  })

  it('should handle single value when schema expects array', () => {
    const schema = z.object({
      tags: z.preprocess(
        v => (Array.isArray(v) ? v : v ? [v] : []),
        z.array(z.string())
      ),
    })

    const request = new Request('https://example.com?tags=javascript')
    const query = parseQuery(request, schema)

    expect(query.tags).toEqual(['javascript'])
  })

  // ========================================================================
  // Validation Error Tests
  // ========================================================================

  it('should throw ValidationError with field-level errors', () => {
    const schema = z.object({
      page: z.coerce.number().positive(),
      email: z.string().email(),
    })

    const request = new Request('https://example.com?page=abc&email=invalid')

    try {
      parseQuery(request, schema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).message).toBe('Query parameter validation failed')
      expect((error as ValidationError).errors).toBeDefined()
      expect((error as ValidationError).errors.length).toBeGreaterThan(0)
    }
  })

  it('should format validation errors matching body-parser pattern', () => {
    const schema = z.object({
      page: z.coerce.number().positive(),
    })

    const request = new Request('https://example.com?page=-1')

    try {
      parseQuery(request, schema)
      expect.fail('Should have thrown ValidationError')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.errors).toBeInstanceOf(Array)
      expect(validationError.errors[0]).toHaveProperty('field')
      expect(validationError.errors[0]).toHaveProperty('message')
      expect(validationError.errors[0].field).toBe('page')
    }
  })

  it('should handle missing required parameter', () => {
    const schema = z.object({
      id: z.string(),
    })

    const request = new Request('https://example.com')

    expect(() => parseQuery(request, schema)).toThrow(ValidationError)
  })

  // ========================================================================
  // Edge Cases Tests
  // ========================================================================

  it('should handle empty string values', () => {
    const schema = z.object({
      query: z.string().optional(),
    })

    const request = new Request('https://example.com?query=')
    const query = parseQuery(request, schema)

    expect(query.query).toBe('')
  })

  it('should handle URL-encoded values', () => {
    const schema = z.object({
      name: z.string(),
    })

    const request = new Request('https://example.com?name=John%20Doe')
    const query = parseQuery(request, schema)

    expect(query.name).toBe('John Doe')
  })

  it('should handle special characters in values', () => {
    const schema = z.object({
      search: z.string(),
    })

    const request = new Request('https://example.com?search=hello+world')
    const query = parseQuery(request, schema)

    expect(query.search).toBe('hello world')
  })

  it('should handle complex query string with mixed types', () => {
    const schema = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      sort: z.enum(['name', 'createdAt', 'email']).optional(),
      filter: z.string().optional(),
      active: z.preprocess(
        v => v === 'true',
        z.boolean()
      ).optional(),
    })

    const request = new Request('https://example.com?page=3&limit=50&sort=email&filter=verified&active=true')
    const query = parseQuery(request, schema)

    expect(query).toEqual({
      page: 3,
      limit: 50,
      sort: 'email',
      filter: 'verified',
      active: true,
    })
  })

  it('should handle no query parameters when all are optional', () => {
    const schema = z.object({
      page: z.coerce.number().optional().default(1),
      search: z.string().optional(),
    })

    const request = new Request('https://example.com')
    const query = parseQuery(request, schema)

    expect(query).toEqual({ page: 1, search: undefined })
  })

  // ========================================================================
  // Type Safety Tests
  // ========================================================================

  it('should maintain type safety with complex schemas', () => {
    const schema = z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      sort: z.enum(['name', 'createdAt', 'email']).optional(),
    })

    const request = new Request('https://example.com?page=2&limit=10&sort=name')
    const query = parseQuery(request, schema)

    // Type assertions to verify TypeScript inference works
    const page: number = query.page
    const limit: number = query.limit
    const sort: 'name' | 'createdAt' | 'email' | undefined = query.sort

    expect(page).toBe(2)
    expect(limit).toBe(10)
    expect(sort).toBe('name')
  })
})
