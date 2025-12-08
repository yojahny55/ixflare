import { describe, it, expect, vi } from 'vitest'
import { logging } from '@/middleware/logging'
import { createEdgeContext } from '@/types'
import type { EdgeContext } from '@/types'

describe('logging middleware', () => {
  const mockRequest = (url: string) => new Request(url)

  const mockContext = (request: Request, requestId?: string): EdgeContext => {
    const ctx = createEdgeContext(request, {} as any, {})
    if (requestId) {
      ctx.requestId = requestId
    }
    return ctx
  }

  it('should log request and response with method, path, status, and duration', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const request = mockRequest('https://example.com/api/users')
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test', { status: 200 }))
    await middleware(ctx, next)

    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger).toHaveBeenNthCalledWith(1, '--> GET /api/users', expect.any(Object))
    expect(logger).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/<-- GET \/api\/users 200 \d+ms/),
      expect.objectContaining({
        status: 200,
        duration: expect.any(Number),
      })
    )
  })

  it('should include request ID in logs when available', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const requestId = 'test-request-id-12345'
    const request = mockRequest('https://example.com/api/users')
    const ctx = mockContext(request, requestId)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(logger).toHaveBeenNthCalledWith(
      1,
      '--> GET /api/users',
      expect.objectContaining({ requestId })
    )
    expect(logger).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ requestId })
    )
  })

  it('should skip excluded paths', async () => {
    const logger = vi.fn()
    const middleware = logging({
      logger,
      excludePaths: ['/health', '/metrics'],
    })

    const request = mockRequest('https://example.com/health')
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('OK'))
    await middleware(ctx, next)

    expect(logger).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('should log paths not in exclude list', async () => {
    const logger = vi.fn()
    const middleware = logging({
      logger,
      excludePaths: ['/health'],
    })

    const request = mockRequest('https://example.com/api/users')
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(logger).toHaveBeenCalledTimes(2)
  })

  it('should include timestamp in log data', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const request = mockRequest('https://example.com/api/users')
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(logger).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ timestamp: expect.any(Number) })
    )
    expect(logger).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ timestamp: expect.any(Number) })
    )
  })

  it('should measure actual request duration', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const request = mockRequest('https://example.com/api/users')
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response('test')
    })

    await middleware(ctx, next)

    const responseLog = logger.mock.calls[1]
    const data = responseLog[1] as Record<string, unknown>
    // Allow slight variance in timing (8-12ms is acceptable for 10ms sleep)
    expect(data.duration).toBeGreaterThanOrEqual(8)
  })

  it('should use console.log by default', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const middleware = logging()

    const request = mockRequest('https://example.com/api/users')
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(consoleSpy).toHaveBeenCalledTimes(2)

    consoleSpy.mockRestore()
  })

  it('should log different HTTP methods correctly', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

    for (const method of methods) {
      logger.mockClear()
      const request = new Request('https://example.com/api/users', { method })
      const ctx = mockContext(request)

      const next = vi.fn(async () => new Response('test'))
      await middleware(ctx, next)

      expect(logger).toHaveBeenNthCalledWith(1, `--> ${method} /api/users`, expect.any(Object))
    }
  })

  it('should log different status codes correctly', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const statuses = [200, 201, 400, 404, 500]

    for (const status of statuses) {
      logger.mockClear()
      const request = mockRequest('https://example.com/api/users')
      const ctx = mockContext(request)

      const next = vi.fn(async () => new Response('test', { status }))
      await middleware(ctx, next)

      expect(logger).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(new RegExp(`<-- GET /api/users ${status} \\d+ms`)),
        expect.objectContaining({ status })
      )
    }
  })

  it('should handle paths with query parameters', async () => {
    const logger = vi.fn()
    const middleware = logging({ logger })

    const request = mockRequest('https://example.com/api/users?page=1&limit=10')
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(logger).toHaveBeenNthCalledWith(1, '--> GET /api/users', expect.any(Object))
  })
})
