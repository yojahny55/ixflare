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

      router.add(
        '/docs/*',
        ({ params }) => {
          capturedParams = params
          return new Response('docs')
        },
        { catchAllParam: 'path' }
      )

      const request = new Request('http://localhost/docs/guides/routing/basics')
      await router.handle(request, {})

      // Should be named 'path', not '0'
      expect(capturedParams.path).toEqual(['guides', 'routing', 'basics'])
      expect(capturedParams['0']).toBeUndefined()
    })

    it('should handle empty catch-all', async () => {
      const router = createRouter()
      let capturedParams: Record<string, string | string[]> = {}

      router.add(
        '/docs/*',
        ({ params }) => {
          capturedParams = params
          return new Response('docs')
        },
        { catchAllParam: 'path' }
      )

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

      router.add(
        '/users/:userId',
        ({ params }) => {
          capturedParams = params
          return new Response('user')
        },
        { paramsSchema: schema }
      )

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

      router.add(
        '/users/:userId',
        () => {
          return new Response('user')
        },
        { paramsSchema: schema }
      )

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

      router.add(
        '/users/:userId',
        () => {
          return new Response('user')
        },
        { paramsSchema: schema }
      )

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

      router.add(
        '/:org/:repo/issues/:id',
        ({ params }) => {
          capturedParams = params
          return new Response('issue')
        },
        { paramsSchema: schema }
      )

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

      router.add(
        '/docs/*',
        ({ params }) => {
          capturedParams = params
          return new Response('docs')
        },
        { catchAllParam: 'path', paramsSchema: schema }
      )

      const request = new Request('http://localhost/docs/guides/routing')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(capturedParams).toEqual({
        path: ['guides', 'routing'],
      })
    })
  })

  describe('HTTP Method Handling', () => {
    it('should return 405 with Allow header for unsupported methods', async () => {
      const router = createRouter()

      router.add('/users', () => new Response('GET users'), { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'POST' })
      const response = await router.handle(request, {})

      expect(response.status).toBe(405)
      expect(response.headers.get('Allow')).toContain('GET')
      expect(response.headers.get('Allow')).toContain('HEAD')
      expect(response.headers.get('Allow')).toContain('OPTIONS')

      const body = await response.json()
      expect(body.error.code).toBe('ROUTING.METHOD_NOT_ALLOWED')
      expect(body.error.message).toContain('Method POST not allowed')
    })

    it('should auto-generate OPTIONS response with Allow header', async () => {
      const router = createRouter()

      router.add('/users', () => new Response('GET'), { methods: ['GET'] })
      router.add('/users', () => new Response('POST'), { methods: ['POST'] })

      const request = new Request('http://localhost/users', { method: 'OPTIONS' })
      const response = await router.handle(request, {})

      expect(response.status).toBe(204)
      const allowHeader = response.headers.get('Allow')
      expect(allowHeader).toContain('GET')
      expect(allowHeader).toContain('POST')
      expect(allowHeader).toContain('HEAD')
      expect(allowHeader).toContain('OPTIONS')
    })

    it('should auto-generate HEAD handler from GET handler', async () => {
      const router = createRouter()

      router.add(
        '/users',
        () =>
          new Response('User list', {
            headers: { 'Content-Type': 'text/plain', 'X-Custom': 'value' },
          }),
        { methods: ['GET'] }
      )

      const request = new Request('http://localhost/users', { method: 'HEAD' })
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Custom')).toBe('value')
      expect(await response.text()).toBe('') // HEAD should have no body
    })

    it('should include all methods in Allow header for 405', async () => {
      const router = createRouter()

      router.add('/api/resource', () => new Response('GET'), { methods: ['GET'] })
      router.add('/api/resource', () => new Response('POST'), { methods: ['POST'] })
      router.add('/api/resource', () => new Response('PUT'), { methods: ['PUT'] })

      const request = new Request('http://localhost/api/resource', { method: 'DELETE' })
      const response = await router.handle(request, {})

      expect(response.status).toBe(405)
      const allowHeader = response.headers.get('Allow')
      expect(allowHeader).toContain('GET')
      expect(allowHeader).toContain('POST')
      expect(allowHeader).toContain('PUT')
      expect(allowHeader).toContain('HEAD') // Auto-added because GET exists
      expect(allowHeader).toContain('OPTIONS') // Always added
      expect(allowHeader).not.toContain('DELETE')
    })
  })

  describe('Middleware Chains', () => {
    it('should apply global middleware before handler', async () => {
      const router = createRouter()
      const calls: string[] = []

      const globalMiddleware = [
        async (ctx: any, next: () => Promise<Response>) => {
          calls.push('global1-before')
          const response = await next()
          calls.push('global1-after')
          return response
        },
        async (ctx: any, next: () => Promise<Response>) => {
          calls.push('global2-before')
          const response = await next()
          calls.push('global2-after')
          return response
        },
      ]

      router.add(
        '/test',
        () => {
          calls.push('handler')
          return new Response('OK')
        },
        { globalMiddleware }
      )

      const request = new Request('http://localhost/test')
      await router.handle(request, {})

      expect(calls).toEqual([
        'global1-before',
        'global2-before',
        'handler',
        'global2-after',
        'global1-after',
      ])
    })

    it('should apply middleware in order: global → directory → route', async () => {
      const router = createRouter()
      const calls: string[] = []

      const globalMiddleware = [
        async (_: any, next: () => Promise<Response>) => {
          calls.push('global')
          return next()
        },
      ]

      const directoryMiddleware = [
        async (_: any, next: () => Promise<Response>) => {
          calls.push('directory')
          return next()
        },
      ]

      const routeMiddleware = [
        async (_: any, next: () => Promise<Response>) => {
          calls.push('route')
          return next()
        },
      ]

      router.add(
        '/test',
        () => {
          calls.push('handler')
          return new Response('OK')
        },
        {
          globalMiddleware,
          directoryMiddleware,
          routeMiddleware,
        }
      )

      const request = new Request('http://localhost/test')
      await router.handle(request, {})

      expect(calls).toEqual(['global', 'directory', 'route', 'handler'])
    })

    it('should handle nested directory middleware chain', async () => {
      const router = createRouter()
      const calls: string[] = []

      const globalMiddleware = [
        async (_: any, next: () => Promise<Response>) => {
          calls.push('global')
          return next()
        },
      ]

      // Simulating: / → /api → /api/admin
      const directoryMiddleware = [
        async (_: any, next: () => Promise<Response>) => {
          calls.push('dir-root')
          return next()
        },
        async (_: any, next: () => Promise<Response>) => {
          calls.push('dir-api')
          return next()
        },
        async (_: any, next: () => Promise<Response>) => {
          calls.push('dir-api-admin')
          return next()
        },
      ]

      router.add(
        '/api/admin/users',
        () => {
          calls.push('handler')
          return new Response('OK')
        },
        { globalMiddleware, directoryMiddleware }
      )

      const request = new Request('http://localhost/api/admin/users')
      await router.handle(request, {})

      expect(calls).toEqual(['global', 'dir-root', 'dir-api', 'dir-api-admin', 'handler'])
    })

    it('should allow middleware to short-circuit the chain', async () => {
      const router = createRouter()
      const calls: string[] = []

      const globalMiddleware = [
        async (_: any, next: () => Promise<Response>) => {
          calls.push('global')
          return next()
        },
        async (_: any, next: () => Promise<Response>) => {
          calls.push('auth')
          // Short-circuit - don't call next()
          return new Response('Unauthorized', { status: 401 })
        },
        async (_: any, next: () => Promise<Response>) => {
          calls.push('should-not-run')
          return next()
        },
      ]

      router.add(
        '/test',
        () => {
          calls.push('handler-should-not-run')
          return new Response('OK')
        },
        { globalMiddleware }
      )

      const request = new Request('http://localhost/test')
      const response = await router.handle(request, {})

      expect(calls).toEqual(['global', 'auth'])
      expect(response.status).toBe(401)
      expect(await response.text()).toBe('Unauthorized')
    })

    it('should apply middleware chain with empty arrays', async () => {
      const router = createRouter()

      router.add(
        '/test',
        () => {
          return new Response('OK')
        },
        {
          globalMiddleware: [],
          directoryMiddleware: [],
          routeMiddleware: [],
        }
      )

      const request = new Request('http://localhost/test')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('OK')
    })

    it('should handle undefined middleware arrays', async () => {
      const router = createRouter()

      router.add('/test', () => {
        return new Response('OK')
      })

      const request = new Request('http://localhost/test')
      const response = await router.handle(request, {})

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('OK')
    })
  })
})
