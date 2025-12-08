import { describe, it, expect, vi } from 'vitest'
import { createMiddleware, compose } from '../../src/core/middleware'
import type { EdgeContext } from '../../src/types/context'

function createMockContext(overrides: Partial<EdgeContext> = {}): EdgeContext {
  const request = new Request('http://localhost/test')
  const url = new URL(request.url)
  return {
    request,
    params: {},
    env: {},
    ctx: {} as ExecutionContext,
    query: url.searchParams,
    url,
    method: request.method,
    headers: request.headers,
    ...overrides,
  }
}

describe('Middleware', () => {
  describe('createMiddleware', () => {
    it('should create a middleware function', () => {
      const middleware = createMiddleware(async (ctx, next) => {
        return next()
      })

      expect(typeof middleware).toBe('function')
    })

    it('should pass context to middleware', async () => {
      const context = createMockContext({ params: { id: '123' } })
      let capturedContext: EdgeContext | null = null

      const middleware = createMiddleware(async (ctx, next) => {
        capturedContext = ctx
        return next()
      })

      const handler = compose(middleware)(() => new Response('OK'))
      await handler(context)

      expect(capturedContext).toBe(context)
      expect(capturedContext?.params.id).toBe('123')
    })
  })

  describe('compose', () => {
    it('should execute middlewares in order', async () => {
      const order: number[] = []

      const middleware1 = createMiddleware(async (ctx, next) => {
        order.push(1)
        const response = await next()
        order.push(4)
        return response
      })

      const middleware2 = createMiddleware(async (ctx, next) => {
        order.push(2)
        const response = await next()
        order.push(3)
        return response
      })

      const handler = compose(middleware1, middleware2)(() => {
        return new Response('OK')
      })

      await handler(createMockContext())

      expect(order).toEqual([1, 2, 3, 4])
    })

    it('should allow middleware to short-circuit the chain', async () => {
      const middleware1 = createMiddleware(async () => {
        return new Response('Short-circuited', { status: 401 })
      })

      const middleware2 = createMiddleware(async (ctx, next) => {
        return next()
      })

      const handlerCalled = vi.fn(() => new Response('OK'))

      const handler = compose(middleware1, middleware2)(handlerCalled)
      const response = await handler(createMockContext())

      expect(response.status).toBe(401)
      expect(await response.text()).toBe('Short-circuited')
      expect(handlerCalled).not.toHaveBeenCalled()
    })

    it('should call the final handler when no middleware short-circuits', async () => {
      const middleware = createMiddleware(async (ctx, next) => {
        return next()
      })

      const handler = compose(middleware)(() => {
        return new Response('Handler called')
      })

      const response = await handler(createMockContext())

      expect(await response.text()).toBe('Handler called')
    })

    it('should throw error if next() is called multiple times', async () => {
      const badMiddleware = createMiddleware(async (ctx, next) => {
        await next()
        return next() // Second call should throw
      })

      const handler = compose(badMiddleware)(() => new Response('OK'))

      await expect(handler(createMockContext())).rejects.toThrow(
        'next() called multiple times'
      )
    })

    it('should work with empty middleware array', async () => {
      const handler = compose()(() => new Response('Direct'))
      const response = await handler(createMockContext())

      expect(await response.text()).toBe('Direct')
    })

    it('should allow middleware to modify response', async () => {
      const middleware = createMiddleware(async (ctx, next) => {
        const response = await next()
        const body = await response.text()
        return new Response(body.toUpperCase(), {
          status: response.status,
          headers: response.headers,
        })
      })

      const handler = compose(middleware)(() => new Response('hello'))
      const response = await handler(createMockContext())

      expect(await response.text()).toBe('HELLO')
    })

    it('should allow middleware to add headers', async () => {
      const middleware = createMiddleware(async (ctx, next) => {
        const response = await next()
        const newHeaders = new Headers(response.headers)
        newHeaders.set('X-Custom-Header', 'test-value')
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        })
      })

      const handler = compose(middleware)(() => new Response('OK'))
      const response = await handler(createMockContext())

      expect(response.headers.get('X-Custom-Header')).toBe('test-value')
    })

    it('should allow middleware to modify context', async () => {
      const context = createMockContext()

      const middleware = createMiddleware(async (ctx, next) => {
        // Type-safe context mutation
        ;(ctx as any).customData = 'test-value'
        return next()
      })

      let capturedContext: EdgeContext | null = null
      const handler = compose(middleware)((ctx) => {
        capturedContext = ctx
        return new Response('OK')
      })

      await handler(context)

      expect((capturedContext as any).customData).toBe('test-value')
    })

    it('should support timing middleware pattern (response interception)', async () => {
      const timingMiddleware = createMiddleware(async (ctx, next) => {
        const start = Date.now()
        const response = await next()
        const duration = Date.now() - start

        const newHeaders = new Headers(response.headers)
        newHeaders.set('X-Response-Time', `${duration}ms`)

        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        })
      })

      const handler = compose(timingMiddleware)(() => new Response('OK'))
      const response = await handler(createMockContext())

      expect(response.headers.has('X-Response-Time')).toBe(true)
      expect(response.headers.get('X-Response-Time')).toMatch(/^\d+ms$/)
    })
  })

  describe('withErrorBoundary', () => {
    it('should catch and handle AppError instances', async () => {
      const { AppError } = await import('../../src/errors')
      const { withErrorBoundary } = await import('../../src/core/middleware')

      const errorMiddleware = createMiddleware(async () => {
        throw new AppError('TEST_ERROR', 'Something went wrong', 500)
      })

      const handler = compose(withErrorBoundary(errorMiddleware))(() => new Response('OK'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toMatchObject({
        code: 'TEST_ERROR',
        message: 'Something went wrong',
        status: 500,
      })
    })

    it('should handle AuthError with 401 status', async () => {
      const { AuthError } = await import('../../src/errors')
      const { withErrorBoundary } = await import('../../src/core/middleware')

      const errorMiddleware = createMiddleware(async () => {
        throw new AuthError('UNAUTHORIZED', 'Missing token')
      })

      const handler = compose(withErrorBoundary(errorMiddleware))(() => new Response('OK'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe('AUTH.UNAUTHORIZED')
    })

    it('should handle ValidationError with 422 status and errors array', async () => {
      const { ValidationError } = await import('../../src/errors')
      const { withErrorBoundary } = await import('../../src/core/middleware')

      const errorMiddleware = createMiddleware(async () => {
        throw new ValidationError('Validation failed', [
          { field: 'email', message: 'Invalid email' }
        ])
      })

      const handler = compose(withErrorBoundary(errorMiddleware))(() => new Response('OK'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error.errors).toEqual([
        { field: 'email', message: 'Invalid email' }
      ])
    })

    it('should handle unexpected errors with 500 status', async () => {
      const { withErrorBoundary } = await import('../../src/core/middleware')

      const errorMiddleware = createMiddleware(async () => {
        throw new Error('Unexpected error')
      })

      const handler = compose(withErrorBoundary(errorMiddleware))(() => new Response('OK'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error.code).toBe('INTERNAL_ERROR')
      expect(body.error.message).toBe('An unexpected error occurred')
    })

    it('should not interfere with successful middleware execution', async () => {
      const { withErrorBoundary } = await import('../../src/core/middleware')

      const successMiddleware = createMiddleware(async (ctx, next) => {
        return next()
      })

      const handler = compose(withErrorBoundary(successMiddleware))(() => new Response('Success'))
      const response = await handler(createMockContext())

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Success')
    })
  })
})
