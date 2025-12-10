import { describe, it, expect, vi } from 'vitest'
import { requestId } from '@/middleware/request-id'
import { logging } from '@/middleware/logging'
import { timing } from '@/middleware/timing'
import { errorHandler } from '@/middleware/error-handler'
import { compose } from '@/core/middleware'
import { createEdgeContext } from '@/types'
import { AppError, AuthError, NotFoundError } from '@/errors'
import type { EdgeContext } from '@/types'

describe('Request/Response Transformation Integration', () => {
  const mockRequest = (url = 'https://example.com/api/users') => new Request(url)

  const mockContext = (request: Request): EdgeContext => {
    return createEdgeContext(request, {} as any, {})
  }

  const createHandler = (response: Response | (() => Response | Promise<Response>)) => {
    return async () => {
      return typeof response === 'function' ? await response() : response
    }
  }

  describe('Full middleware chain', () => {
    it('should work with errorHandler + requestId + logging + timing', async () => {
      const logger = vi.fn()

      const middleware = [errorHandler(), requestId(), logging({ logger }), timing()]

      const handler = createHandler(new Response('Success'))
      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      // Verify response
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Success')

      // Verify headers added
      expect(response.headers.has('X-Request-ID')).toBe(true)
      expect(response.headers.has('X-Response-Time')).toBe(true)

      // Verify logging called
      expect(logger).toHaveBeenCalledTimes(2)
      expect(logger).toHaveBeenNthCalledWith(1, '--> GET /api/users', expect.any(Object))
      expect(logger).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/<-- GET \/api\/users 200 \d+ms/),
        expect.any(Object)
      )
    })

    it('should propagate requestId through entire chain', async () => {
      const logger = vi.fn()
      let capturedRequestId: string | undefined

      const middleware = [errorHandler(), requestId(), logging({ logger })]

      const handler = createHandler(() => {
        const ctx = mockContext(mockRequest())
        capturedRequestId = ctx.requestId
        return new Response('Success')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const responseRequestId = response.headers.get('X-Request-ID')
      const logData = logger.mock.calls[0][1] as Record<string, unknown>

      expect(responseRequestId).toBeDefined()
      expect(logData.requestId).toBe(ctx.requestId)
      expect(ctx.requestId).toBe(responseRequestId)
    })

    it('should handle errors through full chain with request ID', async () => {
      const logger = vi.fn()

      const middleware = [errorHandler(), requestId(), logging({ logger })]

      const handler = createHandler(() => {
        throw new AuthError('UNAUTHORIZED', 'Missing token')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const body = await response.json()

      // Error response should have proper format
      expect(response.status).toBe(401)
      expect(body.error).toMatchObject({
        code: 'AUTH.UNAUTHORIZED',
        message: 'Missing token',
        status: 401,
      })

      // Should include requestId as rayId
      expect(body.error.rayId).toBe(ctx.requestId)

      // Response should have request ID header
      expect(response.headers.get('X-Request-ID')).toBe(ctx.requestId)
    })
  })

  describe('Error propagation through middleware chain', () => {
    it('should catch AppError and format consistently', async () => {
      // Note: timing middleware runs AFTER errorHandler, so it can add headers to error responses
      const middleware = [requestId(), timing(), errorHandler()]

      const handler = createHandler(() => {
        throw new NotFoundError('User', '123')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.status).toBe(404)
      expect(body.error.rayId).toBe(ctx.requestId)
      expect(response.headers.has('X-Response-Time')).toBe(true)
      expect(response.headers.get('X-Request-ID')).toBe(ctx.requestId)
    })

    it('should handle unexpected errors with sanitized message', async () => {
      const middleware = [errorHandler(), requestId()]

      const handler = createHandler(() => {
        throw new Error('Database connection failed: host=internal-db.local')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
      })
      // Should NOT expose internal error details
      expect(body.error.message).not.toContain('internal-db.local')
    })
  })

  describe('Header transformation in request/response flow', () => {
    it('should preserve and add headers throughout chain', async () => {
      const middleware = [requestId(), timing()]

      const handler = createHandler(
        () =>
          new Response('test', {
            headers: {
              'Content-Type': 'application/json',
              'X-Custom': 'value',
            },
          })
      )

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      // Original headers preserved
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('X-Custom')).toBe('value')

      // Middleware headers added
      expect(response.headers.has('X-Request-ID')).toBe(true)
      expect(response.headers.has('X-Response-Time')).toBe(true)
    })

    it('should handle incoming request ID and pass through', async () => {
      const existingId = 'upstream-request-id-12345'
      const middleware = [requestId()]

      const handler = createHandler(new Response('test'))

      const composed = compose(...middleware)(handler)

      const request = new Request('https://example.com/', {
        headers: { 'X-Request-ID': existingId },
      })
      const ctx = mockContext(request)
      const response = await composed(ctx)

      expect(ctx.requestId).toBe(existingId)
      expect(response.headers.get('X-Request-ID')).toBe(existingId)
    })
  })

  describe('Middleware composition patterns', () => {
    it('should execute middleware in correct order (onion model)', async () => {
      const executionOrder: string[] = []

      const createTrackingMiddleware = (name: string) => {
        return async (ctx: EdgeContext, next: () => Promise<Response>) => {
          executionOrder.push(`${name}-before`)
          const response = await next()
          executionOrder.push(`${name}-after`)
          return response
        }
      }

      const middleware = [
        createTrackingMiddleware('outer'),
        createTrackingMiddleware('middle'),
        createTrackingMiddleware('inner'),
      ]

      const handler = createHandler(() => {
        executionOrder.push('handler')
        return new Response('test')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      await composed(ctx)

      expect(executionOrder).toEqual([
        'outer-before',
        'middle-before',
        'inner-before',
        'handler',
        'inner-after',
        'middle-after',
        'outer-after',
      ])
    })

    it('should short-circuit on early response', async () => {
      const innerCalled = vi.fn()

      const earlyReturn = async (ctx: EdgeContext, next: () => Promise<Response>) => {
        return new Response('Early response', { status: 403 })
      }

      const middleware = [earlyReturn, requestId()]

      const handler = createHandler(() => {
        innerCalled()
        return new Response('Handler response')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      expect(response.status).toBe(403)
      expect(await response.text()).toBe('Early response')
      expect(innerCalled).not.toHaveBeenCalled()
    })
  })

  describe('Performance and timing', () => {
    it('should accurately measure response time', async () => {
      const middleware = [timing()]

      const handler = createHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return new Response('test')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const timeHeader = response.headers.get('X-Response-Time')
      const duration = Number.parseInt(timeHeader?.replace('ms', '') ?? '0')

      // Allow 2ms tolerance for timer precision variance
      expect(duration).toBeGreaterThanOrEqual(48)
    })

    it('should measure time including middleware overhead', async () => {
      const middleware = [
        requestId(),
        timing(),
        async (ctx: EdgeContext, next: () => Promise<Response>) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return next()
        },
      ]

      const handler = createHandler(new Response('test'))

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const timeHeader = response.headers.get('X-Response-Time')
      const duration = Number.parseInt(timeHeader?.replace('ms', '') ?? '0')

      // Allow some variance due to fast CPUs/timing jitter (may complete in 8-12ms)
      expect(duration).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Custom error handling with onError', () => {
    it('should allow custom error transformation', async () => {
      const middleware = [
        errorHandler({
          onError: (error) => {
            if (error.message.includes('maintenance')) {
              return Response.json(
                {
                  error: {
                    code: 'MAINTENANCE',
                    message: 'System under maintenance',
                    status: 503,
                  },
                },
                { status: 503 }
              )
            }
          },
        }),
      ]

      const handler = createHandler(() => {
        throw new Error('Database in maintenance mode')
      })

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.error.code).toBe('MAINTENANCE')
    })
  })

  describe('Request ID accessibility in handlers', () => {
    it('should make requestId accessible to route handlers via context', async () => {
      let handlerReceivedRequestId: string | undefined

      const middleware = [requestId()]

      const handler = async (ctx: EdgeContext) => {
        // This simulates a route handler accessing ctx.requestId
        handlerReceivedRequestId = ctx.requestId
        return Response.json({ requestId: ctx.requestId })
      }

      const composed = compose(...middleware)(handler)

      const request = mockRequest()
      const ctx = mockContext(request)
      const response = await composed(ctx)

      const body = await response.json()

      // Verify handler received the requestId
      expect(handlerReceivedRequestId).toBeDefined()
      expect(typeof handlerReceivedRequestId).toBe('string')

      // Verify it matches what's in response body and header
      expect(body.requestId).toBe(handlerReceivedRequestId)
      expect(response.headers.get('X-Request-ID')).toBe(handlerReceivedRequestId)
    })

    it('should preserve upstream requestId through to handler', async () => {
      const upstreamId = 'upstream-service-id-12345'
      let handlerReceivedRequestId: string | undefined

      const middleware = [requestId()]

      const handler = async (ctx: EdgeContext) => {
        handlerReceivedRequestId = ctx.requestId
        return Response.json({ received: ctx.requestId })
      }

      const composed = compose(...middleware)(handler)

      const request = new Request('https://example.com/', {
        headers: { 'X-Request-ID': upstreamId },
      })
      const ctx = mockContext(request)
      const response = await composed(ctx)

      expect(handlerReceivedRequestId).toBe(upstreamId)
      expect(response.headers.get('X-Request-ID')).toBe(upstreamId)
    })
  })
})
