/**
 * @module client/hydrate
 * @description Client-side island hydration utilities
 * @client-only
 *
 * This module runs in the browser and handles hydrating interactive island
 * components. It supports multiple loading strategies (immediate, idle, visible)
 * and implements per-island error boundaries to prevent cascading failures.
 *
 * @example
 * ```typescript
 * // In your client entry point:
 * import { hydrateIslands } from 'ixflare/client'
 *
 * // Hydrate all islands on the page
 * hydrateIslands()
 * ```
 */

import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import type { IslandLoadStrategy } from '@/ssr/types'

/** Development mode flag */
const IS_DEV = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

/**
 * Hydrate a single island immediately
 *
 * @param element - DOM element with island marker
 * @param islandId - Island identifier
 * @param props - Deserialized props
 *
 * @internal
 */
async function hydrateImmediate(element: Element, islandId: string, props: Record<string, unknown>): Promise<void> {
  try {
    // Dynamically import the island component
    // Component path will be resolved by bundler (Vite)
    const componentModule = await import(/* @vite-ignore */ `./islands/${islandId}`)

    // Get the default export (the component)
    const Component = componentModule.default

    if (!Component) {
      console.error(`[Island Hydration Error] ${islandId}: No default export found`)
      return
    }

    // Hydrate the island with React
    hydrateRoot(element, createElement(Component, props))

    if (IS_DEV) {
      console.log(`[Island Hydrated] ${islandId}`, { props })
    }
  } catch (error) {
    // Catch hydration errors and log without crashing other islands
    console.error(`[Island Hydration Error] ${islandId}:`, error)

    if (IS_DEV) {
      // In development, show warning overlay
      const warning = document.createElement('div')
      warning.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 8px;
        background: #fee;
        border: 1px solid #c00;
        color: #c00;
        font-size: 12px;
        font-family: monospace;
        z-index: 9999;
      `
      warning.textContent = `⚠️ Failed to hydrate island "${islandId}". Check console for details.`
      if (element.firstChild) {
        element.insertBefore(warning, element.firstChild)
      } else {
        element.appendChild(warning)
      }
    }

    // Island remains in server-rendered state (graceful degradation)
  }
}

/**
 * Hydrate island when browser is idle
 *
 * Uses requestIdleCallback to defer hydration until the browser has free time.
 * Falls back to setTimeout if requestIdleCallback is not available.
 *
 * @param element - DOM element with island marker
 * @param islandId - Island identifier
 * @param props - Deserialized props
 *
 * @internal
 */
function hydrateOnIdle(element: Element, islandId: string, props: Record<string, unknown>): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      hydrateImmediate(element, islandId, props)
    })
  } else {
    // Fallback for browsers without requestIdleCallback (Safari)
    setTimeout(() => {
      hydrateImmediate(element, islandId, props)
    }, 1)
  }
}

/**
 * Hydrate island when it becomes visible
 *
 * Uses IntersectionObserver to hydrate only when the island scrolls into view.
 * Falls back to immediate hydration if IntersectionObserver is not available.
 *
 * @param element - DOM element with island marker
 * @param islandId - Island identifier
 * @param props - Deserialized props
 *
 * @internal
 */
function hydrateOnVisible(element: Element, islandId: string, props: Record<string, unknown>): void {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Island is visible, hydrate it
            hydrateImmediate(element, islandId, props)
            // Stop observing after hydration
            observer.unobserve(element)
          }
        })
      },
      {
        // Trigger when at least 1px is visible
        rootMargin: '50px',
        threshold: 0,
      }
    )

    observer.observe(element)
  } else {
    // Fallback for browsers without IntersectionObserver
    hydrateImmediate(element, islandId, props)
  }
}

/**
 * Hydrate all islands on the page
 *
 * Finds all elements with `data-island` attribute and hydrates them according
 * to their loading strategy (immediate, idle, or visible).
 *
 * This function should be called once in your client entry point:
 *
 * @example
 * ```typescript
 * // src/entry-client.ts
 * import { hydrateIslands } from 'ixflare/client'
 *
 * hydrateIslands()
 * ```
 *
 * @example
 * ```typescript
 * // Manual hydration with custom selector
 * hydrateIslands('[data-island]')
 * ```
 */
export function hydrateIslands(selector = '[data-island]'): void {
  // Find all island markers in the DOM
  const islands = document.querySelectorAll(selector)

  if (IS_DEV) {
    console.log(`[Islands] Found ${islands.length} islands to hydrate`)
  }

  islands.forEach((element) => {
    const islandId = element.getAttribute('data-island')
    const propsJson = element.getAttribute('data-props') || '{}'
    const loadStrategy = (element.getAttribute('data-load') as IslandLoadStrategy) || 'immediate'

    if (!islandId) {
      console.error('[Island Hydration Error] Missing data-island attribute')
      return
    }

    // Parse props
    let props: Record<string, unknown>
    try {
      props = JSON.parse(propsJson)
    } catch (error) {
      console.error(`[Island Hydration Error] ${islandId}: Failed to parse props`, error)
      return
    }

    // Hydrate based on loading strategy
    if (loadStrategy === 'immediate') {
      hydrateImmediate(element, islandId, props)
    } else if (loadStrategy === 'idle') {
      hydrateOnIdle(element, islandId, props)
    } else if (loadStrategy === 'visible') {
      hydrateOnVisible(element, islandId, props)
    } else {
      console.warn(`[Island Hydration Warning] ${islandId}: Unknown load strategy "${loadStrategy}", using immediate`)
      hydrateImmediate(element, islandId, props)
    }
  })
}

/**
 * Hydrate a single island by ID
 *
 * Useful for manually hydrating specific islands after dynamic content loads.
 *
 * @param islandId - Island identifier
 *
 * @example
 * ```typescript
 * // Hydrate a single island
 * hydrateIslandById('counter-1')
 * ```
 */
export function hydrateIslandById(islandId: string): void {
  const element = document.querySelector(`[data-island="${islandId}"]`)

  if (!element) {
    console.error(`[Island Hydration Error] Island "${islandId}" not found in DOM`)
    return
  }

  const propsJson = element.getAttribute('data-props') || '{}'

  let props: Record<string, unknown>
  try {
    props = JSON.parse(propsJson)
  } catch (error) {
    console.error(`[Island Hydration Error] ${islandId}: Failed to parse props`, error)
    return
  }

  hydrateImmediate(element, islandId, props)
}
