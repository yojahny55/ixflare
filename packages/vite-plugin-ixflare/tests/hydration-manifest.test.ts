/**
 * @module tests/hydration-manifest
 * @description Tests for hydration manifest generation
 */

import { describe, it, expect } from 'vitest'
import { generateHydrationManifest } from '../src/hydration-manifest'
import type { DiscoveredIsland } from '../src/island-discovery'

describe('Hydration Manifest Generation', () => {
  describe('generateHydrationManifest', () => {
    it('should map islands to Vite chunks', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'counter',
          filePath: 'src/components/Counter.client.tsx',
          componentName: 'Counter',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {
        'src/components/Counter.client.tsx': {
          file: 'assets/Counter-abc123.js',
          isEntry: false,
          isDynamicEntry: true,
          imports: ['_shared-xyz789.js'],
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['Counter']).toBeDefined()
      expect(manifest.islands['Counter'].chunk).toBe('/assets/Counter-abc123.js')
      expect(manifest.islands['Counter'].imports).toEqual(['_shared-xyz789.js'])
    })

    it('should generate correct marker IDs', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'search-box',
          filePath: 'src/SearchBox.client.tsx',
          componentName: 'SearchBox',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {
        'src/SearchBox.client.tsx': {
          file: 'assets/SearchBox-def456.js',
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['SearchBox'].marker).toBe('data-island-search-box')
    })

    it('should include shared imports', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'widget',
          filePath: 'src/Widget.client.tsx',
          componentName: 'Widget',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {
        'src/Widget.client.tsx': {
          file: 'assets/Widget-123.js',
          isEntry: false,
          isDynamicEntry: true,
          imports: ['assets/react-core-abc.js', 'assets/utils-def.js'],
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['Widget'].imports).toEqual([
        'assets/react-core-abc.js',
        'assets/utils-def.js',
      ])
    })

    it('should handle missing Vite entries gracefully', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'missing',
          filePath: 'src/Missing.client.tsx',
          componentName: 'Missing',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {}

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      // Missing islands should not be included in manifest
      expect(manifest.islands['Missing']).toBeUndefined()
    })

    it('should include load strategy in manifest', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'lazy',
          filePath: 'src/Lazy.client.tsx',
          componentName: 'Lazy',
          loadStrategy: 'idle',
        },
      ]

      const viteManifest = {
        'src/Lazy.client.tsx': {
          file: 'assets/Lazy-xyz.js',
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['Lazy'].loadStrategy).toBe('idle')
    })

    it('should generate manifest metadata', () => {
      const discoveredIslands: DiscoveredIsland[] = []
      const viteManifest = {}

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.version).toBe('1.0.0')
      expect(manifest.generatedAt).toBeGreaterThan(0)
      expect(typeof manifest.generatedAt).toBe('number')
    })

    it('should handle multiple islands', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'counter',
          filePath: 'src/Counter.client.tsx',
          componentName: 'Counter',
          loadStrategy: 'immediate',
        },
        {
          id: 'search-box',
          filePath: 'src/SearchBox.client.tsx',
          componentName: 'SearchBox',
          loadStrategy: 'idle',
        },
        {
          id: 'user-menu',
          filePath: 'src/UserMenu.client.tsx',
          componentName: 'UserMenu',
          loadStrategy: 'visible',
        },
      ]

      const viteManifest = {
        'src/Counter.client.tsx': {
          file: 'assets/Counter-abc.js',
          isEntry: false,
          isDynamicEntry: true,
        },
        'src/SearchBox.client.tsx': {
          file: 'assets/SearchBox-def.js',
          isEntry: false,
          isDynamicEntry: true,
        },
        'src/UserMenu.client.tsx': {
          file: 'assets/UserMenu-ghi.js',
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(Object.keys(manifest.islands)).toHaveLength(3)
      expect(manifest.islands['Counter']).toBeDefined()
      expect(manifest.islands['SearchBox']).toBeDefined()
      expect(manifest.islands['UserMenu']).toBeDefined()
    })

    it('should handle nested islands', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'parent',
          filePath: 'src/Parent.client.tsx',
          componentName: 'Parent',
          loadStrategy: 'immediate',
        },
        {
          id: 'child',
          filePath: 'src/Child.client.tsx',
          componentName: 'Child',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {
        'src/Parent.client.tsx': {
          file: 'assets/Parent-aaa.js',
          isEntry: false,
          isDynamicEntry: true,
        },
        'src/Child.client.tsx': {
          file: 'assets/Child-bbb.js',
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      // Both islands should have separate entries
      expect(manifest.islands['Parent']).toBeDefined()
      expect(manifest.islands['Child']).toBeDefined()
      expect(manifest.islands['Parent'].chunk).not.toBe(manifest.islands['Child'].chunk)
    })

    it('should handle islands without imports', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'standalone',
          filePath: 'src/Standalone.client.tsx',
          componentName: 'Standalone',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {
        'src/Standalone.client.tsx': {
          file: 'assets/Standalone-xyz.js',
          isEntry: false,
          isDynamicEntry: true,
          // No imports field
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['Standalone'].imports).toEqual([])
    })

    it('should prepend / to chunk paths', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'component',
          filePath: 'src/Component.client.tsx',
          componentName: 'Component',
          loadStrategy: 'immediate',
        },
      ]

      const viteManifest = {
        'src/Component.client.tsx': {
          file: 'assets/Component-123.js', // No leading /
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['Component'].chunk).toBe('/assets/Component-123.js')
      expect(manifest.islands['Component'].chunk.startsWith('/')).toBe(true)
    })
  })
})
