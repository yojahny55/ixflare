import { describe, it, expect, vi } from 'vitest'
import { timing } from '@/middleware/timing'
import { createEdgeContext } from '@/types'
import type { EdgeContext } from '@/types'

describe('timing middleware', () => {
  const mockRequest = () => new Request('https://example.com/')

  const mockContext = (request: Request): EdgeContext => {
    return createEdgeContext(request, {} as any, {})
  }

  it('should add X-Response-Time header to response', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    const response = await middleware(ctx, next)

    expect(response.headers.has('X-Response-Time')).toBe(true)
    expect(response.headers.get('X-Response-Time')).toMatch(/^\d+ms$/)
  })

  it('should use custom header name when configured', async () => {
    const middleware = timing({ header: 'X-Processing-Time' })
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    const response = await middleware(ctx, next)

    expect(response.headers.has('X-Processing-Time')).toBe(true)
    expect(response.headers.get('X-Processing-Time')).toMatch(/^\d+ms$/)
  })

  it('should measure actual processing time', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response('test')
    })

    const response = await middleware(ctx, next)
    const timeHeader = response.headers.get('X-Response-Time')
    const duration = Number.parseInt(timeHeader?.replace('ms', '') ?? '0')

    // Allow slight variance in timing (8-12ms is acceptable for 10ms sleep)
    expect(duration).toBeGreaterThanOrEqual(8)
  })

  it('should preserve existing response headers', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(
      async () =>
        new Response('test', {
          headers: {
            'Content-Type': 'application/json',
            'X-Custom': 'value',
          },
        })
    )

    const response = await middleware(ctx, next)

    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('X-Custom')).toBe('value')
    expect(response.headers.get('X-Response-Time')).toMatch(/^\d+ms$/)
  })

  it('should preserve response body', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const body = JSON.stringify({ message: 'test' })
    const next = vi.fn(async () => new Response(body))

    const response = await middleware(ctx, next)
    const responseBody = await response.text()

    expect(responseBody).toBe(body)
  })

  it('should preserve response status', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test', { status: 201 }))

    const response = await middleware(ctx, next)

    expect(response.status).toBe(201)
  })

  it('should call next middleware', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    await middleware(ctx, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should measure time for fast responses (< 1ms)', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))

    const response = await middleware(ctx, next)
    const timeHeader = response.headers.get('X-Response-Time')

    expect(timeHeader).toMatch(/^\d+ms$/)
    expect(Number.parseInt(timeHeader?.replace('ms', '') ?? '0')).toBeGreaterThanOrEqual(0)
  })

  it('should work with different response types', async () => {
    const middleware = timing()

    // JSON response
    const jsonRequest = mockRequest()
    const jsonCtx = mockContext(jsonRequest)
    const jsonNext = vi.fn(async () => Response.json({ data: 'test' }))
    const jsonResponse = await middleware(jsonCtx, jsonNext)
    expect(jsonResponse.headers.has('X-Response-Time')).toBe(true)

    // Text response
    const textRequest = mockRequest()
    const textCtx = mockContext(textRequest)
    const textNext = vi.fn(async () => new Response('plain text'))
    const textResponse = await middleware(textCtx, textNext)
    expect(textResponse.headers.has('X-Response-Time')).toBe(true)

    // Empty response
    const emptyRequest = mockRequest()
    const emptyCtx = mockContext(emptyRequest)
    const emptyNext = vi.fn(async () => new Response(null))
    const emptyResponse = await middleware(emptyCtx, emptyNext)
    expect(emptyResponse.headers.has('X-Response-Time')).toBe(true)
  })

  it('should format timing value correctly', async () => {
    const middleware = timing()
    const request = mockRequest()
    const ctx = mockContext(request)

    const next = vi.fn(async () => new Response('test'))
    const response = await middleware(ctx, next)

    const timeHeader = response.headers.get('X-Response-Time')
    expect(timeHeader).toMatch(/^\d+ms$/)

    // Ensure it's a valid number
    const duration = Number.parseInt(timeHeader?.replace('ms', '') ?? '')
    expect(Number.isNaN(duration)).toBe(false)
    expect(duration).toBeGreaterThanOrEqual(0)
  })
})
