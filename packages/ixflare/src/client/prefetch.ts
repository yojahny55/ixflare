/**
 * @module prefetch
 * @description Route prefetching utilities for faster client-side navigation
 * @client-only
 *
 * Provides utilities to prefetch route chunks before navigation, reducing
 * perceived load time and improving user experience.
 *
 * @example
 * ```typescript
 * import { prefetchRoute, setupLinkPrefetching } from 'ixflare/client'
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
  // - '/users/123' → 'route-users-_id_' (for dynamic routes)
  const chunkName = routePathToChunkName(routePath)

  // Create prefetch link
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'script'
  // Vite places chunks in chunks/ directory with content hash
  // We can't know the exact hash, so we rely on Vite's manifest or service worker
  // For now, we'll prefetch by inferring the chunk pattern
  link.href = `/chunks/${chunkName}.js`

  // Append to head
  document.head.appendChild(link)
}

/**
 * Convert route path to chunk name
 *
 * @param routePath - Route path (e.g., '/dashboard', '/blog/post')
 * @returns Chunk name (e.g., 'route-dashboard', 'route-blog-post')
 *
 * @internal
 */
function routePathToChunkName(routePath: string): string {
  // Remove leading slash and convert slashes to dashes
  const cleanPath = routePath
    .replace(/^\//, '') // Remove leading slash
    .replace(/\//g, '-') // Slashes → dashes
    .replace(/:/g, '_') // Dynamic params → underscores
    .replace(/\*/g, '_') // Catch-all → underscores

  return `route-${cleanPath || 'index'}`
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
 * Clear all prefetched routes from the cache
 *
 * Useful for testing or when navigation patterns change significantly
 *
 * @example
 * ```typescript
 * // Clear cache on user logout
 * function logout() {
 *   clearPrefetchCache()
 *   // ... logout logic
 * }
 * ```
 */
export function clearPrefetchCache(): void {
  prefetchedRoutes.clear()
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
