/**
 * @module tests/client/hydrate
 * @description Tests for client-side island hydration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock react-dom/client before importing the module
vi.mock('react-dom/client', () => ({
  hydrateRoot: vi.fn(),
}))

describe('Client Hydration', () => {
  let mockQuerySelectorAll: ReturnType<typeof vi.fn>
  let mockQuerySelector: ReturnType<typeof vi.fn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Reset module cache to get fresh imports
    vi.resetModules()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  describe('hydrateIslands', () => {
    it('should find all data-island elements', async () => {
      const mockElements = [
        createMockElement('counter-1', '{"count":5}', 'immediate'),
        createMockElement('search-1', '{"query":""}', 'idle'),
      ]

      mockQuerySelectorAll = vi.fn().mockReturnValue(mockElements)

      // Mock window with requestIdleCallback for idle strategy
      vi.stubGlobal('window', {
        requestIdleCallback: vi.fn((cb: () => void) => {
          cb()
          return 1
        }),
      })
      vi.stubGlobal('requestIdleCallback', vi.fn((cb: () => void) => {
        cb()
        return 1
      }))

      // Mock document
      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      expect(mockQuerySelectorAll).toHaveBeenCalledWith('[data-island]')
    })

    it('should parse props from data-props attribute', async () => {
      const mockElement = createMockElement('counter-1', '{"count":5,"label":"Clicks"}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Props should be parsed (verified by no parse error logged)
      const parseCalls = consoleErrorSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('Failed to parse props')
      )
      expect(parseCalls.length).toBe(0)
    })

    it('should handle empty props', async () => {
      const mockElement = createMockElement('counter-1', '{}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      const parseCalls = consoleErrorSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('Failed to parse props')
      )
      expect(parseCalls.length).toBe(0)
    })

    it('should handle missing data-props attribute', async () => {
      const mockElement = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return 'counter-1'
          if (attr === 'data-props') return null // Missing props
          if (attr === 'data-load') return 'immediate'
          return null
        }),
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      }
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Should default to empty object, no parse error
      const parseCalls = consoleErrorSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('Failed to parse props')
      )
      expect(parseCalls.length).toBe(0)
    })

    it('should skip elements with missing data-island attribute', async () => {
      const mockElement = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return null // Missing island ID
          return null
        }),
        firstChild: null,
      }
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Island Hydration Error] Missing data-island attribute'
      )
    })

    it('should log error for invalid JSON props', async () => {
      const mockElement = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return 'counter-1'
          if (attr === 'data-props') return '{ invalid json }'
          if (attr === 'data-load') return 'immediate'
          return null
        }),
        firstChild: null,
      }
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // parseIslandProps logs: console.error(`[Island Hydration Error] ${islandId}: Failed to parse props`, error)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Island Hydration Error] counter-1: Failed to parse props',
        expect.anything()
      )
    })

    it('should use custom selector when provided', async () => {
      mockQuerySelectorAll = vi.fn().mockReturnValue([])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands('[data-custom-island]')

      expect(mockQuerySelectorAll).toHaveBeenCalledWith('[data-custom-island]')
    })
  })

  describe('Hydration Loading Strategies', () => {
    it('should hydrate immediate islands on call', async () => {
      const mockElement = createMockElement('counter-1', '{"count":5}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Immediate hydration is attempted
      // With no registry, we expect a "not found in registry" error
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('counter-1')
      )
    })

    it('should defer idle islands to requestIdleCallback', async () => {
      const mockRequestIdleCallback = vi.fn((callback: () => void) => {
        callback() // Execute immediately for testing
        return 1
      })

      vi.stubGlobal('requestIdleCallback', mockRequestIdleCallback)
      vi.stubGlobal('window', { requestIdleCallback: mockRequestIdleCallback })

      const mockElement = createMockElement('counter-1', '{"count":5}', 'idle')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      expect(mockRequestIdleCallback).toHaveBeenCalled()
    })

    it('should fallback to setTimeout when requestIdleCallback unavailable', async () => {
      const mockSetTimeout = vi.fn((callback: () => void, delay: number) => {
        callback()
        return 1
      })

      // Remove requestIdleCallback
      vi.stubGlobal('window', {})
      vi.stubGlobal('setTimeout', mockSetTimeout)

      const mockElement = createMockElement('counter-1', '{"count":5}', 'idle')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1)
    })

    it('should defer visible islands to IntersectionObserver', async () => {
      const mockObserve = vi.fn()
      const mockUnobserve = vi.fn()

      // Create a proper constructor mock
      class MockIntersectionObserver {
        constructor(public callback: IntersectionObserverCallback) {}
        observe = mockObserve
        unobserve = mockUnobserve
        disconnect = vi.fn()
      }

      vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
      vi.stubGlobal('window', { IntersectionObserver: MockIntersectionObserver })

      const mockElement = createMockElement('counter-1', '{"count":5}', 'visible')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      expect(mockObserve).toHaveBeenCalledWith(mockElement)
    })

    it('should fallback to immediate when IntersectionObserver unavailable', async () => {
      // Remove IntersectionObserver
      vi.stubGlobal('window', {})

      const mockElement = createMockElement('counter-1', '{"count":5}', 'visible')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Should attempt immediate hydration (will fail registry lookup but no IntersectionObserver error)
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Check no IntersectionObserver-related error
      const observerErrors = consoleErrorSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('IntersectionObserver')
      )
      expect(observerErrors.length).toBe(0)
    })

    it('should warn on unknown load strategy and fallback to immediate', async () => {
      const mockElement = createMockElement('counter-1', '{"count":5}', 'unknown-strategy')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Island Hydration Warning] counter-1: Unknown load strategy "unknown-strategy", using immediate'
      )
    })

    it('should default to immediate when data-load not set', async () => {
      const mockElement = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return 'counter-1'
          if (attr === 'data-props') return '{}'
          if (attr === 'data-load') return null // No load strategy
          return null
        }),
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      }
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Should not warn about unknown strategy
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should catch hydration errors per-island', async () => {
      const mockElement = createMockElement('counter-1', '{"count":5}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Wait for async hydration attempt
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Error should be caught and logged (component not in registry)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('counter-1')
      )
    })

    it('should continue hydrating other islands on error', async () => {
      const mockElement1 = createMockElement('counter-1', '{"count":5}', 'immediate')
      const mockElement2 = createMockElement('counter-2', '{"count":10}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement1, mockElement2])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // Wait for async hydration attempts
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Both islands should have been attempted
      const errorCalls = consoleErrorSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('Component not found in registry')
      )
      expect(errorCalls.length).toBe(2)
    })

    it('should log error with island ID', async () => {
      const mockElement = createMockElement('my-special-island', '{}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('my-special-island')
      )
    })

    it('should preserve SSR content on hydration failure', async () => {
      // The SSR content is preserved because we don't remove or modify the DOM
      // on hydration failure - we just log the error and continue
      const mockElement = createMockElement('counter-1', '{}', 'immediate')
      const mockInnerHTML = '<button>Count: 0</button>'

      // Add innerHTML to mock element
      Object.defineProperty(mockElement, 'innerHTML', {
        value: mockInnerHTML,
        writable: true,
      })

      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      await new Promise((resolve) => setTimeout(resolve, 10))

      // innerHTML should remain unchanged (SSR content preserved)
      expect((mockElement as { innerHTML: string }).innerHTML).toBe(mockInnerHTML)
    })
  })

  describe('hydrateIslandById', () => {
    it('should find island by ID', async () => {
      const mockElement = createMockElement('counter-1', '{"count":5}', 'immediate')
      mockQuerySelector = vi.fn().mockReturnValue(mockElement)

      vi.stubGlobal('document', {
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: mockQuerySelector,
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslandById } = await import('@/client/hydrate')
      hydrateIslandById('counter-1')

      expect(mockQuerySelector).toHaveBeenCalledWith('[data-island="counter-1"]')
    })

    it('should log error when island not found', async () => {
      mockQuerySelector = vi.fn().mockReturnValue(null)

      vi.stubGlobal('document', {
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: mockQuerySelector,
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslandById } = await import('@/client/hydrate')
      hydrateIslandById('nonexistent-island')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Island Hydration Error] Island "nonexistent-island" not found in DOM'
      )
    })
  })

  describe('Multiple Islands', () => {
    it('should handle multiple islands on same page', async () => {
      const mockElements = [
        createMockElement('counter-1', '{"count":1}', 'immediate'),
        createMockElement('counter-2', '{"count":2}', 'idle'),
        createMockElement('search-1', '{"query":"test"}', 'visible'),
      ]

      mockQuerySelectorAll = vi.fn().mockReturnValue(mockElements)

      const mockRequestIdleCallback = vi.fn((cb: () => void) => {
        cb()
        return 1
      })
      const mockObserve = vi.fn()

      // Create proper IntersectionObserver mock
      class MockIntersectionObserver {
        constructor(public callback: IntersectionObserverCallback) {}
        observe = mockObserve
        unobserve = vi.fn()
        disconnect = vi.fn()
      }

      vi.stubGlobal('requestIdleCallback', mockRequestIdleCallback)
      vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
      vi.stubGlobal('window', {
        requestIdleCallback: mockRequestIdleCallback,
        IntersectionObserver: MockIntersectionObserver,
      })

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands } = await import('@/client/hydrate')
      hydrateIslands()

      // All three islands should be processed with their respective strategies
      expect(mockQuerySelectorAll).toHaveBeenCalled()
      expect(mockRequestIdleCallback).toHaveBeenCalled() // For idle island
      expect(mockObserve).toHaveBeenCalled() // For visible island
    })
  })

  describe('Island Registry', () => {
    it('should allow setting and getting the registry', async () => {
      const { setIslandRegistry, getIslandRegistry } = await import('@/client/hydrate')

      const mockRegistry = {
        counter: () => Promise.resolve({ default: () => null }),
      }

      setIslandRegistry(mockRegistry as Record<string, () => Promise<{ default: React.ComponentType<unknown> }>>)
      const registry = getIslandRegistry()

      expect(registry).toBe(mockRegistry)
    })

    it('should hydrate component from registry', async () => {
      const mockComponent = vi.fn(() => null)
      const mockRegistry = {
        'test-island': () => Promise.resolve({ default: mockComponent }),
      }

      const mockElement = createMockElement('test-island', '{"value":42}', 'immediate')
      mockQuerySelectorAll = vi.fn().mockReturnValue([mockElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const { hydrateIslands, setIslandRegistry } = await import('@/client/hydrate')
      setIslandRegistry(mockRegistry as Record<string, () => Promise<{ default: React.ComponentType<unknown> }>>)
      hydrateIslands()

      await new Promise((resolve) => setTimeout(resolve, 10))

      // hydrateRoot should have been called (via the mock)
      const { hydrateRoot } = await import('react-dom/client')
      expect(hydrateRoot).toHaveBeenCalled()
    })
  })

  describe('Nested islands hydration order', () => {
    it('should hydrate islands in DOM order (parent before child)', async () => {
      vi.resetModules()

      const hydrationOrder: string[] = []

      // Create parent and child island elements in DOM order
      const parentElement = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return 'parent-island'
          if (attr === 'data-props') return '{}'
          if (attr === 'data-load') return 'immediate'
          return null
        }),
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      }

      const childElement = {
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return 'child-island'
          if (attr === 'data-props') return '{}'
          if (attr === 'data-load') return 'immediate'
          return null
        }),
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      }

      // Mock querySelectorAll to return elements in document order (parent first)
      const mockQuerySelectorAll = vi.fn().mockReturnValue([parentElement, childElement])

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      // Mock registry that tracks hydration order
      const mockRegistry = {
        'parent-island': vi.fn(async () => {
          hydrationOrder.push('parent')
          return {
            default: function ParentComponent() {
              return null
            },
          }
        }),
        'child-island': vi.fn(async () => {
          hydrationOrder.push('child')
          return {
            default: function ChildComponent() {
              return null
            },
          }
        }),
      }

      const { hydrateIslands, setIslandRegistry } = await import('@/client/hydrate')
      setIslandRegistry(mockRegistry as unknown as Record<string, () => Promise<{ default: React.ComponentType<unknown> }>>)
      hydrateIslands()

      // Wait for async hydration
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify hydration happened in DOM order (parent before child)
      expect(hydrationOrder[0]).toBe('parent')
      expect(hydrationOrder[1]).toBe('child')
      expect(mockRegistry['parent-island']).toHaveBeenCalled()
      expect(mockRegistry['child-island']).toHaveBeenCalled()
    })

    it('should process deeply nested islands in correct order', async () => {
      vi.resetModules()

      const hydrationOrder: string[] = []

      // Create elements representing: grandparent > parent > child
      const elements = ['grandparent', 'parent', 'child'].map((name) => ({
        getAttribute: vi.fn((attr: string) => {
          if (attr === 'data-island') return `${name}-island`
          if (attr === 'data-props') return '{}'
          if (attr === 'data-load') return 'immediate'
          return null
        }),
        firstChild: null,
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      }))

      const mockQuerySelectorAll = vi.fn().mockReturnValue(elements)

      vi.stubGlobal('document', {
        querySelectorAll: mockQuerySelectorAll,
        querySelector: vi.fn(),
        createElement: vi.fn().mockReturnValue({
          style: {},
          textContent: '',
          appendChild: vi.fn(),
          insertBefore: vi.fn(),
        }),
      })

      const mockRegistry = {
        'grandparent-island': vi.fn(async () => {
          hydrationOrder.push('grandparent')
          return { default: () => null }
        }),
        'parent-island': vi.fn(async () => {
          hydrationOrder.push('parent')
          return { default: () => null }
        }),
        'child-island': vi.fn(async () => {
          hydrationOrder.push('child')
          return { default: () => null }
        }),
      }

      const { hydrateIslands, setIslandRegistry } = await import('@/client/hydrate')
      setIslandRegistry(mockRegistry as unknown as Record<string, () => Promise<{ default: React.ComponentType<unknown> }>>)
      hydrateIslands()

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify hydration order follows DOM order
      expect(hydrationOrder).toEqual(['grandparent', 'parent', 'child'])
    })
  })
})

/**
 * Helper to create mock DOM element
 */
function createMockElement(
  islandId: string,
  props: string,
  loadStrategy: string
): {
  getAttribute: ReturnType<typeof vi.fn>
  firstChild: null
  appendChild: ReturnType<typeof vi.fn>
  insertBefore: ReturnType<typeof vi.fn>
} {
  return {
    getAttribute: vi.fn((attr: string) => {
      if (attr === 'data-island') return islandId
      if (attr === 'data-props') return props
      if (attr === 'data-load') return loadStrategy
      return null
    }),
    firstChild: null,
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
  }
}
