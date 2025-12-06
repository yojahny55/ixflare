/**
 * @fileoverview Tests for EdgeContext
 * @worker-only
 */

import { describe, it, expect } from 'vitest'
import { createEdgeContext } from '../../src/types/context'
import type { EdgeContext } from '../../src/types/context'

describe('EdgeContext', () => {
  it('should create EdgeContext with all required properties', () => {
    const request = new Request('https://example.com/users/123?filter=active')
    const env = { DB: {} as D1Database }
    const ctx = {} as ExecutionContext
    const params = { id: '123' }

    const context = createEdgeContext(request, env, ctx, params)

    expect(context.request).toBe(request)
    expect(context.env).toBe(env)
    expect(context.ctx).toBe(ctx)
    expect(context.params).toEqual({ id: '123' })
    expect(context.url.pathname).toBe('/users/123')
    expect(context.query.get('filter')).toBe('active')
    expect(context.method).toBe('GET')
    expect(context.headers).toBe(request.headers)
  })

  it('should parse URL search parameters correctly', () => {
    const request = new Request('https://example.com/search?q=test&page=2')
    const env = {}
    const ctx = {} as ExecutionContext

    const context = createEdgeContext(request, env, ctx)

    expect(context.query.get('q')).toBe('test')
    expect(context.query.get('page')).toBe('2')
  })

  it('should work with empty params', () => {
    const request = new Request('https://example.com/home')
    const env = {}
    const ctx = {} as ExecutionContext

    const context = createEdgeContext(request, env, ctx)

    expect(context.params).toEqual({})
    expect(context.url.pathname).toBe('/home')
  })

  it('should preserve HTTP method', () => {
    const request = new Request('https://example.com/api/users', {
      method: 'POST',
    })
    const env = {}
    const ctx = {} as ExecutionContext

    const context = createEdgeContext(request, env, ctx)

    expect(context.method).toBe('POST')
  })
})
