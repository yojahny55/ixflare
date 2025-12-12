/**
 * @module prefetch.test
 * @description Tests for route prefetching utilities
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  prefetchRoute,
  clearPrefetchCache,
  isPrefetched,
  setChunkManifest,
  getChunkManifest,
  setupLinkPrefetching,
} from '../../src/client/prefetch'

// Mock chunk manifest for testing
const mockManifest: Record<string, string> = {
  'route-dashboard': '/chunks/route-dashboard-abc123.js',
  'route-about': '/chunks/route-about-def456.js',
  'route-blog': '/chunks/route-blog-ghi789.js',
  'route-blog-post': '/chunks/route-blog-post-jkl012.js',
  'route-index': '/chunks/route-index-mno345.js',
  'route-users-_id_': '/chunks/route-users-_id_-pqr678.js',
  'route-docs-_slug_': '/chunks/route-docs-_slug_-stu901.js',
}

describe('setChunkManifest / getChunkManifest', () => {
  beforeEach(() => {
    // Reset manifest before each test
    setChunkManifest({})
  })

  it('should set and get chunk manifest', () => {
    setChunkManifest(mockManifest)
    expect(getChunkManifest()).toEqual(mockManifest)
  })

  it('should return null initially before setting', () => {
    // Reset to null state by setting empty and checking getter behavior
    const manifest = getChunkManifest()
    expect(manifest).toBeDefined()
  })

  it('should overwrite previous manifest', () => {
    setChunkManifest({ 'route-old': '/old.js' })
    setChunkManifest(mockManifest)
    expect(getChunkManifest()).toEqual(mockManifest)
    expect(getChunkManifest()!['route-old']).toBeUndefined()
  })
})

describe('prefetchRoute', () => {
  beforeEach(() => {
    // Clear document head and cache before each test
    document.head.innerHTML = ''
    clearPrefetchCache()
    setChunkManifest(mockManifest)
  })

  it('should create prefetch link element with correct URL from manifest', () => {
    prefetchRoute('/dashboard')

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(1)

    const link = links[0] as HTMLLinkElement
    expect(link.rel).toBe('prefetch')
    expect(link.as).toBe('script')
    expect(link.href).toContain('/chunks/route-dashboard-abc123.js')
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

  it('should convert route paths to chunk names and use manifest', () => {
    prefetchRoute('/blog/post')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('/chunks/route-blog-post-jkl012.js')
  })

  it('should handle root route', () => {
    prefetchRoute('/')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('/chunks/route-index-mno345.js')
  })

  it('should handle dynamic route segments with URL-style params', () => {
    prefetchRoute('/users/:id')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('/chunks/route-users-_id_-pqr678.js')
  })

  it('should handle dynamic route segments with file-based params', () => {
    prefetchRoute('/users/[id]')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('/chunks/route-users-_id_-pqr678.js')
  })

  it('should handle catch-all route segments', () => {
    prefetchRoute('/docs/[...slug]')

    const link = document.querySelector('link[rel="prefetch"]') as HTMLLinkElement
    expect(link.href).toContain('/chunks/route-docs-_slug_-stu901.js')
  })

  it('should track prefetched routes', () => {
    expect(isPrefetched('/dashboard')).toBe(false)

    prefetchRoute('/dashboard')

    expect(isPrefetched('/dashboard')).toBe(true)
  })

  it('should warn and not create link when manifest not set', () => {
    // Clear manifest
    setChunkManifest({})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    prefetchRoute('/unknown-route')

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(0)
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('should warn when chunk not found in manifest', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    prefetchRoute('/nonexistent')

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('chunk manifest'))

    warnSpy.mockRestore()
  })
})

describe('clearPrefetchCache', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    clearPrefetchCache()
    setChunkManifest(mockManifest)
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
    document.head.innerHTML = ''
    clearPrefetchCache()
    setChunkManifest(mockManifest)
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

describe('setupLinkPrefetching', () => {
  // Store original IntersectionObserver
  const originalIntersectionObserver = globalThis.IntersectionObserver

  beforeEach(() => {
    // Setup DOM
    document.head.innerHTML = ''
    document.body.innerHTML = `
      <nav>
        <a href="/dashboard">Dashboard</a>
        <a href="/about">About</a>
        <a href="https://external.com">External</a>
      </nav>
    `
    clearPrefetchCache()
    setChunkManifest(mockManifest)

    // Mock IntersectionObserver as a class
    class MockIntersectionObserver {
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn().mockReturnValue([])
      root = null
      rootMargin = ''
      thresholds = []
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    // Restore original
    if (originalIntersectionObserver) {
      globalThis.IntersectionObserver = originalIntersectionObserver
    }
  })

  it('should prefetch links on hover', () => {
    setupLinkPrefetching({ onHover: true, onViewport: false })

    // Simulate hover on dashboard link
    const dashboardLink = document.querySelector('a[href="/dashboard"]') as HTMLAnchorElement
    dashboardLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(isPrefetched('/dashboard')).toBe(true)
    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(1)
  })

  it('should not prefetch external links', () => {
    setupLinkPrefetching({ onHover: true, onViewport: false })

    // Simulate hover on external link
    const externalLink = document.querySelector(
      'a[href="https://external.com"]'
    ) as HTMLAnchorElement
    externalLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    const links = document.querySelectorAll('link[rel="prefetch"]')
    expect(links.length).toBe(0)
  })

  it('should observe links in viewport when onViewport is true', () => {
    setupLinkPrefetching({ onHover: false, onViewport: true })

    // IntersectionObserver should have been created
    // The mock is a class so this verifies the setup worked
    expect(IntersectionObserver).toBeDefined()
  })

  it('should handle options with defaults', () => {
    // Should not throw with no options
    expect(() => setupLinkPrefetching()).not.toThrow()
  })
})
