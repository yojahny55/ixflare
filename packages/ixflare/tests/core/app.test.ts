/**
 * Tests for App module - runtime middleware wiring from config to router
 */

// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect } from 'vitest'
import { createApp, App } from '../../src/core/app'
import { createMiddleware } from '../../src/core/middleware'

describe('App', () => {
  describe('createApp', () => {
    it('should create an app instance', () => {
      const app = createApp()
      expect(app).toBeInstanceOf(App)
    })

    it('should create app with global middleware from config', () => {
      const middleware1 = createMiddleware(async (ctx, next) => next())
      const middleware2 = createMiddleware(async (ctx, next) => next())

      const app = createApp({
        middleware: [middleware1, middleware2],
      })

      expect(app.getGlobalMiddleware()).toHaveLength(2)
    })

    it('should handle empty middleware array', () => {
      const app = createApp({ middleware: [] })
      expect(app.getGlobalMiddleware()).toHaveLength(0)
    })
  })

  describe('route registration', () => {
    it('should register a route and handle requests', async () => {
      const app = createApp()

      app.route('/test', () => new Response('OK'))

      const request = new Request('http://localhost/test')
      const response = await app.handle(request, {})

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('OK')
    })

    it('should return 404 for unregistered routes', async () => {
      const app = createApp()

      const request = new Request('http://localhost/unknown')
      const response = await app.handle(request, {})

      expect(response.status).toBe(404)
    })

    it('should support method chaining for route registration', () => {
      const app = createApp()

      const result = app
        .route('/a', () => new Response('A'))
        .route('/b', () => new Response('B'))
        .route('/c', () => new Response('C'))

      expect(result).toBe(app)
    })
  })

  describe('global middleware integration', () => {
    it('should apply global middleware to all routes', async () => {
      const calls: string[] = []

      const globalLogging = createMiddleware(async (ctx, next) => {
        calls.push('global-logging')
        return next()
      })

      const globalCors = createMiddleware(async (ctx, next) => {
        calls.push('global-cors')
        const response = await next()
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      })

      const app = createApp({
        middleware: [globalLogging, globalCors],
      })

      app.route('/api/users', () => {
        calls.push('handler')
        return new Response('users')
      })

      const request = new Request('http://localhost/api/users')
      const response = await app.handle(request, {})

      expect(calls).toEqual(['global-logging', 'global-cors', 'handler'])
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('should apply global middleware before directory middleware', async () => {
      const calls: string[] = []

      const globalMiddleware = createMiddleware(async (ctx, next) => {
        calls.push('global')
        return next()
      })

      const directoryMiddleware = createMiddleware(async (ctx, next) => {
        calls.push('directory')
        return next()
      })

      const app = createApp({
        middleware: [globalMiddleware],
      })

      app.route(
        '/api/users',
        () => {
          calls.push('handler')
          return new Response('users')
        },
        {
          directoryMiddleware: [directoryMiddleware],
        }
      )

      const request = new Request('http://localhost/api/users')
      await app.handle(request, {})

      expect(calls).toEqual(['global', 'directory', 'handler'])
    })

    it('should apply full middleware chain: global → directory → route', async () => {
      const calls: string[] = []

      const globalMiddleware = createMiddleware(async (ctx, next) => {
        calls.push('global')
        return next()
      })

      const directoryMiddleware = createMiddleware(async (ctx, next) => {
        calls.push('directory')
        return next()
      })

      const routeMiddleware = createMiddleware(async (ctx, next) => {
        calls.push('route')
        return next()
      })

      const app = createApp({
        middleware: [globalMiddleware],
      })

      app.route(
        '/test',
        () => {
          calls.push('handler')
          return new Response('OK')
        },
        {
          directoryMiddleware: [directoryMiddleware],
          routeMiddleware: [routeMiddleware],
        }
      )

      const request = new Request('http://localhost/test')
      await app.handle(request, {})

      expect(calls).toEqual(['global', 'directory', 'route', 'handler'])
    })

    it('should apply same global middleware to different routes', async () => {
      const routesCalled: string[] = []

      const globalMiddleware = createMiddleware(async (ctx, next) => {
        routesCalled.push('global')
        return next()
      })

      const app = createApp({
        middleware: [globalMiddleware],
      })

      app.route('/api/users', () => {
        routesCalled.push('/api/users')
        return new Response('users')
      })

      app.route('/api/posts', () => {
        routesCalled.push('/api/posts')
        return new Response('posts')
      })

      // First request
      await app.handle(new Request('http://localhost/api/users'), {})
      expect(routesCalled).toEqual(['global', '/api/users'])

      // Reset
      routesCalled.length = 0

      // Second request to different route
      await app.handle(new Request('http://localhost/api/posts'), {})
      expect(routesCalled).toEqual(['global', '/api/posts'])
    })
  })

  describe('config-like usage pattern', () => {
    it('should work with config object pattern (simulating edge.config.ts)', async () => {
      // This simulates what a real edge.config.ts + worker entry would look like
      const calls: string[] = []

      // Simulate edge.config.ts
      const config = {
        name: 'my-app',
        middleware: [
          createMiddleware(async (ctx, next) => {
            calls.push('logging')
            return next()
          }),
          createMiddleware(async (ctx, next) => {
            calls.push('cors')
            const response = await next()
            response.headers.set('Access-Control-Allow-Origin', '*')
            return response
          }),
        ],
      }

      // Create app with config middleware
      const app = createApp({
        middleware: config.middleware,
      })

      // Register routes (would be auto-generated from file system in real app)
      app.route('/api/users', () => {
        calls.push('users-handler')
        return new Response('users')
      })

      // Handle request
      const request = new Request('http://localhost/api/users')
      const response = await app.handle(request, {})

      expect(calls).toEqual(['logging', 'cors', 'users-handler'])
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('middleware onion model', () => {
    it('should execute middleware in onion model (before → handler → after)', async () => {
      const calls: string[] = []

      const middleware1 = createMiddleware(async (ctx, next) => {
        calls.push('m1-before')
        const response = await next()
        calls.push('m1-after')
        return response
      })

      const middleware2 = createMiddleware(async (ctx, next) => {
        calls.push('m2-before')
        const response = await next()
        calls.push('m2-after')
        return response
      })

      const app = createApp({
        middleware: [middleware1, middleware2],
      })

      app.route('/test', () => {
        calls.push('handler')
        return new Response('OK')
      })

      await app.handle(new Request('http://localhost/test'), {})

      expect(calls).toEqual(['m1-before', 'm2-before', 'handler', 'm2-after', 'm1-after'])
    })
  })

  describe('middleware short-circuit', () => {
    it('should allow global middleware to short-circuit and skip handler', async () => {
      const calls: string[] = []

      const authMiddleware = createMiddleware(async (ctx, next) => {
        calls.push('auth-check')
        const token = ctx.headers.get('Authorization')
        if (!token) {
          calls.push('auth-denied')
          return new Response('Unauthorized', { status: 401 })
        }
        calls.push('auth-passed')
        return next()
      })

      const app = createApp({
        middleware: [authMiddleware],
      })

      app.route('/protected', () => {
        calls.push('handler')
        return new Response('Protected resource')
      })

      // Request without auth
      const requestNoAuth = new Request('http://localhost/protected')
      const responseNoAuth = await app.handle(requestNoAuth, {})

      expect(responseNoAuth.status).toBe(401)
      expect(calls).toEqual(['auth-check', 'auth-denied'])

      // Reset
      calls.length = 0

      // Request with auth
      const requestWithAuth = new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer token123' },
      })
      const responseWithAuth = await app.handle(requestWithAuth, {})

      expect(responseWithAuth.status).toBe(200)
      expect(calls).toEqual(['auth-check', 'auth-passed', 'handler'])
    })
  })

  describe('getRouter', () => {
    it('should return the underlying router instance', () => {
      const app = createApp()
      const router = app.getRouter()

      expect(router).toBeDefined()
      expect(typeof router.add).toBe('function')
      expect(typeof router.handle).toBe('function')
    })
  })
})
