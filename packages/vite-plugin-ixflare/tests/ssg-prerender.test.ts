/**
 * @module ssg-prerender.test
 * @description Tests for SSG build-time pre-rendering utilities
 */

import { describe, it, expect } from 'vitest'
import { identifySSGRoutes, resolveRoutePath, routePathToOutputFile } from '../src/ssg-prerender'
import type { Route } from '../src/router-codegen'

describe('SSG Prerender', () => {
  describe('identifySSGRoutes', () => {
    it('should identify routes with rendering: ssg', () => {
      const routes: Route[] = [
        {
          path: '/blog',
          file: 'blog.tsx',
          params: [],
          handlers: ['GET'],
          config: { rendering: 'ssg' },
        },
        {
          path: '/api',
          file: 'api.ts',
          params: [],
          handlers: ['GET'],
          config: { rendering: 'ssr' },
        },
        {
          path: '/app',
          file: 'app.tsx',
          params: [],
          handlers: ['GET'],
          config: { rendering: 'csr' },
        },
        {
          path: '/docs',
          file: 'docs.tsx',
          params: [],
          handlers: ['GET'],
          config: { rendering: 'ssg', revalidate: 3600 },
        },
      ]

      const ssgRoutes = identifySSGRoutes(routes)

      expect(ssgRoutes).toHaveLength(2)
      expect(ssgRoutes[0].path).toBe('/blog')
      expect(ssgRoutes[1].path).toBe('/docs')
    })

    it('should return empty array when no SSG routes', () => {
      const routes: Route[] = [
        {
          path: '/api',
          file: 'api.ts',
          params: [],
          handlers: ['GET'],
          config: { rendering: 'ssr' },
        },
        {
          path: '/app',
          file: 'app.tsx',
          params: [],
          handlers: ['GET'],
          config: { rendering: 'csr' },
        },
      ]

      const ssgRoutes = identifySSGRoutes(routes)

      expect(ssgRoutes).toHaveLength(0)
    })

    it('should handle routes without config', () => {
      const routes: Route[] = [{ path: '/page', file: 'page.tsx', params: [], handlers: ['GET'] }]

      const ssgRoutes = identifySSGRoutes(routes)

      expect(ssgRoutes).toHaveLength(0)
    })
  })

  describe('resolveRoutePath', () => {
    it('should resolve route path with single param', () => {
      const resolved = resolveRoutePath('/blog/:slug', { slug: 'hello-world' })

      expect(resolved).toBe('/blog/hello-world')
    })

    it('should resolve route path with multiple params', () => {
      const resolved = resolveRoutePath('/blog/:year/:month/:slug', {
        year: '2024',
        month: '12',
        slug: 'hello',
      })

      expect(resolved).toBe('/blog/2024/12/hello')
    })

    it('should resolve catch-all route', () => {
      const resolved = resolveRoutePath('/docs/*', { path: 'getting-started/intro' })

      expect(resolved).toBe('/docs/getting-started/intro')
    })

    it('should return unchanged path when no params', () => {
      const resolved = resolveRoutePath('/about', {})

      expect(resolved).toBe('/about')
    })
  })

  describe('routePathToOutputFile', () => {
    it('should convert root path to index.html', () => {
      const output = routePathToOutputFile('/')

      expect(output).toBe('index.html')
    })

    it('should convert simple path to .html file', () => {
      const output = routePathToOutputFile('/about')

      expect(output).toBe('about.html')
    })

    it('should convert nested path to nested .html file', () => {
      const output = routePathToOutputFile('/blog/hello-world')

      expect(output).toBe('blog/hello-world.html')
    })

    it('should handle trailing slash with index.html', () => {
      const output = routePathToOutputFile('/blog/')

      expect(output).toBe('blog/index.html')
    })

    it('should handle deeply nested paths', () => {
      const output = routePathToOutputFile('/docs/getting-started/installation')

      expect(output).toBe('docs/getting-started/installation.html')
    })
  })
})
