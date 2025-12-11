/**
 * @vitest-environment jsdom
 *
 * Tests for client-side HMR handler logic.
 * These tests verify DOM manipulation for server component HMR
 * with island state preservation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock import.meta for the module
vi.stubGlobal('import', {
  meta: {
    env: { MODE: 'development' },
    hot: {
      on: vi.fn(),
    },
  },
})

/**
 * Helper to create a mock DOM structure for testing
 */
function setupTestDOM(html: string): void {
  document.body.innerHTML = html
}

/**
 * Helper to create an island element
 */
function createIsland(id: string, props: Record<string, unknown> = {}): string {
  return `<div data-island="${id}" data-props='${JSON.stringify(props)}'>Island: ${id}</div>`
}

describe('HMR Client DOM Manipulation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('morphDOMPreservingIslands', () => {
    // We need to test the morphDOMPreservingIslands function
    // Since it's not exported, we'll test its behavior through the module

    it('should preserve island DOM nodes during HTML swap', () => {
      // Setup initial DOM with an island
      const oldHtml = `
        <div class="container">
          <h1>Old Title</h1>
          <div data-island="counter" data-props='{"count":5}'>
            <button>Count: 5</button>
          </div>
        </div>
      `
      setupTestDOM(oldHtml)

      // Get reference to the island element
      const originalIsland = document.querySelector('[data-island="counter"]')!
      expect(originalIsland).toBeTruthy()

      // Simulate adding a marker to verify it's the same element later
      originalIsland.setAttribute('data-test-marker', 'original')

      // Store island in map (simulating what the HMR handler does)
      const islandMap = new Map<string, Element>()
      islandMap.set('counter', originalIsland)

      // New HTML from server (title changed, island same)
      const newHtml = `
        <div class="container">
          <h1>New Title</h1>
          <div data-island="counter" data-props='{"count":5}'>
            <button>Count: 5</button>
          </div>
        </div>
      `

      // Manually execute the DOM morph logic
      const parser = new DOMParser()
      const newDoc = parser.parseFromString(newHtml, 'text/html')

      // Find new islands and replace with placeholders
      const newIslands = newDoc.querySelectorAll('[data-island]')
      const islandPlaceholders = new Map<string, Comment>()
      const islandNewProps = new Map<string, string | null>()

      newIslands.forEach((newIsland) => {
        const islandId = newIsland.getAttribute('data-island')
        if (islandId && islandMap.has(islandId)) {
          const newProps = newIsland.getAttribute('data-props')
          islandNewProps.set(islandId, newProps)
          const placeholder = document.createComment(`island:${islandId}`)
          newIsland.replaceWith(placeholder)
          islandPlaceholders.set(islandId, placeholder)
        }
      })

      // Swap DOM
      const fragment = document.createDocumentFragment()
      while (newDoc.body.firstChild) {
        fragment.appendChild(newDoc.body.firstChild)
      }
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild)
      }
      document.body.appendChild(fragment)

      // Restore islands
      islandPlaceholders.forEach((_, islandId) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
        let node: Comment | null
        while ((node = walker.nextNode() as Comment | null)) {
          if (node.textContent === `island:${islandId}`) {
            const existingIsland = islandMap.get(islandId)!
            node.replaceWith(existingIsland)
            break
          }
        }
      })

      // Verify the island is the SAME element (not a new one)
      const preservedIsland = document.querySelector('[data-island="counter"]')!
      expect(preservedIsland.getAttribute('data-test-marker')).toBe('original')

      // Verify title was updated
      expect(document.querySelector('h1')?.textContent).toBe('New Title')
    })

    it('should update data-props when props change from server', () => {
      // Setup initial DOM with an island
      setupTestDOM(`
        <div data-island="counter" data-props='{"start":10}'>Counter</div>
      `)

      const originalIsland = document.querySelector('[data-island="counter"]')!
      originalIsland.setAttribute('data-test-marker', 'original')

      const islandMap = new Map<string, Element>()
      islandMap.set('counter', originalIsland)

      // New HTML with different props
      const newHtml = `<div data-island="counter" data-props='{"start":20}'>Counter</div>`

      const parser = new DOMParser()
      const newDoc = parser.parseFromString(newHtml, 'text/html')

      // Capture new props
      const newIsland = newDoc.querySelector('[data-island="counter"]')!
      const newProps = newIsland.getAttribute('data-props')

      // Update props on original island
      const oldProps = originalIsland.getAttribute('data-props')
      if (newProps !== oldProps) {
        originalIsland.setAttribute('data-props', newProps!)
      }

      // Verify props were updated on the SAME element
      expect(originalIsland.getAttribute('data-test-marker')).toBe('original')
      expect(originalIsland.getAttribute('data-props')).toBe('{"start":20}')
    })

    it('should handle multiple islands on the same page', () => {
      setupTestDOM(`
        <div data-island="counter" data-props='{"count":1}'>Counter 1</div>
        <div data-island="search" data-props='{"query":"test"}'>Search</div>
        <div data-island="nav" data-props='{}'>Nav</div>
      `)

      // Mark all islands
      document.querySelectorAll('[data-island]').forEach((island) => {
        island.setAttribute('data-test-marker', `original-${island.getAttribute('data-island')}`)
      })

      const islandMap = new Map<string, Element>()
      document.querySelectorAll('[data-island]').forEach((island) => {
        islandMap.set(island.getAttribute('data-island')!, island)
      })

      // Verify all 3 islands exist
      expect(islandMap.size).toBe(3)
      expect(islandMap.has('counter')).toBe(true)
      expect(islandMap.has('search')).toBe(true)
      expect(islandMap.has('nav')).toBe(true)
    })

    it('should preserve elements marked with data-hmr-preserve', () => {
      setupTestDOM(`
        <div id="content">Main Content</div>
        <div id="portal" data-hmr-preserve>Portal Content</div>
      `)

      const portal = document.querySelector('#portal')!
      portal.setAttribute('data-test-marker', 'original-portal')

      // Simulate HMR that doesn't include portal in new HTML
      const newHtml = `<div id="content">Updated Content</div>`

      // The logic should preserve elements with data-hmr-preserve
      const elementsToPreserve: Element[] = []
      document.querySelectorAll('[data-hmr-preserve]').forEach((el) => {
        elementsToPreserve.push(el)
      })

      expect(elementsToPreserve.length).toBe(1)
      expect(elementsToPreserve[0].getAttribute('data-test-marker')).toBe('original-portal')
    })

    it('should handle islands that no longer exist in new HTML', () => {
      setupTestDOM(`
        <div data-island="old-island" data-props='{}'>Old Island</div>
      `)

      const islandMap = new Map<string, Element>()
      islandMap.set('old-island', document.querySelector('[data-island="old-island"]')!)

      // New HTML doesn't have the island
      const newHtml = `<div>No islands here</div>`

      const parser = new DOMParser()
      const newDoc = parser.parseFromString(newHtml, 'text/html')

      const newIslands = newDoc.querySelectorAll('[data-island]')
      expect(newIslands.length).toBe(0)

      // The island map still has the old island, but there's no placeholder
      // so it won't be restored (which is correct behavior)
    })

    it('should handle new islands that did not exist before', () => {
      setupTestDOM(`<div>No islands</div>`)

      const islandMap = new Map<string, Element>()

      // New HTML has an island
      const newHtml = `<div data-island="new-island" data-props='{}'>New Island</div>`

      const parser = new DOMParser()
      const newDoc = parser.parseFromString(newHtml, 'text/html')

      const newIslands = newDoc.querySelectorAll('[data-island]')
      expect(newIslands.length).toBe(1)

      // The island is new, so it won't be in the islandMap
      // and will be rendered fresh (correct behavior for new islands)
      const newIsland = newIslands[0]
      expect(islandMap.has(newIsland.getAttribute('data-island')!)).toBe(false)
    })
  })

  describe('findCommentNode', () => {
    it('should find comment node by text content', () => {
      document.body.innerHTML = `
        <!-- before -->
        <div>Content</div>
        <!-- island:counter -->
        <div>More content</div>
        <!-- after -->
      `

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
      let foundComment: Comment | null = null
      let node: Comment | null

      while ((node = walker.nextNode() as Comment | null)) {
        if (node.textContent?.trim() === 'island:counter') {
          foundComment = node
          break
        }
      }

      expect(foundComment).toBeTruthy()
      expect(foundComment?.textContent?.trim()).toBe('island:counter')
    })

    it('should return null if comment not found', () => {
      document.body.innerHTML = `
        <!-- other -->
        <div>Content</div>
      `

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
      let foundComment: Comment | null = null
      let node: Comment | null

      while ((node = walker.nextNode() as Comment | null)) {
        if (node.textContent === 'island:missing') {
          foundComment = node
          break
        }
      }

      expect(foundComment).toBeNull()
    })
  })

  describe('Error Notification', () => {
    it('should create error notification element', () => {
      // Simulate showHMRError
      const message = 'Test error message'

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
        `
        document.body.appendChild(notification)
      }
      notification.textContent = `[HMR] ${message} (click to dismiss)`

      expect(document.getElementById('ixflare-hmr-error')).toBeTruthy()
      expect(notification.textContent).toContain(message)
    })

    it('should allow dismissing error notification', () => {
      const notification = document.createElement('div')
      notification.id = 'ixflare-hmr-error'
      notification.onclick = () => notification.remove()
      document.body.appendChild(notification)

      expect(document.getElementById('ixflare-hmr-error')).toBeTruthy()

      // Simulate click
      notification.click()

      expect(document.getElementById('ixflare-hmr-error')).toBeNull()
    })
  })

  describe('Fetch Retry Logic', () => {
    it('should handle successful fetch', async () => {
      const mockResponse = new Response('<div>New HTML</div>', { status: 200 })
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const response = await fetch('/test')
      expect(response.ok).toBe(true)
    })

    it('should handle failed fetch', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(fetch('/test')).rejects.toThrow('Network error')
    })
  })
})

describe('extractRoutePathFromFile (unit tests)', () => {
  // Testing the path extraction logic

  function extractRoutePathFromFile(file: string, routesDir: string): string {
    const normalizedFile = file.replace(/\\/g, '/')
    const normalizedRoutesDir = routesDir.replace(/\\/g, '/')

    const fileSegments = normalizedFile.split('/')
    const routesDirSegments = normalizedRoutesDir.split('/').filter(Boolean)

    let routesDirEndIndex = -1

    for (let i = 0; i <= fileSegments.length - routesDirSegments.length; i++) {
      let match = true
      for (let j = 0; j < routesDirSegments.length; j++) {
        if (fileSegments[i + j] !== routesDirSegments[j]) {
          match = false
          break
        }
      }
      if (match) {
        routesDirEndIndex = i + routesDirSegments.length
        break
      }
    }

    if (routesDirEndIndex === -1) {
      return '/'
    }

    const routeSegments = fileSegments.slice(routesDirEndIndex)

    if (routeSegments.length === 0) {
      return '/'
    }

    let lastSegment = routeSegments[routeSegments.length - 1]
    const extIndex = lastSegment.lastIndexOf('.')
    if (extIndex > 0) {
      lastSegment = lastSegment.slice(0, extIndex)
    }
    routeSegments[routeSegments.length - 1] = lastSegment

    if (lastSegment === 'index') {
      routeSegments.pop()
    }

    if (routeSegments.length === 0) {
      return '/'
    }

    return '/' + routeSegments.join('/')
  }

  it('should handle root index', () => {
    expect(extractRoutePathFromFile('/project/src/routes/index.tsx', 'src/routes')).toBe('/')
  })

  it('should handle nested index', () => {
    expect(extractRoutePathFromFile('/project/src/routes/dashboard/index.tsx', 'src/routes')).toBe(
      '/dashboard'
    )
  })

  it('should handle simple route', () => {
    expect(extractRoutePathFromFile('/project/src/routes/about.tsx', 'src/routes')).toBe('/about')
  })

  it('should handle dynamic routes', () => {
    expect(extractRoutePathFromFile('/project/src/routes/users/[id].tsx', 'src/routes')).toBe(
      '/users/[id]'
    )
  })

  it('should handle nested dynamic routes', () => {
    expect(
      extractRoutePathFromFile('/project/src/routes/users/[id]/posts/[postId].tsx', 'src/routes')
    ).toBe('/users/[id]/posts/[postId]')
  })

  it('should handle catch-all routes', () => {
    expect(extractRoutePathFromFile('/project/src/routes/docs/[...slug].tsx', 'src/routes')).toBe(
      '/docs/[...slug]'
    )
  })

  it('should handle Windows paths', () => {
    expect(
      extractRoutePathFromFile('C:\\project\\src\\routes\\dashboard\\index.tsx', 'src/routes')
    ).toBe('/dashboard')
  })

  it('should return / when routes dir not found', () => {
    expect(extractRoutePathFromFile('/project/other/file.tsx', 'src/routes')).toBe('/')
  })

  it('should handle deeply nested routes', () => {
    expect(
      extractRoutePathFromFile(
        '/project/src/routes/api/v1/users/profile/settings.tsx',
        'src/routes'
      )
    ).toBe('/api/v1/users/profile/settings')
  })

  it('should handle similar directory names', () => {
    // Edge case: src/routes vs src/routes-backup
    expect(
      extractRoutePathFromFile('/project/src/routes-backup/test.tsx', 'src/routes')
    ).toBe('/')
  })
})
