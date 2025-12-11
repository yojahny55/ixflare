/**
 * @module prefetch.test
 * @description Tests for route prefetching utilities
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { prefetchRoute, clearPrefetchCache, isPrefetched } from '../../src/client/prefetch'

describe('prefetchRoute', () => {
  beforeEach(() => {
    // Clear document head before each test
    document.head.innerHTML = ''
    clearPrefetchCache()
  })

  it('should create prefetch link element', () => {
    prefetchRoute('/dashboard')

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(1)

    const link = links[0] as HTMLLinkElement
    expect(link.rel).toBe('prefetch')
    expect(link.as).toBe('script')
    expect(link.href).toContain('route-dashboard.js')
  })

  it('should not create duplicate prefetch links', () => {
    prefetchRoute('/dashboard')
    prefetchRoute('/dashboard') // Duplicate
    prefetchRoute('/dashboard') // Duplicate

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(1) // Only one link created
  })

  it('should handle multiple different routes', () => {
    prefetchRoute('/dashboard')
    prefetchRoute('/about')
    prefetchRoute('/blog')

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(3)
  })

  it('should convert route paths to chunk names', () => {
    prefetchRoute('/blog/post')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('route-blog-post.js')
  })

  it('should handle root route', () => {
    prefetchRoute('/')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('route-index.js')
  })

  it('should handle dynamic route segments', () => {
    prefetchRoute('/users/:id')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('route-users-_id.js')
  })

  it('should track prefetched routes', () => {
    expect(isPrefetched('/dashboard')).toBe(false)

    prefetchRoute('/dashboard')

    expect(isPrefetched('/dashboard')).toBe(true)
  })
})

describe('clearPrefetchCache', () => {
  beforeEach(() => {
    clearPrefetchCache()
  })

  it('should clear prefetch cache', () => {
    prefetchRoute('/dashboard')
    expect(isPrefetched('/dashboard')).toBe(true)

    clearPrefetchCache()

    expect(isPrefetched('/dashboard')).toBe(false)
  })

  it('should allow re-prefetching after cache clear', () => {
    prefetchRoute('/dashboard')
    const firstLinkCount = document.querySelectorAll('link[rel="prefetch"]').length

    clearPrefetchCache()
    prefetchRoute('/dashboard')

    const secondLinkCount = document.querySelectorAll('link[rel="prefetch"]').length
    // Should create a new link after cache clear
    expect(secondLinkCount).toBe(firstLinkCount + 1)
  })
})

describe('isPrefetched', () => {
  beforeEach(() => {
    clearPrefetchCache()
  })

  it('should return false for routes not prefetched', () => {
    expect(isPrefetched('/dashboard')).toBe(false)
    expect(isPrefetched('/about')).toBe(false)
  })

  it('should return true for prefetched routes', () => {
    prefetchRoute('/dashboard')
    expect(isPrefetched('/dashboard')).toBe(true)
  })

  it('should track multiple routes independently', () => {
    prefetchRoute('/dashboard')
    prefetchRoute('/about')

    expect(isPrefetched('/dashboard')).toBe(true)
    expect(isPrefetched('/about')).toBe(true)
    expect(isPrefetched('/blog')).toBe(false)
  })
})
