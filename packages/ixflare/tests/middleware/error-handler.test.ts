import { describe, it, expect, vi } from 'vitest'
import { errorHandler } from '@/middleware/error-handler'
import {
  AppError,
  AuthError,
  ValidationError,
  NotFoundError,
  HttpError,
} from '@/errors'
import { createEdgeContext } from '@/types'
import type { EdgeContext } from '@/types'

describe('errorHandler middleware', () => {
  const mockRequest = () => new Request('https://example.com/')

  const mockContext = (request: Request, requestId?: string): EdgeContext => {
    const ctx = createEdgeContext(request, {} as any, {})
    if (requestId) {
      ctx.requestId = requestId
    }
    return ctx
  }

  it('should catch and format AppError', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new AppError('TEST_ERROR', 'Test error message', 400)
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message',
        status: 400,
        timestamp: expect.any(Number),
      },
    })
  })

  it('should catch and format AuthError with 401 status', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new AuthError('TOKEN_EXPIRED', 'Session has expired')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toMatchObject({
      code: 'AUTH.TOKEN_EXPIRED',
      message: 'Session has expired',
      status: 401,
    })
  })

  it('should catch and format ValidationError with 422 status', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new ValidationError('Invalid input', [
        { field: 'email', message: 'Invalid email format' },
      ])
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatchObject({
      code: 'VALIDATION.FAILED',
      status: 422,
    })
  })

  it('should catch and format NotFoundError with 404 status', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new NotFoundError('User', '123')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.status).toBe(404)
  })

  it('should catch and format HttpError with custom status', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      status: 429,
    })
  })

  it('should sanitize unexpected errors to 500', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new Error('Unexpected internal error')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: expect.any(Number),
      },
    })
    expect(body.error).not.toHaveProperty('stack')
  })

  it('should include stack trace when configured', async () => {
    const middleware = errorHandler({ includeStackTrace: true })
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new Error('Test error with stack')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(body.error).toHaveProperty('stack')
    expect(typeof body.error.stack).toBe('string')
  })

  it('should include requestId as rayId when available', async () => {
    const middleware = errorHandler()
    const requestId = 'test-request-id-12345'
    const request = mockRequest()
    const ctx = mockContext(request, requestId)

    const next = vi.fn(async () => {
      throw new AppError('TEST_ERROR', 'Test message')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(body.error.rayId).toBe(requestId)
  })

  it('should call custom logger when provided', async () => {
    const logger = vi.fn()
    const middleware = errorHandler({ logger })
    const request = mockRequest()
    const ctx = mockContext(request)

    const error = new Error('Test error')
    const next = vi.fn(async () => {
      throw error
    })

    await middleware(ctx, next)

    expect(logger).toHaveBeenCalledWith(error, ctx)
  })

  it('should use default console.error logger', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new Error('Test error')
    })

    await middleware(ctx, next)

    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should use custom error handler when provided', async () => {
    const customResponse = new Response('Custom error response', { status: 503 })
    const onError = vi.fn(() => customResponse)
    const middleware = errorHandler({ onError })

    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new Error('Test error')
    })

    const response = await middleware(ctx, next)

    expect(onError).toHaveBeenCalled()
    expect(response).toBe(customResponse)
  })

  it('should continue with default handling if custom handler returns void', async () => {
    const onError = vi.fn(() => undefined)
    const middleware = errorHandler({ onError })

    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new AppError('TEST_ERROR', 'Test message', 400)
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(onError).toHaveBeenCalled()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('TEST_ERROR')
  })

  it('should pass through successful responses', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const successResponse = new Response('Success', { status: 200 })
    const next = vi.fn(async () => successResponse)

    const response = await middleware(ctx, next)

    expect(response).toBe(successResponse)
    expect(response.status).toBe(200)
  })

  it('should include timestamp in all error responses', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new AppError('TEST_ERROR', 'Test message')
    })

    const before = Date.now()
    const response = await middleware(ctx, next)
    const after = Date.now()

    const body = await response.json()

    expect(body.error.timestamp).toBeGreaterThanOrEqual(before)
    expect(body.error.timestamp).toBeLessThanOrEqual(after)
  })

  it('should handle errors thrown as non-Error objects', async () => {
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      // biome-ignore lint/complexity/noThrowLiterals: testing error handling
      throw 'String error'
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('should use custom requestIdHeader when configured', async () => {
    const middleware = errorHandler({ requestIdHeader: 'X-Correlation-ID' })
    const requestId = 'custom-correlation-id'
    const request = mockRequest()
    const ctx = mockContext(request, requestId)

    const next = vi.fn(async () => {
      throw new AppError('TEST_ERROR', 'Test message')
    })

    const response = await middleware(ctx, next)

    expect(response.headers.get('X-Correlation-ID')).toBe(requestId)
    expect(response.headers.get('X-Request-ID')).toBeNull()
  })

  it('should catch and format ForbiddenError with 403 status', async () => {
    const { ForbiddenError } = await import('@/errors')
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new ForbiddenError('Access denied to resource')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    })
  })

  it('should catch and format ConflictError with 409 status', async () => {
    const { ConflictError } = await import('@/errors')
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new ConflictError('Resource already exists')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Resource already exists',
      status: 409,
    })
  })

  it('should catch and format InfraError with 500 status', async () => {
    const { InfraError } = await import('@/errors')
    const middleware = errorHandler()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      throw new InfraError('DB_CONNECT', 'Database connection failed')
    })

    const response = await middleware(ctx, next)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatchObject({
      code: 'INFRA.DB_CONNECT',
      message: 'Database connection failed',
      status: 500,
    })
  })
})
