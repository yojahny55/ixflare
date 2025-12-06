/**
 * @fileoverview Unit tests for parameter extraction and validation
 */

// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  extractParamsFromUrl,
  parseCatchAllParam,
  validateParams,
  matchRouteWithParams,
} from '../../src/core/params'

describe('extractParamsFromUrl', () => {
  it('should extract single dynamic parameter', () => {
    const params = extractParamsFromUrl('/users/:userId', '/users/123')
    expect(params).toEqual({ userId: '123' })
  })

  it('should extract multiple dynamic parameters', () => {
    const params = extractParamsFromUrl('/blog/:year/:month/:slug', '/blog/2025/12/hello-world')
    expect(params).toEqual({
      year: '2025',
      month: '12',
      slug: 'hello-world',
    })
  })

  it('should return null for non-matching pattern', () => {
    const params = extractParamsFromUrl('/users/:userId', '/posts/123')
    expect(params).toBeNull()
  })

  it('should handle static routes', () => {
    const params = extractParamsFromUrl('/about', '/about')
    expect(params).toEqual({})
  })

  it('should handle root route', () => {
    const params = extractParamsFromUrl('/', '/')
    expect(params).toEqual({})
  })

  it('should extract parameters from nested routes', () => {
    const params = extractParamsFromUrl('/api/v1/users/:userId/posts/:postId', '/api/v1/users/123/posts/456')
    expect(params).toEqual({
      userId: '123',
      postId: '456',
    })
  })

  it('should handle catch-all routes', () => {
    const params = extractParamsFromUrl('/docs/*', '/docs/guides/routing/basics')
    // URLPattern captures catch-all as group '0'
    expect(params).toHaveProperty('0')
    expect(typeof params['0']).toBe('string')
  })
})

describe('parseCatchAllParam', () => {
  it('should parse catch-all into array', () => {
    const result = parseCatchAllParam('guides/routing/basics')
    expect(result).toEqual(['guides', 'routing', 'basics'])
  })

  it('should handle single segment', () => {
    const result = parseCatchAllParam('guides')
    expect(result).toEqual(['guides'])
  })

  it('should handle empty string', () => {
    const result = parseCatchAllParam('')
    expect(result).toEqual([])
  })

  it('should filter empty segments', () => {
    const result = parseCatchAllParam('guides//routing///basics')
    expect(result).toEqual(['guides', 'routing', 'basics'])
  })
})

describe('validateParams', () => {
  it('should validate and coerce number parameter', () => {
    const schema = z.object({
      userId: z.coerce.number().int().positive(),
    })

    const result = validateParams({ userId: '123' }, schema)
    expect(result).toEqual({ userId: 123 })
  })

  it('should validate and coerce boolean parameter', () => {
    // Note: z.coerce.boolean() uses Boolean(value), so non-empty strings = true
    // For proper URL param boolean handling, use custom transform:
    // z.string().transform(v => v === 'true')
    const schema = z.object({
      active: z.string().transform(v => v === 'true'),
    })

    const result = validateParams({ active: 'true' }, schema)
    expect(result).toEqual({ active: true })

    const result2 = validateParams({ active: 'false' }, schema)
    expect(result2).toEqual({ active: false })
  })

  it('should validate multiple parameters with coercion', () => {
    const schema = z.object({
      userId: z.coerce.number().int().positive(),
      page: z.coerce.number().int().positive(),
      role: z.string().regex(/^[a-z]+$/),
    })

    const result = validateParams(
      { userId: '123', page: '2', role: 'admin' },
      schema
    )

    expect(result).toEqual({
      userId: 123,
      page: 2,
      role: 'admin',
    })
  })

  it('should throw ZodError for invalid parameter', () => {
    const schema = z.object({
      userId: z.coerce.number().int().positive(),
    })

    expect(() => {
      validateParams({ userId: 'invalid' }, schema)
    }).toThrow()
  })

  it('should throw ZodError for negative number when positive required', () => {
    const schema = z.object({
      userId: z.coerce.number().int().positive(),
    })

    expect(() => {
      validateParams({ userId: '-5' }, schema)
    }).toThrow()
  })

  it('should validate string format', () => {
    const schema = z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/i),
    })

    const result = validateParams({ slug: 'hello-world-123' }, schema)
    expect(result).toEqual({ slug: 'hello-world-123' })
  })

  it('should reject invalid string format', () => {
    const schema = z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/i),
    })

    expect(() => {
      validateParams({ slug: 'hello world!' }, schema)
    }).toThrow()
  })

  it('should apply default values', () => {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().default(10),
    })

    const result = validateParams({ page: '5' }, schema)
    expect(result).toEqual({ page: 5, limit: 10 })
  })

  it('should validate array parameters for catch-all', () => {
    const schema = z.object({
      path: z.array(z.string()),
    })

    const result = validateParams(
      { path: ['guides', 'routing', 'basics'] },
      schema
    )

    expect(result).toEqual({
      path: ['guides', 'routing', 'basics'],
    })
  })

  it('should handle URL param boolean coercion correctly', () => {
    // Demonstrates proper way to handle boolean URL params
    const schema = z.object({
      isActive: z.string().transform(v => v === 'true' || v === '1'),
    })

    expect(validateParams({ isActive: 'true' }, schema)).toEqual({ isActive: true })
    expect(validateParams({ isActive: 'false' }, schema)).toEqual({ isActive: false })
    expect(validateParams({ isActive: '1' }, schema)).toEqual({ isActive: true })
    expect(validateParams({ isActive: '0' }, schema)).toEqual({ isActive: false })
  })
})

describe('matchRouteWithParams', () => {
  it('should match route and return unvalidated params', () => {
    const result = matchRouteWithParams('/users/:userId', '/users/123')
    expect(result).toEqual({ userId: '123' })
  })

  it('should match route and validate params with schema', () => {
    const schema = z.object({
      userId: z.coerce.number().int().positive(),
    })

    const result = matchRouteWithParams('/users/:userId', '/users/123', schema)
    expect(result).toEqual({ userId: 123 })
  })

  it('should return null when route does not match', () => {
    const result = matchRouteWithParams('/users/:userId', '/posts/123')
    expect(result).toBeNull()
  })

  it('should return null when validation fails', () => {
    const schema = z.object({
      userId: z.coerce.number().int().positive(),
    })

    const result = matchRouteWithParams('/users/:userId', '/users/invalid', schema)
    expect(result).toBeNull()
  })

  it('should match and validate complex nested route', () => {
    const schema = z.object({
      org: z.string().regex(/^[a-z0-9-]+$/i),
      repo: z.string().regex(/^[a-z0-9-]+$/i),
      id: z.coerce.number().int().positive(),
    })

    const result = matchRouteWithParams(
      '/:org/:repo/issues/:id',
      '/acme/widgets/issues/42',
      schema
    )

    expect(result).toEqual({
      org: 'acme',
      repo: 'widgets',
      id: 42,
    })
  })
})
