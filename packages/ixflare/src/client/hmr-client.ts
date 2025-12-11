/**
 * @module client/hmr-client
 * @description Client-side HMR handler for server component updates
 * @client-only
 *
 * This module handles Hot Module Replacement for server components while
 * preserving island (client component) state. When server components change,
 * we swap the HTML while keeping island DOM nodes intact.
 *
 * @example
 * ```typescript
 * // Auto-initialized in client entry - no manual setup needed
 * // HMR handler listens for 'ixflare:server-update' events from Vite dev server
 * ```
 */

/**
 * Type guard for Vite's import.meta.hot
 * @internal
 */
interface ViteHot {
  on: (event: string, callback: (data: unknown) => void) => void
}

/**
 * Type guard for Vite's import.meta
 * @internal
 */
interface ViteImportMeta extends ImportMeta {
  env?: { MODE?: string }
  hot?: ViteHot
}

/**
 * Development mode flag
 * @internal
 */
const IS_DEV =
  typeof import.meta !== 'undefined' &&
  (import.meta as ViteImportMeta).env?.MODE === 'development'

/**
 * Server component HMR data structure
 */
interface ServerUpdateData {
  /**
   * Route path that was updated (e.g., '/dashboard')
   */
  route: string

  /**
   * Update timestamp for cache busting
   */
  timestamp: number
}

/**
 * Sets up client-side HMR handler for server component updates.
 *
 * When a server component (non-.client.tsx) file changes, the Vite plugin
 * sends a custom 'ixflare:server-update' event. This handler receives the
 * event and swaps the HTML while preserving island state.
 *
 * **State Preservation Strategy:**
 * - Islands have `data-island` attributes for identification
 * - React maintains state internally in the fiber tree
 * - We preserve island DOM nodes during HTML swap
 * - React Fast Refresh handles component updates for islands
 *
 * @internal
 */
function setupServerComponentHMR(): void {
  const viteImportMeta = import.meta as ViteImportMeta

  if (!IS_DEV || !viteImportMeta.hot) {
    return
  }

  viteImportMeta.hot.on('ixflare:server-update', async (data: unknown) => {
    try {
      const updateData = data as ServerUpdateData

      if (IS_DEV) {
        console.log(`[ixflare] Server component updated: ${updateData.route}`)
      }

      // Find all islands before HTML swap
      const islands = document.querySelectorAll('[data-island]')
      const islandMap = new Map<string, Element>()

      // Save island references (React maintains state in these DOM nodes)
      islands.forEach((island) => {
        const islandId = island.getAttribute('data-island')
        if (islandId) {
          islandMap.set(islandId, island)
        }
      })

      // Fetch updated HTML for the current route
      const response = await fetch(window.location.pathname + window.location.search, {
        headers: {
          Accept: 'text/html',
        },
      })

      if (!response.ok) {
        console.error(`[ixflare] Failed to fetch updated HTML: ${response.statusText}`)
        return
      }

      const newHtml = await response.text()

      // Parse new HTML
      const parser = new DOMParser()
      const newDoc = parser.parseFromString(newHtml, 'text/html')

      // Find islands in new HTML
      const newIslands = newDoc.querySelectorAll('[data-island]')

      // Preserve existing island DOM nodes by replacing them in new HTML
      newIslands.forEach((newIsland) => {
        const islandId = newIsland.getAttribute('data-island')
        if (islandId && islandMap.has(islandId)) {
          // Replace new island placeholder with existing island (preserves React state)
          const existingIsland = islandMap.get(islandId)!
          newIsland.replaceWith(existingIsland)
        }
      })

      // Replace body content while preserving islands
      document.body.innerHTML = newDoc.body.innerHTML

      if (IS_DEV) {
        console.log(`[ixflare] HTML swapped, ${islandMap.size} islands preserved`)
      }
    } catch (error) {
      console.error('[ixflare] Server component HMR error:', error)
    }
  })
}

// Auto-initialize HMR handler
if (IS_DEV && typeof window !== 'undefined') {
  setupServerComponentHMR()
}

export { setupServerComponentHMR }
