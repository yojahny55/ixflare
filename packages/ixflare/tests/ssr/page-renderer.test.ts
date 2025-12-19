/**
 * @module ssr/page-renderer.test
 * @description Tests for page rendering with loader integration
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderPage, createPageHandler } from '@/ssr/page-renderer'
import type { EdgeContext } from '@/types/context'

// Simple test page component
interface TestPageData {
  title: string
  count: number
}

function TestPage({ data }: { data: TestPageData }) {
  return React.createElement('div', { id: 'page' }, [
    React.createElement('h1', { key: 'title' }, data.title),
    React.createElement('p', { key: 'count' }, `Count: ${data.count}`),
  ])
}

// Create a mock EdgeContext with loaderData
function createMockContext(loaderData: unknown, params: Record<string, string> = {}): EdgeContext {
  const url = new URL('https://example.com/test')
  return {
    request: new Request(url),
    env: {},
    ctx: {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: {},
    } as ExecutionContext,
    params,
    query: new URLSearchParams(),
    url,
    method: 'GET',
    headers: new Headers(),
    loaderData,
  }
}

describe('Page Renderer', () => {
  describe('renderPage', () => {
    it('should render page with loader data', async () => {
      const loaderData: TestPageData = { title: 'Hello World', count: 42 }
      const context = createMockContext(loaderData)

      const response = await renderPage(TestPage, context)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')

      const html = await response.text()
      expect(html).toContain('Hello World')
      expect(html).toContain('Count: 42')
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('should include bootstrap data for hydration by default', async () => {
      const loaderData: TestPageData = { title: 'Test', count: 1 }
      const context = createMockContext(loaderData, { id: '123' })

      const response = await renderPage(TestPage, context)

      const html = await response.text()
      expect(html).toContain('__BOOTSTRAP_DATA__')
      // Check that loaderData is in bootstrap
      expect(html).toContain('loaderData')
    })

    it('should exclude bootstrap data when hydrateData is false', async () => {
      const loaderData: TestPageData = { title: 'Test', count: 1 }
      const context = createMockContext(loaderData)

      const response = await renderPage(TestPage, context, { hydrateData: false })

      const html = await response.text()
      expect(html).not.toContain('__BOOTSTRAP_DATA__')
    })

    it('should apply cache headers from config', async () => {
      const loaderData: TestPageData = { title: 'Cached', count: 0 }
      const context = createMockContext(loaderData)

      const response = await renderPage(TestPage, context, {
        config: {
          cache: {
            maxAge: 60,
            staleWhileRevalidate: 300,
          },
        },
      })

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=60, stale-while-revalidate=300'
      )
    })

    it('should render with custom title', async () => {
      const loaderData: TestPageData = { title: 'Page Title', count: 5 }
      const context = createMockContext(loaderData)

      const response = await renderPage(TestPage, context, {
        title: 'Custom Title',
      })

      const html = await response.text()
      expect(html).toContain('<title>Custom Title</title>')
    })

    it('should support streaming mode', async () => {
      const loaderData: TestPageData = { title: 'Streaming', count: 10 }
      const context = createMockContext(loaderData)

      const response = await renderPage(TestPage, context, { streaming: true })

      expect(response.status).toBe(200)
      expect(response.body).toBeDefined()

      // Read stream
      const html = await response.text()
      expect(html).toContain('Streaming')
      expect(html).toContain('Count: 10')
    })

    it('should pass params to page component', async () => {
      interface ParamsPageData {
        userId: string
      }

      function ParamsPage({
        data,
        params,
      }: {
        data: ParamsPageData
        params?: Record<string, string>
      }) {
        return React.createElement('div', {}, [
          React.createElement('p', { key: 'data' }, `Data userId: ${data.userId}`),
          React.createElement('p', { key: 'params' }, `Params id: ${params?.id ?? 'none'}`),
        ])
      }

      const context = createMockContext({ userId: 'from-loader' }, { id: '123' })

      const response = await renderPage(ParamsPage, context)

      const html = await response.text()
      expect(html).toContain('Data userId: from-loader')
      expect(html).toContain('Params id: 123')
    })

    it('should handle undefined loader data', async () => {
      function EmptyPage({ data }: { data: unknown }) {
        return React.createElement('div', {}, data ? 'Has data' : 'No data')
      }

      const context = createMockContext(undefined)

      const response = await renderPage(EmptyPage, context)

      const html = await response.text()
      expect(html).toContain('No data')
    })
  })

  describe('createPageHandler', () => {
    it('should create a route handler that renders the page', async () => {
      const loaderData: TestPageData = { title: 'Handler Test', count: 99 }
      const context = createMockContext(loaderData)

      const handler = createPageHandler(TestPage, { title: 'Test Page' })
      const response = await handler(context)

      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('Handler Test')
      expect(html).toContain('Count: 99')
      expect(html).toContain('<title>Test Page</title>')
    })

    it('should apply default options to all requests', async () => {
      const handler = createPageHandler(TestPage, {
        streaming: true,
        config: { cache: { maxAge: 120 } },
      })

      const context = createMockContext({ title: 'A', count: 1 })
      const response = await handler(context)

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=120')
      expect(response.body).toBeDefined() // Streaming mode
    })
  })
})
