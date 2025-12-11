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
 * HMR fetch timeout in milliseconds
 * @internal
 */
const HMR_FETCH_TIMEOUT = 5000

/**
 * Maximum retry attempts for HMR fetch
 * @internal
 */
const HMR_MAX_RETRIES = 2

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
 * Fetch with timeout support
 * @internal
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch with retry logic
 * @internal
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = HMR_MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, HMR_FETCH_TIMEOUT)
      if (response.ok) {
        return response
      }
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff: 100ms, 200ms)
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
      }
    }
  }

  throw lastError
}

/**
 * Morphs the current document body to match new HTML while preserving island DOM nodes.
 *
 * This function performs a surgical DOM update:
 * 1. Extracts existing island elements and stores them
 * 2. Parses new HTML and identifies island placeholders
 * 3. Captures new props from server-rendered islands
 * 4. Replaces non-island content in the live DOM
 * 5. Keeps island DOM nodes in place (preserving React state)
 * 6. Updates data-props attribute if props changed (React will re-render with new props)
 *
 * @internal
 */
function morphDOMPreservingIslands(
  newHtml: string,
  islandMap: Map<string, Element>
): number {
  const parser = new DOMParser()
  const newDoc = parser.parseFromString(newHtml, 'text/html')

  // Strategy: Walk through new body children and update/replace in current body
  // while preserving islands that exist in both old and new

  const newBody = newDoc.body
  const currentBody = document.body

  // Mark islands in the new document with temporary markers
  // Also capture new props for prop updates
  const newIslands = newDoc.querySelectorAll('[data-island]')
  const islandPlaceholders = new Map<string, Comment>()
  const islandNewProps = new Map<string, string | null>()

  // Replace new islands with comment placeholders, capture new props
  newIslands.forEach((newIsland) => {
    const islandId = newIsland.getAttribute('data-island')
    if (islandId && islandMap.has(islandId)) {
      // Capture the new props before replacing
      const newProps = newIsland.getAttribute('data-props')
      islandNewProps.set(islandId, newProps)

      const placeholder = document.createComment(`island:${islandId}`)
      newIsland.replaceWith(placeholder)
      islandPlaceholders.set(islandId, placeholder)
    }
  })

  // Collect elements to preserve before clearing (portals, scripts, etc.)
  const elementsToPreserve: Element[] = []
  currentBody.querySelectorAll('[data-hmr-preserve]').forEach((el) => {
    elementsToPreserve.push(el)
  })

  // Now do the DOM swap - this creates new DOM nodes but islands are just comments
  const fragment = document.createDocumentFragment()
  while (newBody.firstChild) {
    fragment.appendChild(newBody.firstChild)
  }

  // Clear current body and append new content
  // Note: We preserve the body element itself, only clearing children
  while (currentBody.firstChild) {
    currentBody.removeChild(currentBody.firstChild)
  }
  currentBody.appendChild(fragment)

  // Re-attach preserved elements (portals, third-party scripts)
  elementsToPreserve.forEach((el) => {
    currentBody.appendChild(el)
  })

  // Replace comment placeholders with actual preserved islands
  let preservedCount = 0
  islandPlaceholders.forEach((_, islandId) => {
    const placeholder = findCommentNode(currentBody, `island:${islandId}`)
    const existingIsland = islandMap.get(islandId)

    if (placeholder && existingIsland) {
      // Update data-props if they changed (React will pick up new props)
      const newPropsValue = islandNewProps.get(islandId)
      const oldProps = existingIsland.getAttribute('data-props')

      // Only update if we captured new props and they differ from old
      if (newPropsValue !== undefined && newPropsValue !== oldProps) {
        if (newPropsValue !== null) {
          existingIsland.setAttribute('data-props', newPropsValue)
        } else {
          existingIsland.removeAttribute('data-props')
        }
        // Log prop update in dev mode
        console.log(`[ixflare] Island "${islandId}" props updated`)
      }

      placeholder.replaceWith(existingIsland)
      preservedCount++
    }
  })

  return preservedCount
}

/**
 * Find a comment node with specific text content
 * @internal
 */
function findCommentNode(root: Element, text: string): Comment | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  let node: Comment | null

  while ((node = walker.nextNode() as Comment | null)) {
    if (node.textContent === text) {
      return node
    }
  }
  return null
}

/**
 * Shows a visual notification for HMR errors
 * @internal
 */
function showHMRError(message: string): void {
  // Create or update error notification
  let notification = document.getElementById('ixflare-hmr-error')
  if (!notification) {
    notification = document.createElement('div')
    notification.id = 'ixflare-hmr-error'
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
    `
    notification.onclick = () => notification?.remove()
    document.body.appendChild(notification)
  }
  notification.textContent = `[HMR] ${message} (click to dismiss)`

  // Auto-dismiss after 5 seconds
  setTimeout(() => notification?.remove(), 5000)
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
 * - We preserve island DOM nodes during HTML swap using comment placeholders
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

      console.log(`[ixflare] Server component updated: ${updateData.route}`)

      // Find all islands before HTML swap
      const islands = document.querySelectorAll('[data-island]')
      const islandMap = new Map<string, Element>()

      // Save island references (React maintains state in these DOM nodes)
      islands.forEach((island) => {
        const islandId = island.getAttribute('data-island')
        if (islandId) {
          // Clone the island's parent reference info for validation
          islandMap.set(islandId, island)
        }
      })

      // Fetch updated HTML with retry logic
      let response: Response
      try {
        response = await fetchWithRetry(
          window.location.pathname + window.location.search,
          { headers: { Accept: 'text/html' } }
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error'
        console.error(`[ixflare] Failed to fetch updated HTML: ${message}`)
        showHMRError(`Failed to fetch update: ${message}`)
        return
      }

      const newHtml = await response.text()

      // Morph DOM while preserving islands
      const preservedCount = morphDOMPreservingIslands(newHtml, islandMap)

      console.log(`[ixflare] HTML swapped, ${preservedCount}/${islandMap.size} islands preserved`)
    } catch (error) {
      console.error('[ixflare] Server component HMR error:', error)
      showHMRError('HMR update failed - see console')
    }
  })
}

// Auto-initialize HMR handler
if (IS_DEV && typeof window !== 'undefined') {
  setupServerComponentHMR()
}

export { setupServerComponentHMR }
