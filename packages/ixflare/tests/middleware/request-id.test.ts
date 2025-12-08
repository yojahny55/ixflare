import { describe, it, expect, vi } from 'vitest'
import { requestId } from '@/middleware/request-id'
import { createEdgeContext } from '@/types'
import type { EdgeContext } from '@/types'

describe('requestId middleware', () => {
  const mockRequest = (headers: Record<string, string> = {}) =>
    new Request('https://example.com/', { headers })

  const mockContext = (request: Request): EdgeContext => {
    return createEdgeContext(request, {} as any, {})
  }

  it('should generate a new request ID if not present', async () => {
    const middleware = requestId()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(ctx.requestId).toBeDefined()
    expect(typeof ctx.requestId).toBe('string')
    expect(ctx.requestId?.length).toBeGreaterThan(0)
  })

  it('should use existing request ID from header', async () => {
    const middleware = requestId()
    const existingId = 'existing-id-12345'
    const request = mockRequest({ 'X-Request-ID': existingId })
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(ctx.requestId).toBe(existingId)
  })

  it('should add request ID to response headers', async () => {
    const middleware = requestId()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    const response = await middleware(ctx, next)

    expect(response.headers.get('X-Request-ID')).toBe(ctx.requestId)
  })

  it('should use custom header name when configured', async () => {
    const middleware = requestId({ header: 'X-Correlation-ID' })
    const existingId = 'correlation-12345'
    const request = mockRequest({ 'X-Correlation-ID': existingId })
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    const response = await middleware(ctx, next)

    expect(ctx.requestId).toBe(existingId)
    expect(response.headers.get('X-Correlation-ID')).toBe(existingId)
  })

  it('should use custom generator when configured', async () => {
    const customId = 'custom-generated-id'
    const generator = vi.fn(() => customId)
    const middleware = requestId({ generator })

    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(generator).toHaveBeenCalled()
    expect(ctx.requestId).toBe(customId)
  })

  it('should not call generator if ID already in header', async () => {
    const generator = vi.fn(() => 'generated-id')
    const middleware = requestId({ generator })

    const existingId = 'existing-id'
    const request = mockRequest({ 'X-Request-ID': existingId })
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(generator).not.toHaveBeenCalled()
    expect(ctx.requestId).toBe(existingId)
  })

  it('should call next middleware with context containing requestId', async () => {
    const middleware = requestId()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      expect(ctx.requestId).toBeDefined()
      return new Response('test')
    })

    await middleware(ctx, next)

    expect(next).toHaveBeenCalled()
  })

  it('should preserve existing response headers', async () => {
    const middleware = requestId()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(
      async () =>
        new Response('test', {
          headers: { 'Content-Type': 'application/json' },
        })
    )

    const response = await middleware(ctx, next)

    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('X-Request-ID')).toBe(ctx.requestId)
  })

  it('should generate RFC 4122 compliant UUID by default', async () => {
    const middleware = requestId()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(ctx.requestId).toMatch(uuidRegex)
  })

  it('should work with multiple calls (unique IDs)', async () => {
    const middleware = requestId()

    const request1 = mockRequest()
    const ctx1 = mockContext(request1)
    const next1 = vi.fn(async () => new Response('test'))
    await middleware(ctx1, next1)

    const request2 = mockRequest()
    const ctx2 = mockContext(request2)
    const next2 = vi.fn(async () => new Response('test'))
    await middleware(ctx2, next2)

    expect(ctx1.requestId).not.toBe(ctx2.requestId)
  })
})
