/**
 * @module ssr/ssg.test
 * @description Tests for SSG/ISR utilities
 */

import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import {
  generateISRCacheKey,
  prerenderRoute,
  storeISRCache,
  getISRCache,
  handleISRRequest,
  isSSGRoute,
  validateSSGConfig,
} from '@/ssr/ssg'
import type { RouteConfig } from '@/ssr/types'

// Mock KV namespace
class MockKV {
  private storage = new Map<string, { value: string; expiration?: number }>()

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.storage.set(key, {
      value,
      expiration: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
    })
  }

  async get(key: string, type: 'text'): Promise<string | null> {
    const entry = this.storage.get(key)
    if (!entry) return null
    if (entry.expiration && Date.now() > entry.expiration) {
      this.storage.delete(key)
      return null
    }
    return entry.value
  }

  clear() {
    this.storage.clear()
  }
}

// Simple test component
function TestComponent({ title }: { title: string }) {
  return React.createElement('div', {}, `Title: ${title}`)
}

describe('SSG/ISR', () => {
  let mockKV: MockKV

  beforeEach(() => {
    mockKV = new MockKV()
  })

  describe('generateISRCacheKey', () => {
    it('should generate cache key without params', () => {
      const key = generateISRCacheKey('/blog')

      expect(key).toBe('isr:/blog:')
    })

    it('should generate cache key with params', () => {
      const key = generateISRCacheKey('/blog/[slug]', { slug: 'hello' })

      expect(key).toBe('isr:/blog/[slug]:{"slug":"hello"}')
    })

    it('should generate unique keys for different params', () => {
      const key1 = generateISRCacheKey('/blog/[slug]', { slug: 'hello' })
      const key2 = generateISRCacheKey('/blog/[slug]', { slug: 'world' })

      expect(key1).not.toBe(key2)
    })

    it('should handle multiple params', () => {
      const key = generateISRCacheKey('/blog/[year]/[slug]', { year: '2024', slug: 'hello' })

      expect(key).toContain('isr:')
      expect(key).toContain('year')
      expect(key).toContain('2024')
      expect(key).toContain('slug')
      expect(key).toContain('hello')
    })
  })

  describe('prerenderRoute', () => {
    it('should pre-render component to HTML', async () => {
      const html = await prerenderRoute(React.createElement(TestComponent, { title: 'Test' }))

      expect(html).toContain('Title: Test')
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('should pre-render with options', async () => {
      const html = await prerenderRoute(React.createElement(TestComponent, { title: 'Test' }), {
        title: 'Page Title',
        meta: { description: 'Test page' },
      })

      expect(html).toContain('Title: Test')
      expect(html).toContain('<title>Page Title</title>')
      expect(html).toContain('name="description"')
    })
  })

  describe('storeISRCache', () => {
    it('should store HTML in KV with TTL', async () => {
      const env = { KV: mockKV as unknown as KVNamespace }
      const html = '<html>Test</html>'

      await storeISRCache(env, 'isr:/test:{}', html, 3600)

      const stored = await mockKV.get('isr:/test:{}', 'text')
      expect(stored).toBe(html)
    })

    it('should handle missing KV namespace gracefully', async () => {
      const env = {}

      // Should not throw
      await expect(storeISRCache(env, 'isr:/test:{}', '<html>', 3600)).resolves.toBeUndefined()
    })
  })

  describe('getISRCache', () => {
    it('should retrieve cached HTML', async () => {
      const env = { KV: mockKV as unknown as KVNamespace }
      const html = '<html>Cached</html>'

      await mockKV.put('isr:/cached:{}', html)

      const retrieved = await getISRCache(env, 'isr:/cached:{}')
      expect(retrieved).toBe(html)
    })

    it('should return null for cache miss', async () => {
      const env = { KV: mockKV as unknown as KVNamespace }

      const retrieved = await getISRCache(env, 'isr:/missing:{}')
      expect(retrieved).toBeNull()
    })

    it('should return null when KV not available', async () => {
      const env = {}

      const retrieved = await getISRCache(env, 'isr:/test:{}')
      expect(retrieved).toBeNull()
    })
  })

  describe('handleISRRequest', () => {
    it('should serve from cache on cache hit', async () => {
      const env = { KV: mockKV as unknown as KVNamespace }
      const cacheKey = 'isr:/blog:{"slug":"test"}'
      const cachedHTML = '<html>Cached Content</html>'

      // Pre-populate cache
      await mockKV.put(cacheKey, cachedHTML)

      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: 3600,
      }

      let regenerateCalled = false
      const regenerate = async () => {
        regenerateCalled = true
        return '<html>Fresh Content</html>'
      }

      const response = await handleISRRequest(env, cacheKey, regenerate, config)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-ISR-Cache')).toBe('HIT')
      expect(regenerateCalled).toBe(false)

      const html = await response.text()
      expect(html).toBe(cachedHTML)
    })

    it('should regenerate on cache miss', async () => {
      const env = { KV: mockKV as unknown as KVNamespace }
      const cacheKey = 'isr:/blog:{"slug":"new"}'

      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: 3600,
      }

      const freshHTML = '<html>Fresh Content</html>'
      let regenerateCalled = false
      const regenerate = async () => {
        regenerateCalled = true
        return freshHTML
      }

      const response = await handleISRRequest(env, cacheKey, regenerate, config)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-ISR-Cache')).toBe('MISS')
      expect(regenerateCalled).toBe(true)

      const html = await response.text()
      expect(html).toBe(freshHTML)
    })

    it('should work without KV namespace', async () => {
      const env = {}
      const cacheKey = 'isr:/blog:{"slug":"test"}'

      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: 3600,
      }

      const freshHTML = '<html>Fresh Content</html>'
      const regenerate = async () => freshHTML

      const response = await handleISRRequest(env, cacheKey, regenerate, config)

      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toBe(freshHTML)
    })
  })

  describe('isSSGRoute', () => {
    it('should return true for SSG routes', () => {
      const config: RouteConfig = { rendering: 'ssg' }

      expect(isSSGRoute(config)).toBe(true)
    })

    it('should return false for SSR routes', () => {
      const config: RouteConfig = { rendering: 'ssr' }

      expect(isSSGRoute(config)).toBe(false)
    })

    it('should return false for CSR routes', () => {
      const config: RouteConfig = { rendering: 'csr' }

      expect(isSSGRoute(config)).toBe(false)
    })

    it('should return false for undefined config', () => {
      expect(isSSGRoute(undefined)).toBe(false)
    })

    it('should return false for config without rendering', () => {
      const config: RouteConfig = {}

      expect(isSSGRoute(config)).toBe(false)
    })
  })

  describe('validateSSGConfig', () => {
    it('should validate valid SSG config', () => {
      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: 3600,
      }

      expect(() => validateSSGConfig(config)).not.toThrow()
    })

    it('should validate SSG without revalidate', () => {
      const config: RouteConfig = {
        rendering: 'ssg',
      }

      expect(() => validateSSGConfig(config)).not.toThrow()
    })

    it('should allow revalidate of 0', () => {
      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: 0,
      }

      expect(() => validateSSGConfig(config)).not.toThrow()
    })

    it('should throw on negative revalidate', () => {
      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: -1,
      }

      expect(() => validateSSGConfig(config)).toThrow(/Invalid revalidate value/)
    })

    it('should skip validation for non-SSG routes', () => {
      const config: RouteConfig = {
        rendering: 'ssr',
        revalidate: -1, // Invalid but ignored for SSR
      }

      expect(() => validateSSGConfig(config)).not.toThrow()
    })
  })
})
