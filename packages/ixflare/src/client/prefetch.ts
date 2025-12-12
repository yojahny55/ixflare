/**
 * @module prefetch
 * @description Route prefetching utilities for faster client-side navigation
 * @client-only
 *
 * Provides utilities to prefetch route chunks before navigation, reducing
 * perceived load time and improving user experience.
 *
 * **Important:** For prefetching to work correctly with hashed chunk names,
 * you must initialize the chunk manifest using `setChunkManifest()` after
 * the page loads. The manifest maps route names to actual chunk URLs.
 *
 * @example
 * ```typescript
 * import { prefetchRoute, setupLinkPrefetching, setChunkManifest } from 'ixflare/client'
 *
 * // Initialize manifest (typically injected by SSR or loaded from /chunk-manifest.json)
 * setChunkManifest({
 *   'route-dashboard': '/chunks/route-dashboard-abc123.js',
 *   'route-about': '/chunks/route-about-def456.js'
 * })
 *
 * // Setup automatic prefetching for visible links
 * setupLinkPrefetching()
 *
 * // Manual prefetch on hover
 * link.addEventListener('mouseenter', () => {
 *   prefetchRoute('/dashboard')
 * })
 * ```
 */

import { routePathToChunkName } from '@/utils/chunk-naming'

/**
 * Chunk manifest mapping chunk names to actual URLs with hashes
 * Auto-loaded from window.__CHUNK_MANIFEST__ if available (SSR injection)
 * Can be set manually via setChunkManifest()
 */
let chunkManifest: Record<string, string> | null = null

// Auto-load manifest from SSR injection if available
if (
  typeof window !== 'undefined' &&
  (window as Window & { __CHUNK_MANIFEST__?: Record<string, string> }).__CHUNK_MANIFEST__
) {
  chunkManifest =
    (window as Window & { __CHUNK_MANIFEST__?: Record<string, string> }).__CHUNK_MANIFEST__ ?? null
}

/**
 * Set of routes that have already been prefetched
 * Prevents duplicate prefetch requests
 */
const prefetchedRoutes = new Set<string>()

/**
 * Prefetch a route chunk for faster navigation
 *
 * Creates a `<link rel="prefetch">` tag to load the route chunk in the background.
 * The browser will download the chunk when idle, making future navigation instant.
 *
 * **Note:** For prefetching to work correctly with hashed chunk names,
 * the chunk manifest must be initialized via `setChunkManifest()` first.
 * Without the manifest, prefetching will be skipped with a console warning.
 *
 * @param routePath - Route path to prefetch (e.g., '/dashboard', '/blog/post-1')
 *
 * @example
 * ```typescript
 * // Prefetch on hover
 * button.addEventListener('mouseenter', () => {
 *   prefetchRoute('/dashboard')
 * })
 *
 * // Prefetch programmatically
 * if (user.isPremium) {
 *   prefetchRoute('/premium/dashboard')
 * }
 * ```
 */
