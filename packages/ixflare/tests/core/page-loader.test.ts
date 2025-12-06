/**
 * @fileoverview Tests for page loader execution in Router
 */

// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect, beforeEach } from 'vitest'
import { Router } from '../../src/core/router'
import { redirect } from '../../src/core/helpers'
import { NotFoundError, AuthError, ForbiddenError, ValidationError } from '../../src/errors'
import type { EdgeContext } from '../../src/types/context'
import type { LoaderArgs } from '../../src/types/handlers'

describe('Router - Page Loader Execution', () => {
  let router: Router
  let env: Record<string, unknown>

  beforeEach(() => {
    router = new Router()
    env = { TEST_ENV: 'test' }
  })

  describe('AC1: Basic Loader Definition', () => {
    it('should execute loader before handler and provide data to context', async () => {
      let loaderExecuted = false
      let handlerExecuted = false
      let loaderData: unknown

      router.add(
        '/users/:userId',
        async (ctx: EdgeContext) => {
          handlerExecuted = true
          // @ts-expect-error - loaderData is dynamically added
          loaderData = ctx.loaderData
          return new Response('OK')
        },
        {
          loader: async ({ params }: LoaderArgs) => {
            loaderExecuted = true
            return { user: { id: params.userId, name: 'Test User' } }
          },
        }
      )

      const request = new Request('http://localhost/users/123')
      const response = await router.handle(request, env)

      expect(loaderExecuted).toBe(true)
      expect(handlerExecuted).toBe(true)
      expect(loaderData).toEqual({ user: { id: '123', name: 'Test User' } })
      expect(response.status).toBe(200)
    })

    it('should work with loader that returns no data (undefined)', async () => {
      router.add(
        '/test',
        async () => {
          return new Response('OK')
        },
        {
          loader: async () => {
            // Loader that returns nothing
            return undefined
          },
        }
      )

      const request = new Request('http://localhost/test')
      const response = await router.handle(request, env)

      expect(response.status).toBe(200)
    })

    it('should pass correct LoaderArgs to loader', async () => {
      let capturedArgs: LoaderArgs | undefined

      router.add(
        '/posts/:postId',
        async () => new Response('OK'),
        {
          loader: async (args: LoaderArgs) => {
            capturedArgs = args
            return { post: { id: args.params.postId } }
          },
        }
      )

      const request = new Request('http://localhost/posts/456?sort=asc')
      await router.handle(request, env)

      expect(capturedArgs).toBeDefined()
      expect(capturedArgs!.params.postId).toBe('456')
      expect(capturedArgs!.query.get('sort')).toBe('asc')
      expect(capturedArgs!.request).toBeInstanceOf(Request)
      expect(capturedArgs!.env).toBe(env)
      expect(capturedArgs!.method).toBe('GET')
    })
  })

  describe('AC2: Typed Error Handling in Loaders', () => {
    it('should return 404 response when loader throws NotFoundError', async () => {
      router.add(
        '/users/:userId',
        async () => new Response('OK'),
        {
          loader: async ({ params }: LoaderArgs) => {
            throw new NotFoundError('User', params.userId)
          },
        }
      )

      const request = new Request('http://localhost/users/999')
      const response = await router.handle(request, env)

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: "User with id '999' not found",
          status: 404,
        },
      })
      // Verify timestamp is present per architecture spec
      expect(body.error.timestamp).toBeDefined()
      expect(typeof body.error.timestamp).toBe('number')
    })

    it('should return 401 response when loader throws AuthError', async () => {
      router.add(
        '/profile',
        async () => new Response('OK'),
        {
          loader: async () => {
            throw new AuthError('TOKEN_EXPIRED', 'Session has expired')
          },
        }
      )

      const request = new Request('http://localhost/profile')
      const response = await router.handle(request, env)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe('AUTH.TOKEN_EXPIRED')
      expect(body.error.status).toBe(401)
    })

    it('should return 403 response when loader throws ForbiddenError', async () => {
      router.add(
        '/admin',
        async () => new Response('OK'),
        {
          loader: async () => {
            throw new ForbiddenError('Admin access required')
          },
        }
      )

      const request = new Request('http://localhost/admin')
      const response = await router.handle(request, env)

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.status).toBe(403)
    })

    it('should return 422 response when loader throws ValidationError with errors array', async () => {
      router.add(
        '/validate',
        async () => new Response('OK'),
        {
          loader: async () => {
            throw new ValidationError('Email format is invalid', [
              { field: 'email', message: 'Invalid email format' },
            ])
          },
        }
      )

      const request = new Request('http://localhost/validate')
      const response = await router.handle(request, env)

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION.FAILED')
      expect(body.error.status).toBe(422)
      expect(body.error.timestamp).toBeDefined()
      // Verify errors array is preserved from ValidationError
      expect(body.error.errors).toEqual([
        { field: 'email', message: 'Invalid email format' },
      ])
    })

    it('should return 500 response for unknown errors with safe message', async () => {
      router.add(
        '/error',
        async () => new Response('OK'),
        {
          loader: async () => {
            throw new Error('Some internal error')
          },
        }
      )

      const request = new Request('http://localhost/error')
      const response = await router.handle(request, env)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error.code).toBe('INTERNAL_ERROR')
      expect(body.error.message).toBe('An unexpected error occurred')
      expect(body.error.status).toBe(500)
    })
  })

  describe('AC3: Parallel Loader Execution', () => {
    it('should execute loader before handler', async () => {
      const timestamps: number[] = []

      router.add(
        '/test',
        async () => {
          timestamps.push(Date.now())
          return new Response('OK')
        },
        {
          loader: async () => {
            timestamps.push(Date.now())
            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, 10))
            return { data: 'test' }
          },
        }
      )

      const request = new Request('http://localhost/test')
      await router.handle(request, env)

      // Loader should execute before handler
      expect(timestamps.length).toBe(2)
      expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1])
    })

    it('should execute layout + page loaders in parallel using executeLoaders', async () => {
      // Import executeLoaders for parallel execution testing
      const { executeLoaders } = await import('../../src/core/layout-loader')

      const executionOrder: string[] = []
      const startTime = Date.now()

      // Simulate layout loaders with delays
      const layoutLoader1 = async () => {
        executionOrder.push('layout1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('layout1-end')
        return { layout1: 'data' }
      }

      const layoutLoader2 = async () => {
        executionOrder.push('layout2-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('layout2-end')
        return { layout2: 'data' }
      }

      const pageLoader = async () => {
        executionOrder.push('page-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('page-end')
        return { page: 'data' }
      }

      const args = {
        request: new Request('http://localhost/test'),
        params: {},
        env: {},
        ctx: { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as ExecutionContext,
        query: new URLSearchParams(),
        url: new URL('http://localhost/test'),
        method: 'GET',
        headers: new Headers(),
      }

      const [layoutData, pageData] = await executeLoaders(
        [layoutLoader1, layoutLoader2],
        pageLoader,
        args
      )

      const duration = Date.now() - startTime

      // All loaders return correct data
      expect(layoutData).toEqual([{ layout1: 'data' }, { layout2: 'data' }])
      expect(pageData).toEqual({ page: 'data' })

      // If run in parallel, total time should be ~50ms (max of individual times)
      // If run sequentially, it would be ~150ms
      // Allow some buffer for test execution overhead
      expect(duration).toBeLessThan(120) // Should be ~50-70ms if parallel

      // Verify all started before any ended (parallel execution)
      const startIndices = executionOrder
        .map((e, i) => (e.endsWith('-start') ? i : -1))
        .filter((i) => i >= 0)
      const endIndices = executionOrder
        .map((e, i) => (e.endsWith('-end') ? i : -1))
        .filter((i) => i >= 0)

      // All starts should happen before all ends in parallel execution
      const maxStartIndex = Math.max(...startIndices)
      const minEndIndex = Math.min(...endIndices)
      expect(maxStartIndex).toBeLessThan(minEndIndex)
    })
  })

  describe('AC4: Redirect from Loader', () => {
    it('should handle redirect when loader returns redirect()', async () => {
      router.add(
        '/protected',
        async () => new Response('Protected Content'),
        {
          loader: async () => {
            // Simulate auth check
            const isAuthenticated = false
            if (!isAuthenticated) {
              return redirect('/login')
            }
            return { user: { id: '1' } }
          },
        }
      )

      const request = new Request('http://localhost/protected')
      const response = await router.handle(request, env)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/login')
    })

    it('should handle redirect when loader throws redirect()', async () => {
      router.add(
        '/protected',
        async () => new Response('Protected Content'),
        {
          loader: async () => {
            // Simulate auth check in nested function
            const checkAuth = () => {
              throw redirect('/login', 307)
            }
            checkAuth()
            return { user: { id: '1' } }
          },
        }
      )

      const request = new Request('http://localhost/protected')
      const response = await router.handle(request, env)

      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toBe('/login')
    })

    it('should support different redirect status codes', async () => {
      const testCases = [
        { status: 301 as const, description: 'permanent redirect' },
        { status: 302 as const, description: 'temporary redirect' },
        { status: 303 as const, description: 'see other' },
        { status: 307 as const, description: 'temporary redirect (preserve method)' },
        { status: 308 as const, description: 'permanent redirect (preserve method)' },
      ]

      for (const { status } of testCases) {
        const testRouter = new Router()
        testRouter.add(
          '/test',
          async () => new Response('OK'),
          {
            loader: async () => {
              return redirect('/destination', status)
            },
          }
        )

        const request = new Request('http://localhost/test')
        const response = await testRouter.handle(request, env)

        expect(response.status).toBe(status)
        expect(response.headers.get('Location')).toBe('/destination')
      }
    })
  })

  describe('Route without loader (backward compatibility)', () => {
    it('should work normally when no loader is defined', async () => {
      router.add('/no-loader', async () => {
        return new Response('OK')
      })

      const request = new Request('http://localhost/no-loader')
      const response = await router.handle(request, env)

      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).toBe('OK')
    })
  })

  describe('Loader with different HTTP methods', () => {
    it('should execute loader for GET requests', async () => {
      let loaderCalled = false

      router.add(
        '/test',
        async () => new Response('OK'),
        {
          methods: ['GET'],
          loader: async () => {
            loaderCalled = true
            return { data: 'test' }
          },
        }
      )

      const request = new Request('http://localhost/test')
      await router.handle(request, env)

      expect(loaderCalled).toBe(true)
    })

    it('should execute loader for POST requests if loader is defined', async () => {
      let loaderCalled = false

      router.add(
        '/test',
        async () => new Response('OK'),
        {
          methods: ['POST'],
          loader: async () => {
            loaderCalled = true
            return { data: 'test' }
          },
        }
      )

      const request = new Request('http://localhost/test', { method: 'POST' })
      await router.handle(request, env)

      expect(loaderCalled).toBe(true)
    })
  })
})
