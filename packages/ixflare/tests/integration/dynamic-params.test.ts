/**
 * @fileoverview Integration tests for dynamic route parameters
 * Tests AC1-AC4 from Story 2.2
 */

// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createRouter } from '../../src/core/router'
import { validateParams, parseCatchAllParam } from '../../src/core/params'
import type { LoaderArgs } from '../../src/types/handlers'

describe('Integration: Dynamic Route Parameters (Story 2.2)', () => {
  describe('AC1: Single Dynamic Parameter', () => {
    it('should extract userId from /users/[userId] route', async () => {
      const router = createRouter()
      let receivedParams: Record<string, string | string[]> = {}

      router.add('/users/:userId', ({ params }) => {
        receivedParams = params
        return new Response(JSON.stringify({ userId: params.userId }))
      })

      const request = new Request('http://localhost/users/123')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(receivedParams.userId).toBe('123')

      const data = await response.json()
      expect(data).toEqual({ userId: '123' })
    })

    it('should handle different user IDs correctly', async () => {
      const router = createRouter()
      let receivedUserId: string | string[] = ''

      router.add('/users/:userId', ({ params }) => {
        receivedUserId = params.userId
        return new Response('OK')
      })

      await router.handle(new Request('http://localhost/users/456'), {})
      expect(receivedUserId).toBe('456')

      await router.handle(new Request('http://localhost/users/abc-def'), {})
      expect(receivedUserId).toBe('abc-def')
    })
  })

  describe('AC2: Multiple Dynamic Parameters', () => {
    it('should extract org, repo, and id from nested route', async () => {
      const router = createRouter()
      let receivedParams: Record<string, string | string[]> = {}

      router.add('/:org/:repo/issues/:id', ({ params }) => {
        receivedParams = params
        return new Response('OK')
      })

      const request = new Request('http://localhost/acme/widgets/issues/42')
      await router.handle(request, {})

      expect(receivedParams).toEqual({
        org: 'acme',
        repo: 'widgets',
        id: '42',
      })
    })

    it('should work with LoaderArgs type signature', async () => {
      const router = createRouter()

      // Simulate a typed loader function
      const loader = ({ params }: LoaderArgs) => {
        // In real usage, params would be typed via Zod schema inference
        const { org, repo, id } = params as { org: string; repo: string; id: string }
        return new Response(JSON.stringify({ org, repo, id }))
      }

      router.add('/:org/:repo/issues/:id', loader)

      const request = new Request('http://localhost/acme/widgets/issues/42')
      const response = await router.handle(request, {})

      const data = await response.json()
      expect(data).toEqual({
        org: 'acme',
        repo: 'widgets',
        id: '42',
      })
    })
  })

  describe('AC3: Parameter Validation with Zod', () => {
    it('should validate and coerce userId to number', () => {
      const schema = z.object({
        userId: z.coerce.number().positive(),
      })

      const validated = validateParams({ userId: '123' }, schema)
      expect(validated).toEqual({ userId: 123 })
      expect(typeof validated.userId).toBe('number')
    })

    it('should reject invalid parameters', () => {
      const schema = z.object({
        userId: z.coerce.number().positive(),
      })

      expect(() => {
        validateParams({ userId: 'invalid' }, schema)
      }).toThrow()

      expect(() => {
        validateParams({ userId: '-5' }, schema)
      }).toThrow()
    })

    it('should handle complex validation with multiple types', () => {
      const schema = z.object({
        userId: z.coerce.number().int().positive(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        sort: z.enum(['asc', 'desc']).default('asc'),
      })

      const validated = validateParams(
        {
          userId: '42',
          page: '3',
          sort: 'desc',
        },
        schema
      )

      expect(validated).toEqual({
        userId: 42,
        page: 3,
        limit: 10, // Default applied
        sort: 'desc',
      })
    })

    it('should validate string formats with regex', () => {
      const schema = z.object({
        slug: z.string().regex(/^[a-z0-9-]+$/i),
      })

      const validated = validateParams({ slug: 'hello-world-123' }, schema)
      expect(validated.slug).toBe('hello-world-123')

      expect(() => {
        validateParams({ slug: 'invalid slug!' }, schema)
      }).toThrow()
    })
  })

  describe('AC4: Catch-All Routes', () => {
    it('should parse catch-all path into array', () => {
      const path = parseCatchAllParam('guides/routing/basics')
      expect(path).toEqual(['guides', 'routing', 'basics'])
    })

    it('should handle single segment catch-all', () => {
      const path = parseCatchAllParam('guides')
      expect(path).toEqual(['guides'])
    })

    it('should handle empty catch-all', () => {
      const path = parseCatchAllParam('')
      expect(path).toEqual([])
    })

    it('should validate catch-all array with Zod', () => {
      const schema = z.object({
        path: z.array(z.string().min(1)),
      })

      const validated = validateParams({ path: ['guides', 'routing', 'basics'] }, schema)

      expect(validated.path).toEqual(['guides', 'routing', 'basics'])
    })

    it('should reject empty strings in catch-all array', () => {
      const schema = z.object({
        path: z.array(z.string().min(1)),
      })

      expect(() => {
        validateParams({ path: ['guides', '', 'basics'] }, schema)
      }).toThrow()
    })
  })

  describe('Type Coercion Scenarios', () => {
    it('should coerce number types correctly', () => {
      const schema = z.object({
        id: z.coerce.number().int(),
        price: z.coerce.number(),
      })

      const validated = validateParams({ id: '42', price: '19.99' }, schema)
      expect(validated.id).toBe(42)
      expect(validated.price).toBe(19.99)
    })

    it('should handle boolean-like strings with custom transform', () => {
      const schema = z.object({
        active: z.string().transform((v) => v === 'true' || v === '1'),
        verified: z.string().transform((v) => v === 'true'),
      })

      const result1 = validateParams({ active: 'true', verified: 'true' }, schema)
      expect(result1).toEqual({ active: true, verified: true })

      const result2 = validateParams({ active: 'false', verified: 'false' }, schema)
      expect(result2).toEqual({ active: false, verified: false })

      const result3 = validateParams({ active: '1', verified: '0' }, schema)
      expect(result3).toEqual({ active: true, verified: false })
    })

    it('should apply defaults when params missing', () => {
      const schema = z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().default(10),
      })

      const validated = validateParams({}, schema)
      expect(validated).toEqual({ page: 1, limit: 10 })
    })
  })

  describe('End-to-End Scenarios', () => {
    it('should handle blog route with year/month/slug params', async () => {
      const router = createRouter()
      let receivedParams: Record<string, string | string[]> = {}

      router.add('/blog/:year/:month/:slug', ({ params }) => {
        receivedParams = params
        return new Response('OK')
      })

      const request = new Request('http://localhost/blog/2025/12/hello-world')
      await router.handle(request, {})

      expect(receivedParams).toEqual({
        year: '2025',
        month: '12',
        slug: 'hello-world',
      })
    })

    it('should validate blog params with Zod schema', () => {
      const schema = z.object({
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
        slug: z.string().regex(/^[a-z0-9-]+$/i),
      })

      const validated = validateParams({ year: '2025', month: '12', slug: 'hello-world' }, schema)

      expect(validated).toEqual({
        year: 2025,
        month: 12,
        slug: 'hello-world',
      })

      // Invalid month should throw
      expect(() => {
        validateParams({ year: '2025', month: '13', slug: 'test' }, schema)
      }).toThrow()
    })

    it('should handle API versioning routes', async () => {
      const router = createRouter()
      let receivedParams: Record<string, string | string[]> = {}

      router.add('/api/v:version/users/:id', ({ params }) => {
        receivedParams = params
        return new Response('OK')
      })

      const request = new Request('http://localhost/api/v1/users/123')
      await router.handle(request, {})

      expect(receivedParams).toEqual({
        version: '1',
        id: '123',
      })
    })
  })
})
