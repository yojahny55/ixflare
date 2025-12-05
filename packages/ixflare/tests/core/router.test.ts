// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { Router, createRouter } from '../../src/core/router'

describe('Router', () => {
  it('should create a new router instance', () => {
    const router = createRouter()
    expect(router).toBeInstanceOf(Router)
  })

  it('should add routes and match them', async () => {
    const router = createRouter()

    router.add('/users', ({ request }) => {
      return new Response('users list')
    })

    const request = new Request('http://localhost/users')
    const response = await router.handle(request, {})

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('users list')
  })

  it('should extract route params', async () => {
    const router = createRouter()
    let capturedParams: Record<string, string | string[]> = {}

    router.add('/users/:id', ({ params }) => {
      capturedParams = params
      return new Response('user detail')
    })

    const request = new Request('http://localhost/users/123')
    await router.handle(request, {})

    expect(capturedParams.id).toBe('123')
  })

  it('should return 404 for unmatched routes', async () => {
    const router = createRouter()

    const request = new Request('http://localhost/unknown')
    const response = await router.handle(request, {})

    expect(response.status).toBe(404)
  })

  describe('Catch-All Routes', () => {
    it('should map catch-all to named parameter', async () => {
      const router = createRouter()
      let capturedParams: Record<string, string | string[]> = {}

      router.add('/docs/*', ({ params }) => {
        capturedParams = params
        return new Response('docs')
      }, { catchAllParam: 'path' })

      const request = new Request('http://localhost/docs/guides/routing/basics')
      await router.handle(request, {})

      // Should be named 'path', not '0'
      expect(capturedParams.path).toEqual(['guides', 'routing', 'basics'])
      expect(capturedParams['0']).toBeUndefined()
    })

    it('should handle empty catch-all', async () => {
      const router = createRouter()
      let capturedParams: Record<string, string | string[]> = {}

      router.add('/docs/*', ({ params }) => {
        capturedParams = params
        return new Response('docs')
      }, { catchAllParam: 'path' })

      const request = new Request('http://localhost/docs/')
      await router.handle(request, {})

      expect(capturedParams.path).toEqual([])
    })
  })

  describe('Parameter Validation with Zod Schema', () => {
    it('should validate and coerce params with schema', async () => {
      const router = createRouter()
      let capturedParams: unknown = {}

      const schema = z.object({
        userId: z.coerce.number().int().positive(),
      })

      router.add('/users/:userId', ({ params }) => {
        capturedParams = params
        return new Response('user')
      }, { paramsSchema: schema })

      const request = new Request('http://localhost/users/123')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(capturedParams).toEqual({ userId: 123 })
    })

    it('should return 400 for invalid params', async () => {
      const router = createRouter()

      const schema = z.object({
        userId: z.coerce.number().int().positive(),
      })

      router.add('/users/:userId', () => {
        return new Response('user')
      }, { paramsSchema: schema })

      const request = new Request('http://localhost/users/invalid')
      const response = await router.handle(request, {})

      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION.INVALID_PARAMS')
      expect(body.error.message).toBe('Parameter validation failed')
      expect(body.error.details).toBeDefined()
    })

    it('should return 400 for negative number when positive required', async () => {
      const router = createRouter()

      const schema = z.object({
        userId: z.coerce.number().int().positive(),
      })

      router.add('/users/:userId', () => {
        return new Response('user')
      }, { paramsSchema: schema })

      const request = new Request('http://localhost/users/-5')
      const response = await router.handle(request, {})

      expect(response.status).toBe(400)
    })

    it('should validate multiple params', async () => {
      const router = createRouter()
      let capturedParams: unknown = {}

      const schema = z.object({
        org: z.string().regex(/^[a-z0-9-]+$/i),
        repo: z.string().regex(/^[a-z0-9-]+$/i),
        id: z.coerce.number().int().positive(),
      })

      router.add('/:org/:repo/issues/:id', ({ params }) => {
        capturedParams = params
        return new Response('issue')
      }, { paramsSchema: schema })

      const request = new Request('http://localhost/acme/widgets/issues/42')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(capturedParams).toEqual({
        org: 'acme',
        repo: 'widgets',
        id: 42,
      })
    })

    it('should validate catch-all with schema', async () => {
      const router = createRouter()
      let capturedParams: unknown = {}

      const schema = z.object({
        path: z.array(z.string().min(1)),
      })

      router.add('/docs/*', ({ params }) => {
        capturedParams = params
        return new Response('docs')
      }, { catchAllParam: 'path', paramsSchema: schema })

      const request = new Request('http://localhost/docs/guides/routing')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(capturedParams).toEqual({
        path: ['guides', 'routing'],
      })
    })
  })
})