export function prefetchRoute(routePath: string): void {
  // Check if already prefetched
  if (prefetchedRoutes.has(routePath)) {
    return
  }

  // Mark as prefetched to avoid duplicates
  prefetchedRoutes.add(routePath)

  // Convert route path to chunk name
  // Examples:
  // - '/dashboard' → 'route-dashboard'
  // - '/blog/post' → 'route-blog-post'
  // - '/users/[id]' → 'route-users-_id_' (for dynamic routes)
  const chunkName = routePathToChunkName(routePath)

  // Look up the actual chunk URL from the manifest
  let chunkUrl: string | null = null

  if (chunkManifest) {
    // Direct lookup
    chunkUrl = chunkManifest[chunkName] || null

    // If not found, try to find a matching chunk (handles hash variations)
    if (!chunkUrl) {
      const matchingKey = Object.keys(chunkManifest).find(
        (key) => key.startsWith(chunkName + '-') || key === chunkName
      )
      if (matchingKey) {
        chunkUrl = chunkManifest[matchingKey]
      }
    }
  }

  // Without manifest, we can't prefetch correctly (hashes unknown)
  if (!chunkUrl) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[ixflare/prefetch] Cannot prefetch "${routePath}": chunk manifest not set or chunk "${chunkName}" not found. ` +
          `Call setChunkManifest() with the chunk mapping first.`
      )
    }
    return
  }

  // Create prefetch link with marker attribute for cleanup
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'script'
  link.href = chunkUrl
  link.setAttribute('data-ixflare-prefetch', routePath)

  // Append to head
  document.head.appendChild(link)
}

/**
 * Options for link prefetching
 */
export interface PrefetchOptions {
  /** CSS selector for links to prefetch (default: 'a[href^="/"]') */
  selector?: string
  /** Prefetch on hover (default: true) */
  onHover?: boolean
  /** Prefetch when link enters viewport (default: true) */
  onViewport?: boolean
  /** Intersection observer root margin (default: '50px') */
  rootMargin?: string
}

/**
 * Setup automatic prefetching for navigation links
 *
 * This function sets up event listeners to automatically prefetch route chunks
 * when links become visible or are hovered over. This significantly improves
 * perceived navigation speed.
 *
 * @param options - Prefetching configuration options
 *
 * @example
 * ```typescript
 * // Basic setup - prefetch visible links
 * setupLinkPrefetching()
 *
 * // Custom configuration
 * setupLinkPrefetching({
 *   selector: 'a.nav-link[href^="/"]',
 *   onHover: true,
 *   onViewport: true,
 *   rootMargin: '100px'
 * })
 * ```
 */
export function setupLinkPrefetching(options: PrefetchOptions = {}): void {
  const {
    selector = 'a[href^="/"]',
    onHover = true,
    onViewport = true,
    rootMargin = '50px',
  } = options

  // Prefetch on hover
  if (onHover) {
    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement
      const link = target.closest(selector) as HTMLAnchorElement
      if (link && link.href) {
        const url = new URL(link.href)
        // Only prefetch same-origin links
        if (url.origin === location.origin) {
          prefetchRoute(url.pathname)
        }
      }
    })
  }

  // Prefetch when link enters viewport
  if (onViewport && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement
            const url = new URL(link.href)
            // Only prefetch same-origin links
            if (url.origin === location.origin) {
              prefetchRoute(url.pathname)
            }
            // Stop observing once prefetched
            observer.unobserve(link)
          }
        }
      },
      { rootMargin }
    )

    // Observe all matching links
    const links = document.querySelectorAll(selector)
    Array.from(links).forEach((link) => {
      observer.observe(link)
    })

    // Watch for new links added to the DOM
    if (typeof MutationObserver !== 'undefined') {
      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          Array.from(mutation.addedNodes).forEach((node) => {
            if (node instanceof HTMLElement) {
              // Check if node itself is a link
              if (node.matches(selector)) {
                observer.observe(node)
              }
              // Check for links within added node
              const linksInNode = node.querySelectorAll(selector)
              Array.from(linksInNode).forEach((link) => {
                observer.observe(link)
              })
            }
          })
        })
      })

      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      })
    }
  }
}

/**
 * Remove all prefetch link elements from the DOM
 *
 * Cleans up `<link rel="prefetch">` elements that were added by `prefetchRoute()`.
 * Useful when navigating to a different section of the app or on cleanup.
 *
 * @example
 * ```typescript
 * // Cleanup on route change
 * router.on('navigate', () => {
 *   cleanupPrefetchLinks()
 * })
 * ```
 */
export function cleanupPrefetchLinks(): void {
  if (typeof document === 'undefined') return

  const prefetchLinks = document.querySelectorAll('link[rel="prefetch"][data-ixflare-prefetch]')
  prefetchLinks.forEach((link) => link.remove())
}

/**
 * Clear all prefetched routes from the cache and optionally cleanup DOM
 *
 * Useful for testing or when navigation patterns change significantly.
 *
 * @param options - Cleanup options
 * @param options.cleanupDOM - Also remove prefetch link elements from DOM (default: false)
 *
 * @example
 * ```typescript
 * // Clear cache only (links stay in DOM for browser to potentially reuse)
 * clearPrefetchCache()
 *
 * // Clear cache and remove DOM elements
 * clearPrefetchCache({ cleanupDOM: true })
 *
 * // Clear on user logout
 * function logout() {
 *   clearPrefetchCache({ cleanupDOM: true })
 *   // ... logout logic
 * }
 * ```
 */
export function clearPrefetchCache(options?: { cleanupDOM?: boolean }): void {
  prefetchedRoutes.clear()

  if (options?.cleanupDOM) {
    cleanupPrefetchLinks()
  }
}

/**
 * Check if a route has been prefetched
 *
 * @param routePath - Route path to check
 * @returns True if route has been prefetched
 *
 * @example
 * ```typescript
 * if (isPrefetched('/dashboard')) {
 *   console.log('Dashboard chunk already loaded')
 * }
 * ```
 */
export function isPrefetched(routePath: string): boolean {
  return prefetchedRoutes.has(routePath)
}

/**
 * Set the chunk manifest for route prefetching
 *
 * The manifest maps chunk names (like 'route-dashboard') to their actual
 * URLs including content hashes (like '/chunks/route-dashboard-abc123.js').
 *
 * This should be called during page initialization with the manifest
 * generated during the build process.
 *
 * @param manifest - Object mapping chunk names to chunk URLs
 *
 * @example
 * ```typescript
 * // Load manifest and initialize
 * const manifest = await fetch('/chunk-manifest.json').then(r => r.json())
 * setChunkManifest(manifest)
 *
 * // Or inject from SSR
 * setChunkManifest(window.__CHUNK_MANIFEST__)
 * ```
 */
export function setChunkManifest(manifest: Record<string, string>): void {
  chunkManifest = manifest
}

/**
 * Get the current chunk manifest
 *
 * @returns The chunk manifest or null if not set
 *
 * @example
 * ```typescript
 * const manifest = getChunkManifest()
 * if (!manifest) {
 *   console.warn('Chunk manifest not initialized')
 * }
 * ```
 */
export function getChunkManifest(): Record<string, string> | null {
  return chunkManifest
}
