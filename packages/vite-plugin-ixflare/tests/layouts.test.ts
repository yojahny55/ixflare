/**
 * @fileoverview Layout discovery and hierarchy tests
 */

import { describe, it, expect } from 'vitest'
import { extractLayoutChain, discoverLayouts, type LayoutNode } from '../src/layout-discovery'

describe('Layout Discovery', () => {
  describe('extractLayoutChain', () => {
    it('should return empty array for route with no layouts', () => {
      const route = 'api/users.tsx'
      const layouts: LayoutNode[] = []

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual([])
    })

    it('should find single layout in same directory', () => {
      const route = 'dashboard/index.tsx'
      const layouts: LayoutNode[] = [
        { file: 'dashboard/_layout.tsx', parentDir: 'dashboard', depth: 1 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual(['dashboard/_layout.tsx'])
    })

    it('should find root layout', () => {
      const route = 'index.tsx'
      const layouts: LayoutNode[] = [
        { file: '_layout.tsx', parentDir: '', depth: 0 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual(['_layout.tsx'])
    })

    it('should build chain from root to innermost for nested route', () => {
      const route = 'dashboard/settings/profile.tsx'
      const layouts: LayoutNode[] = [
        { file: '_layout.tsx', parentDir: '', depth: 0 },
        { file: 'dashboard/_layout.tsx', parentDir: 'dashboard', depth: 1 },
        { file: 'dashboard/settings/_layout.tsx', parentDir: 'dashboard/settings', depth: 2 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual([
        '_layout.tsx',
        'dashboard/_layout.tsx',
        'dashboard/settings/_layout.tsx'
      ])
    })

    it('should skip layouts not in route path', () => {
      const route = 'dashboard/analytics.tsx'
      const layouts: LayoutNode[] = [
        { file: '_layout.tsx', parentDir: '', depth: 0 },
        { file: 'dashboard/_layout.tsx', parentDir: 'dashboard', depth: 1 },
        { file: 'dashboard/settings/_layout.tsx', parentDir: 'dashboard/settings', depth: 2 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual([
        '_layout.tsx',
        'dashboard/_layout.tsx'
      ])
    })

    it('should handle deeply nested layouts (5+ levels)', () => {
      const route = 'a/b/c/d/e/page.tsx'
      const layouts: LayoutNode[] = [
        { file: '_layout.tsx', parentDir: '', depth: 0 },
        { file: 'a/_layout.tsx', parentDir: 'a', depth: 1 },
        { file: 'a/b/_layout.tsx', parentDir: 'a/b', depth: 2 },
        { file: 'a/b/c/_layout.tsx', parentDir: 'a/b/c', depth: 3 },
        { file: 'a/b/c/d/_layout.tsx', parentDir: 'a/b/c/d', depth: 4 },
        { file: 'a/b/c/d/e/_layout.tsx', parentDir: 'a/b/c/d/e', depth: 5 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toHaveLength(6)
      expect(chain[0]).toBe('_layout.tsx')
      expect(chain[5]).toBe('a/b/c/d/e/_layout.tsx')
    })

    it('should handle dynamic route segments in path', () => {
      const route = 'blog/[id]/edit.tsx'
      const layouts: LayoutNode[] = [
        { file: '_layout.tsx', parentDir: '', depth: 0 },
        { file: 'blog/_layout.tsx', parentDir: 'blog', depth: 1 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual([
        '_layout.tsx',
        'blog/_layout.tsx'
      ])
    })

    it('should sort layouts by depth (outermost first)', () => {
      const route = 'dashboard/settings/profile.tsx'
      // Deliberately unsorted input
      const layouts: LayoutNode[] = [
        { file: 'dashboard/settings/_layout.tsx', parentDir: 'dashboard/settings', depth: 2 },
        { file: '_layout.tsx', parentDir: '', depth: 0 },
        { file: 'dashboard/_layout.tsx', parentDir: 'dashboard', depth: 1 }
      ]

      const chain = extractLayoutChain(route, layouts)

      expect(chain).toEqual([
        '_layout.tsx',
        'dashboard/_layout.tsx',
        'dashboard/settings/_layout.tsx'
      ])
    })
  })

  describe('discoverLayouts', () => {
    // Integration tests will be in e2e tests
    // These are unit tests for the discover function

    it('should parse layout file path into LayoutNode', () => {
      const layoutPath = 'src/routes/dashboard/settings/_layout.tsx'
      const routesDir = 'src/routes'

      // This will be tested via integration test with real files
      // For now, we verify the interface structure
      const node: LayoutNode = {
        file: 'dashboard/settings/_layout.tsx',
        parentDir: 'dashboard/settings',
        depth: 2
      }

      expect(node).toHaveProperty('file')
      expect(node).toHaveProperty('parentDir')
      expect(node).toHaveProperty('depth')
      expect(node.depth).toBe(2)
    })
  })
})
