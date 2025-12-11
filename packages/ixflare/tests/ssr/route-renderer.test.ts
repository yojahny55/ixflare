/**
 * @module ssr/route-renderer.test
 * @description Tests for strategy-based route rendering
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import { generateCacheHeaders, renderSSR, renderWithStrategy } from '@/ssr/route-renderer'
import type { RouteConfig } from '@/ssr/types'

// Simple test component
function TestApp({ message }: { message: string }) {
  return React.createElement('div', { id: 'app' }, message)
}

describe('Route Renderer', () => {
  describe('generateCacheHeaders', () => {
    it('should generate headers with maxAge only', () => {
      const headers = generateCacheHeaders({ maxAge: 60 })

      expect(headers['Cache-Control']).toBe('public, max-age=60')
    })

    it('should generate headers with staleWhileRevalidate only', () => {
      const headers = generateCacheHeaders({ staleWhileRevalidate: 300 })

      expect(headers['Cache-Control']).toBe('public, stale-while-revalidate=300')
    })

    it('should generate headers with both maxAge and staleWhileRevalidate', () => {
      const headers = generateCacheHeaders({
        maxAge: 60,
        staleWhileRevalidate: 300,
      })

      expect(headers['Cache-Control']).toBe('public, max-age=60, stale-while-revalidate=300')
    })

    it('should handle empty config with public directive', () => {
      const headers = generateCacheHeaders({})

      expect(headers['Cache-Control']).toBe('public')
    })

    it('should handle zero values', () => {
      const headers = generateCacheHeaders({
        maxAge: 0,
        staleWhileRevalidate: 0,
      })

      expect(headers['Cache-Control']).toBe('public, max-age=0, stale-while-revalidate=0')
    })

    it('should ignore negative values', () => {
      const headers = generateCacheHeaders({
        maxAge: -1,
        staleWhileRevalidate: -1,
      })

      expect(headers['Cache-Control']).toBe('public')
    })
  })

  describe('renderSSR', () => {
    it('should render with SSR strategy (string mode)', async () => {
      const component = React.createElement(TestApp, { message: 'Hello SSR' })
      const response = await renderSSR(component, { streaming: false })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')

      const html = await response.text()
      expect(html).toContain('Hello SSR')
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('should render with SSR strategy (streaming mode)', async () => {
      const component = React.createElement(TestApp, { message: 'Hello Streaming' })
      const response = await renderSSR(component, { streaming: true })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(response.body).toBeDefined()

      // Read stream
      const html = await response.text()
      expect(html).toContain('Hello Streaming')
    })

    it('should apply cache headers when config has cache', async () => {
      const component = React.createElement(TestApp, { message: 'Cached' })
      const config: RouteConfig = {
        rendering: 'ssr',
        cache: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      }

      const response = await renderSSR(component, { streaming: false }, config)

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=60, stale-while-revalidate=300'
      )
    })

    it('should not apply cache headers when config has no cache', async () => {
      const component = React.createElement(TestApp, { message: 'No Cache' })
      const config: RouteConfig = {
        rendering: 'ssr',
      }

      const response = await renderSSR(component, { streaming: false }, config)

      expect(response.headers.get('Cache-Control')).toBeNull()
    })

    it('should render with bootstrap data', async () => {
      const component = React.createElement(TestApp, { message: 'Bootstrap Test' })
      const bootstrapData = { user: { id: 1, name: 'Test' } }

      const response = await renderSSR(component, { bootstrapData, streaming: false })

      const html = await response.text()
      expect(html).toContain('Bootstrap Test')
      // Bootstrap data should be safely injected as script
      expect(html).toContain('__BOOTSTRAP_DATA__')
    })

    it('should render with custom title and meta', async () => {
      const component = React.createElement(TestApp, { message: 'Meta Test' })

      const response = await renderSSR(component, {
        streaming: false,
        title: 'Test Page',
        meta: { description: 'A test page' },
      })

      const html = await response.text()
      expect(html).toContain('<title>Test Page</title>')
      expect(html).toContain('name="description"')
      expect(html).toContain('content="A test page"')
    })
  })

  describe('renderWithStrategy', () => {
    it('should use SSR strategy by default', async () => {
      const component = React.createElement(TestApp, { message: 'Default Strategy' })

      const response = await renderWithStrategy(component, { streaming: false })

      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('Default Strategy')
    })

    it('should use SSR strategy when explicitly specified', async () => {
      const component = React.createElement(TestApp, { message: 'Explicit SSR' })
      const config: RouteConfig = { rendering: 'ssr' }

      const response = await renderWithStrategy(component, { streaming: false }, config)

      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('Explicit SSR')
    })

    it('should apply cache headers with SSR config', async () => {
      const component = React.createElement(TestApp, { message: 'SSR Cached' })
      const config: RouteConfig = {
        rendering: 'ssr',
        cache: { maxAge: 60 },
      }

      const response = await renderWithStrategy(component, { streaming: false }, config)

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
    })

    it('should throw error for CSR strategy', async () => {
      const component = React.createElement(TestApp, { message: 'CSR' })
      const config: RouteConfig = { rendering: 'csr' }

      await expect(renderWithStrategy(component, {}, config)).rejects.toThrow(
        /CSR rendering should be handled by CSR shell generator/
      )
    })

    it('should throw error for SSG strategy', async () => {
      const component = React.createElement(TestApp, { message: 'SSG' })
      const config: RouteConfig = { rendering: 'ssg' }

      await expect(renderWithStrategy(component, {}, config)).rejects.toThrow(
        /SSG rendering should be handled at build time/
      )
    })

    it('should work with streaming enabled', async () => {
      const component = React.createElement(TestApp, { message: 'Streaming Strategy' })
      const config: RouteConfig = { rendering: 'ssr' }

      const response = await renderWithStrategy(component, { streaming: true }, config)

      expect(response.status).toBe(200)
      expect(response.body).toBeDefined()
    })

    it('should combine streaming and cache headers', async () => {
      const component = React.createElement(TestApp, { message: 'Stream + Cache' })
      const config: RouteConfig = {
        rendering: 'ssr',
        cache: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      }

      const response = await renderWithStrategy(component, { streaming: true }, config)

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=60, stale-while-revalidate=300'
      )
    })
  })
})
