/**
 * @fileoverview Tests for HTTP method-based routing
 */

// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect, beforeEach } from 'vitest'
import { Router } from '../../src/core/router'
import type { EdgeContext } from '../../src/types/context'

describe('Method-based routing', () => {
  let router: Router
  const mockEnv = {}
  const mockCtx = {} as ExecutionContext

  beforeEach(() => {
    router = new Router()
  })

  describe('Method handler selection', () => {
    it('should call GET handler for GET requests', async () => {
      let called = false
      const getHandler = async (ctx: EdgeContext) => {
        called = true
        return new Response(JSON.stringify({ method: 'GET' }))
      }

      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'GET' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(called).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should call POST handler for POST requests', async () => {
      let called = false
      const postHandler = async (ctx: EdgeContext) => {
        called = true
        return new Response(JSON.stringify({ method: 'POST' }), { status: 201 })
      }

      router.add('/users', postHandler, { methods: ['POST'] })

      const request = new Request('http://localhost/users', { method: 'POST' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(called).toBe(true)
      expect(response.status).toBe(201)
    })

    it('should support multiple methods on same route', async () => {
      const getHandler = async () => new Response(JSON.stringify({ method: 'GET' }))
      const postHandler = async () => new Response(JSON.stringify({ method: 'POST' }))

      router.add('/users', getHandler, { methods: ['GET'] })
      router.add('/users', postHandler, { methods: ['POST'] })

      const getRequest = new Request('http://localhost/users', { method: 'GET' })
      const getResponse = await router.handle(getRequest, mockEnv, mockCtx)
      const getData = await getResponse.json()
      expect(getData).toEqual({ method: 'GET' })

      const postRequest = new Request('http://localhost/users', { method: 'POST' })
      const postResponse = await router.handle(postRequest, mockEnv, mockCtx)
      const postData = await postResponse.json()
      expect(postData).toEqual({ method: 'POST' })
    })

    it('should support all standard HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

      for (const method of methods) {
        const handler = async () => new Response(JSON.stringify({ method }))
        router.add(`/${method.toLowerCase()}`, handler, { methods: [method] })
      }

      for (const method of methods) {
        const request = new Request(`http://localhost/${method.toLowerCase()}`, { method })
        const response = await router.handle(request, mockEnv, mockCtx)
        const data = await response.json()
        expect(data).toEqual({ method })
      }
    })

    it('should normalize method names to uppercase', async () => {
      const getHandler = async () => new Response(JSON.stringify({ method: 'GET' }))
      router.add('/users', getHandler, { methods: ['GET'] })

      // Standard GET should work
      const getRequest = new Request('http://localhost/users', { method: 'GET' })
      const getResponse = await router.handle(getRequest, mockEnv, mockCtx)
      expect(getResponse.status).toBe(200)

      // Lowercase 'get' gets normalized to 'GET' by Request constructor and our router
      // This matches HTTP spec behavior where methods are case-sensitive but typically uppercase
      const lowercaseRequest = new Request('http://localhost/users', { method: 'get' } as any)
      const lowercaseResponse = await router.handle(lowercaseRequest, mockEnv, mockCtx)
      // Should work because we normalize to uppercase
      expect(lowercaseResponse.status).toBe(200)
    })

    it('should pass EdgeContext with all required fields to handler', async () => {
      let capturedContext: EdgeContext | null = null
      const handler = async (ctx: EdgeContext) => {
        capturedContext = ctx
        return new Response('OK')
      }

      router.add('/users/:id', handler, { methods: ['GET'] })

      const request = new Request('http://localhost/users/123?filter=active', { method: 'GET' })
      await router.handle(request, mockEnv, mockCtx)

      expect(capturedContext).not.toBeNull()
      expect(capturedContext!.request).toBe(request)
      expect(capturedContext!.env).toBe(mockEnv)
      expect(capturedContext!.ctx).toBe(mockCtx)
      expect(capturedContext!.params).toEqual({ id: '123' })
      expect(capturedContext!.query.get('filter')).toBe('active')
      expect(capturedContext!.url.pathname).toBe('/users/123')
      expect(capturedContext!.method).toBe('GET')
      expect(capturedContext!.headers).toBe(request.headers)
    })
  })

  describe('405 Method Not Allowed', () => {
    it('should return 405 when method not supported', async () => {
      const getHandler = async () => new Response('OK')
      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'DELETE' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.status).toBe(405)
    })

    it('should include Allow header with supported methods', async () => {
      const getHandler = async () => new Response('OK')
      const postHandler = async () => new Response('OK')

      router.add('/users', getHandler, { methods: ['GET'] })
      router.add('/users', postHandler, { methods: ['POST'] })

      const request = new Request('http://localhost/users', { method: 'DELETE' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.status).toBe(405)
      expect(response.headers.get('Allow')).toContain('GET')
      expect(response.headers.get('Allow')).toContain('POST')
    })

    it('should return proper error body structure', async () => {
      const getHandler = async () => new Response('OK')
      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'DELETE' })
      const response = await router.handle(request, mockEnv, mockCtx)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('code', 'ROUTING.METHOD_NOT_ALLOWED')
      expect(data.error).toHaveProperty('message')
      expect(data.error.message).toContain('DELETE')
      expect(data.error).toHaveProperty('status', 405)
      expect(data.error).toHaveProperty('timestamp')
    })

    it('should include HEAD and OPTIONS in Allow header when auto-generated', async () => {
      const getHandler = async () => new Response('OK')
      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'DELETE' })
      const response = await router.handle(request, mockEnv, mockCtx)

      const allow = response.headers.get('Allow')
      expect(allow).toContain('GET')
      expect(allow).toContain('HEAD')
      expect(allow).toContain('OPTIONS')
    })
  })

  describe('Automatic HEAD handler', () => {
    it('should auto-generate HEAD handler for GET routes', async () => {
      const getHandler = async () => new Response(JSON.stringify({ data: 'test' }), {
        headers: { 'X-Custom': 'value' }
      })

      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'HEAD' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Custom')).toBe('value')

      // Body should be empty for HEAD
      const text = await response.text()
      expect(text).toBe('')
    })

    it('should use explicit HEAD handler if provided', async () => {
      const getHandler = async () => new Response(JSON.stringify({ method: 'GET' }))
      const headHandler = async () => new Response(null, {
        status: 200,
        headers: { 'X-Explicit-HEAD': 'true' }
      })

      router.add('/users', getHandler, { methods: ['GET'] })
      router.add('/users', headHandler, { methods: ['HEAD'] })

      const request = new Request('http://localhost/users', { method: 'HEAD' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.headers.get('X-Explicit-HEAD')).toBe('true')
    })

    it('should preserve all headers from GET response in HEAD', async () => {
      const getHandler = async () => new Response('body', {
        headers: {
          'Content-Type': 'text/plain',
          'X-Custom-1': 'value1',
          'X-Custom-2': 'value2',
        }
      })

      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'HEAD' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.headers.get('Content-Type')).toBe('text/plain')
      expect(response.headers.get('X-Custom-1')).toBe('value1')
      expect(response.headers.get('X-Custom-2')).toBe('value2')
    })

    it('should not auto-generate HEAD for routes without GET', async () => {
      const postHandler = async () => new Response('OK')
      router.add('/users', postHandler, { methods: ['POST'] })

      const request = new Request('http://localhost/users', { method: 'HEAD' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.status).toBe(405)
    })
  })

  describe('Automatic OPTIONS handler', () => {
    it('should auto-generate OPTIONS handler', async () => {
      const getHandler = async () => new Response('OK')
      const postHandler = async () => new Response('OK')

      router.add('/users', getHandler, { methods: ['GET'] })
      router.add('/users', postHandler, { methods: ['POST'] })

      const request = new Request('http://localhost/users', { method: 'OPTIONS' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.status).toBe(204)
      const allow = response.headers.get('Allow')
      expect(allow).toContain('GET')
      expect(allow).toContain('POST')
      expect(allow).toContain('HEAD')
      expect(allow).toContain('OPTIONS')
    })

    it('should use explicit OPTIONS handler if provided', async () => {
      const getHandler = async () => new Response('OK')
      const optionsHandler = async () => new Response(null, {
        status: 200,
        headers: { 'X-Explicit-OPTIONS': 'true' }
      })

      router.add('/users', getHandler, { methods: ['GET'] })
      router.add('/users', optionsHandler, { methods: ['OPTIONS'] })

      const request = new Request('http://localhost/users', { method: 'OPTIONS' })
      const response = await router.handle(request, mockEnv, mockCtx)

      expect(response.headers.get('X-Explicit-OPTIONS')).toBe('true')
    })

    it('should return empty body for OPTIONS', async () => {
      const getHandler = async () => new Response('OK')
      router.add('/users', getHandler, { methods: ['GET'] })

      const request = new Request('http://localhost/users', { method: 'OPTIONS' })
      const response = await router.handle(request, mockEnv, mockCtx)

      const text = await response.text()
      expect(text).toBe('')
    })
  })
})
