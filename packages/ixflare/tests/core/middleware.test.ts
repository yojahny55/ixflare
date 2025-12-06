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
  })
})
