/**
 * @module ssr/route-config-types.test
 * @description Tests for route configuration type definitions
 */

import { describe, it, expect } from 'vitest'
import type {
  RenderingStrategy,
  CacheConfig,
  RouteConfig,
  StaticParams,
  GetStaticPathsFunction,
} from '@/ssr/types'

describe('Route Config Types', () => {
  describe('RenderingStrategy', () => {
    it('should accept valid rendering strategies', () => {
      const ssr: RenderingStrategy = 'ssr'
      const ssg: RenderingStrategy = 'ssg'
      const csr: RenderingStrategy = 'csr'

      expect(ssr).toBe('ssr')
      expect(ssg).toBe('ssg')
      expect(csr).toBe('csr')
    })
  })

  describe('CacheConfig', () => {
    it('should accept maxAge only', () => {
      const cache: CacheConfig = {
        maxAge: 60,
      }

      expect(cache.maxAge).toBe(60)
      expect(cache.staleWhileRevalidate).toBeUndefined()
    })

    it('should accept staleWhileRevalidate only', () => {
      const cache: CacheConfig = {
        staleWhileRevalidate: 300,
      }

      expect(cache.staleWhileRevalidate).toBe(300)
      expect(cache.maxAge).toBeUndefined()
    })

    it('should accept both maxAge and staleWhileRevalidate', () => {
      const cache: CacheConfig = {
        maxAge: 60,
        staleWhileRevalidate: 300,
      }

      expect(cache.maxAge).toBe(60)
      expect(cache.staleWhileRevalidate).toBe(300)
    })

    it('should accept empty config', () => {
      const cache: CacheConfig = {}

      expect(cache.maxAge).toBeUndefined()
      expect(cache.staleWhileRevalidate).toBeUndefined()
    })
  })

  describe('RouteConfig', () => {
    it('should accept SSR config with cache', () => {
      const config: RouteConfig = {
        rendering: 'ssr',
        cache: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      }

      expect(config.rendering).toBe('ssr')
      expect(config.cache?.maxAge).toBe(60)
      expect(config.cache?.staleWhileRevalidate).toBe(300)
    })

    it('should accept SSG config with revalidate', () => {
      const config: RouteConfig = {
        rendering: 'ssg',
        revalidate: 3600,
      }

      expect(config.rendering).toBe('ssg')
      expect(config.revalidate).toBe(3600)
    })

    it('should accept CSR config', () => {
      const config: RouteConfig = {
        rendering: 'csr',
      }

      expect(config.rendering).toBe('csr')
    })

    it('should accept empty config (defaults)', () => {
      const config: RouteConfig = {}

      expect(config.rendering).toBeUndefined()
      expect(config.cache).toBeUndefined()
      expect(config.revalidate).toBeUndefined()
    })

    it('should accept config with only cache (implicit SSR)', () => {
      const config: RouteConfig = {
        cache: { maxAge: 60 },
      }

      expect(config.cache?.maxAge).toBe(60)
    })
  })

  describe('StaticParams', () => {
    it('should accept route params', () => {
      const params: StaticParams = {
        params: {
          slug: 'hello-world',
          id: '123',
        },
      }

      expect(params.params.slug).toBe('hello-world')
      expect(params.params.id).toBe('123')
    })

    it('should accept empty params', () => {
      const params: StaticParams = {
        params: {},
      }

      expect(params.params).toEqual({})
    })
  })

  describe('GetStaticPathsFunction', () => {
    it('should accept sync function returning array', () => {
      const getStaticPaths: GetStaticPathsFunction = () => {
        return [{ params: { slug: 'post-1' } }, { params: { slug: 'post-2' } }]
      }

      const result = getStaticPaths()
      expect(result).toHaveLength(2)
    })

    it('should accept async function returning array', async () => {
      const getStaticPaths: GetStaticPathsFunction = async () => {
        // Simulate async fetch
        return Promise.resolve([{ params: { slug: 'post-1' } }, { params: { slug: 'post-2' } }])
      }

      const result = await getStaticPaths()
      expect(result).toHaveLength(2)
    })

    it('should accept function returning empty array', () => {
      const getStaticPaths: GetStaticPathsFunction = () => []

      const result = getStaticPaths()
      expect(result).toEqual([])
    })
  })

  describe('Type Safety Examples', () => {
    it('should provide type safety for route config export', () => {
      // Example: SSR with caching
      const ssrConfig: RouteConfig = {
        rendering: 'ssr',
        cache: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      }
      expect(ssrConfig.rendering).toBe('ssr')

      // Example: SSG with ISR
      const ssgConfig: RouteConfig = {
        rendering: 'ssg',
        revalidate: 3600,
      }
      expect(ssgConfig.rendering).toBe('ssg')

      // Example: CSR
      const csrConfig: RouteConfig = {
        rendering: 'csr',
      }
      expect(csrConfig.rendering).toBe('csr')
    })
  })
})
