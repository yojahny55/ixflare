/**
 * @fileoverview Integration tests for query parameter parsing
 * Tests full request flow with router and query validation
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseQuery } from '@/core/query-parser'
import { ValidationError } from '@/errors'

describe('Query Parser Integration', () => {
  // ========================================================================
  // Full Request Flow Tests
  // ========================================================================

  describe('full request flow with query validation', () => {
    it('should parse and validate query params in a simulated route handler', () => {
      // Simulate a route handler that uses parseQuery
      const paginationSchema = z.object({
        page: z.coerce.number().positive().default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        sort: z.enum(['name', 'createdAt', 'email']).optional(),
      })

      // Simulate incoming request to /api/users?page=2&limit=10&sort=name
      const request = new Request('https://api.example.com/api/users?page=2&limit=10&sort=name')

      // Handler logic
      const query = parseQuery(request, paginationSchema)

      // Verify typed result
      expect(query.page).toBe(2)
      expect(query.limit).toBe(10)
      expect(query.sort).toBe('name')
    })

    it('should work with complex filtering scenarios', () => {
      const filterSchema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).optional(),
        tags: z.preprocess(
          v => (Array.isArray(v) ? v : v ? [v] : []),
          z.array(z.string())
        ),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
      })

      const request = new Request(
        'https://api.example.com/products?status=active&tags=electronics&tags=sale&minPrice=10&maxPrice=100'
      )

      const query = parseQuery(request, filterSchema)

      expect(query.status).toBe('active')
      expect(query.tags).toEqual(['electronics', 'sale'])
      expect(query.minPrice).toBe(10)
      expect(query.maxPrice).toBe(100)
    })
  })

  // ========================================================================
  // Error Response Tests (422 ValidationError)
  // ========================================================================

  describe('validation error responses', () => {
    it('should throw ValidationError with 422 status on invalid input', () => {
      const schema = z.object({
        page: z.coerce.number().positive(),
      })

      const request = new Request('https://api.example.com?page=-5')

      try {
        parseQuery(request, schema)
        expect.fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError
        expect(validationError.status).toBe(422)
        expect(validationError.code).toBe('VALIDATION.FAILED')
      }
    })

    it('should return field-level errors in architecture format', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.coerce.number().min(18),
      })

      const request = new Request('https://api.example.com?email=invalid&age=15')

      try {
        parseQuery(request, schema)
        expect.fail('Should have thrown ValidationError')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const validationError = error as ValidationError

        // Verify error envelope structure matches architecture
        const json = validationError.toJSON()
        expect(json).toHaveProperty('error')
        expect(json.error).toHaveProperty('code', 'VALIDATION.FAILED')
        expect(json.error).toHaveProperty('message', 'Query parameter validation failed')
        expect(json.error).toHaveProperty('status', 422)
        expect(json.error).toHaveProperty('timestamp')
        expect(json.error).toHaveProperty('errors')

        // Verify field-level errors
        const errors = json.error.errors as Array<{ field: string; message: string }>
        expect(errors.length).toBeGreaterThanOrEqual(2)

        const emailError = errors.find(e => e.field === 'email')
        const ageError = errors.find(e => e.field === 'age')

        expect(emailError).toBeDefined()
        expect(ageError).toBeDefined()
      }
    })

    it('should handle multiple validation errors in single response', () => {
      const schema = z.object({
        page: z.coerce.number().positive(),
        limit: z.coerce.number().min(1).max(100),
        sort: z.enum(['name', 'date']),
      })

      const request = new Request('https://api.example.com?page=0&limit=500&sort=invalid')

      try {
        parseQuery(request, schema)
        expect.fail('Should have thrown ValidationError')
      } catch (error) {
        const validationError = error as ValidationError
        expect(validationError.errors.length).toBe(3)
      }
    })
  })

  // ========================================================================
  // Edge Cases in Request Context
  // ========================================================================

  describe('edge cases in request context', () => {
    it('should handle requests with no query string', () => {
      const schema = z.object({
        page: z.coerce.number().default(1),
        search: z.string().optional(),
      })

      const request = new Request('https://api.example.com/users')
      const query = parseQuery(request, schema)

      expect(query.page).toBe(1)
      expect(query.search).toBeUndefined()
    })

    it('should handle requests with empty query string', () => {
      const schema = z.object({
        page: z.coerce.number().default(1),
      })

      const request = new Request('https://api.example.com/users?')
      const query = parseQuery(request, schema)

      expect(query.page).toBe(1)
    })

    it('should handle requests with hash fragments', () => {
      const schema = z.object({
        page: z.coerce.number(),
      })

      // Hash fragment should not affect query parsing
      const request = new Request('https://api.example.com/users?page=5#section')
      const query = parseQuery(request, schema)

      expect(query.page).toBe(5)
    })

    it('should handle key without value (?debug)', () => {
      const schema = z.object({
        debug: z.string().optional(),
      })

      const request = new Request('https://api.example.com?debug')
      const query = parseQuery(request, schema)

      // URLSearchParams returns empty string for key without value
      expect(query.debug).toBe('')
    })

    it('should handle boolean-like flags', () => {
      const schema = z.object({
        verbose: z.preprocess(
          v => v === '' || v === 'true' || v === '1',
          z.boolean()
        ),
      })

      // ?verbose with no value should be truthy
      const request1 = new Request('https://api.example.com?verbose')
      expect(parseQuery(request1, schema).verbose).toBe(true)

      // ?verbose=true
      const request2 = new Request('https://api.example.com?verbose=true')
      expect(parseQuery(request2, schema).verbose).toBe(true)

      // ?verbose=false
      const request3 = new Request('https://api.example.com?verbose=false')
      expect(parseQuery(request3, schema).verbose).toBe(false)
    })
  })

  // ========================================================================
  // Real-World API Scenarios
  // ========================================================================

  describe('real-world API scenarios', () => {
    it('should handle search endpoint with pagination and filters', () => {
      const searchSchema = z.object({
        q: z.string().min(1),
        page: z.coerce.number().positive().default(1),
        per_page: z.coerce.number().min(1).max(100).default(25),
        sort_by: z.enum(['relevance', 'date', 'popularity']).default('relevance'),
        order: z.enum(['asc', 'desc']).default('desc'),
      })

      const request = new Request(
        'https://api.example.com/search?q=typescript&page=2&per_page=50&sort_by=date&order=asc'
      )

      const query = parseQuery(request, searchSchema)

      expect(query.q).toBe('typescript')
      expect(query.page).toBe(2)
      expect(query.per_page).toBe(50)
      expect(query.sort_by).toBe('date')
      expect(query.order).toBe('asc')
    })

    it('should handle date range filtering', () => {
      const dateRangeSchema = z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })

      const request = new Request(
        'https://api.example.com/analytics?start_date=2024-01-01&end_date=2024-12-31'
      )

      const query = parseQuery(request, dateRangeSchema)

      expect(query.start_date).toBe('2024-01-01')
      expect(query.end_date).toBe('2024-12-31')
    })

    it('should handle multi-select filters', () => {
      const multiSelectSchema = z.object({
        category: z.preprocess(
          v => (Array.isArray(v) ? v : v ? [v] : []),
          z.array(z.enum(['electronics', 'clothing', 'books', 'home']))
        ),
        price_range: z.preprocess(
          v => (Array.isArray(v) ? v : v ? [v] : []),
          z.array(z.enum(['budget', 'mid', 'premium']))
        ),
      })

      const request = new Request(
        'https://api.example.com/products?category=electronics&category=books&price_range=mid&price_range=premium'
      )

      const query = parseQuery(request, multiSelectSchema)

      expect(query.category).toEqual(['electronics', 'books'])
      expect(query.price_range).toEqual(['mid', 'premium'])
    })
  })
})
