/**
 * @module tests/hydration-manifest
 * @description Tests for hydration manifest generation
 */

import { describe, it, expect } from 'vitest'
import { generateHydrationManifest } from '../src/hydration-manifest'
import type { DiscoveredIsland } from '../src/island-discovery'

describe('Hydration Manifest Generation', () => {
  describe('generateHydrationManifest', () => {
    // CRITICAL: Test that absolute paths are correctly converted to relative paths
    // This test uses absolute paths (like the real discoverIslands output) and verifies
    // they correctly match against Vite manifest keys (which use relative paths)
    it('should convert absolute paths to relative for Vite manifest lookup', () => {
      const projectRoot = '/home/user/project'

      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'counter',
          // discoverIslands returns ABSOLUTE paths
          filePath: '/home/user/project/src/components/Counter.client.tsx',
          componentName: 'Counter',
          loadStrategy: 'immediate',
          props: ['initialCount'],
        },
      ]

      const viteManifest = {
        // Vite manifest uses RELATIVE paths
        'src/components/Counter.client.tsx': {
          file: 'assets/Counter-abc123.js',
          isEntry: false,
          isDynamicEntry: true,
          imports: ['_shared-xyz789.js'],
        },
      }

      // Must pass projectRoot to enable path conversion
      const manifest = generateHydrationManifest(discoveredIslands, viteManifest, projectRoot)

      // Verify the lookup succeeded (would fail without path conversion)
      expect(manifest.islands['Counter']).toBeDefined()
      expect(manifest.islands['Counter'].chunk).toBe('/assets/Counter-abc123.js')
      expect(manifest.islands['Counter'].imports).toEqual(['_shared-xyz789.js'])
      expect(manifest.islands['Counter'].props).toEqual(['initialCount'])
    })

    it('should include props list from discovered islands', () => {
      const projectRoot = '/project'

      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'counter',
          filePath: '/project/src/Counter.client.tsx',
          componentName: 'Counter',
          loadStrategy: 'immediate',
          props: ['count', 'onIncrement', 'label'],
        },
      ]

      const viteManifest = {
        'src/Counter.client.tsx': {
          file: 'assets/Counter-abc123.js',
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest, projectRoot)

      expect(manifest.islands['Counter'].props).toEqual(['count', 'onIncrement', 'label'])
    })

    it('should handle empty props array', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'simple',
          filePath: 'src/Simple.client.tsx',
          componentName: 'Simple',
          loadStrategy: 'immediate',
          props: [],
        },
      ]

      const viteManifest = {
        'src/Simple.client.tsx': {
          file: 'assets/Simple-abc.js',
          isEntry: false,
          isDynamicEntry: true,
        },
      }

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest)

      expect(manifest.islands['Simple'].props).toEqual([])
    })

    it('should generate correct marker IDs', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'search-box',
          filePath: 'src/SearchBox.client.tsx',
          componentName: 'SearchBox',
          loadStrategy: 'immediate',
          props: ['query', 'onSearch'],
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
          props: [],
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
      const projectRoot = '/project'

      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'missing',
          filePath: '/project/src/Missing.client.tsx',
          componentName: 'Missing',
          loadStrategy: 'immediate',
          props: [],
        },
      ]

      const viteManifest = {}

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest, projectRoot)

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
          props: [],
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

    it('should handle multiple islands with absolute paths', () => {
      const projectRoot = '/app'

      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'counter',
          filePath: '/app/src/Counter.client.tsx',
          componentName: 'Counter',
          loadStrategy: 'immediate',
          props: ['count'],
        },
        {
          id: 'search-box',
          filePath: '/app/src/SearchBox.client.tsx',
          componentName: 'SearchBox',
          loadStrategy: 'idle',
          props: ['query'],
        },
        {
          id: 'user-menu',
          filePath: '/app/src/UserMenu.client.tsx',
          componentName: 'UserMenu',
          loadStrategy: 'visible',
          props: ['user', 'onLogout'],
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

      const manifest = generateHydrationManifest(discoveredIslands, viteManifest, projectRoot)

      expect(Object.keys(manifest.islands)).toHaveLength(3)
      expect(manifest.islands['Counter']).toBeDefined()
      expect(manifest.islands['SearchBox']).toBeDefined()
      expect(manifest.islands['UserMenu']).toBeDefined()
      expect(manifest.islands['Counter'].props).toEqual(['count'])
      expect(manifest.islands['UserMenu'].props).toEqual(['user', 'onLogout'])
    })

    it('should handle nested islands', () => {
      const discoveredIslands: DiscoveredIsland[] = [
        {
          id: 'parent',
          filePath: 'src/Parent.client.tsx',
          componentName: 'Parent',
          loadStrategy: 'immediate',
          props: [],
        },
        {
          id: 'child',
          filePath: 'src/Child.client.tsx',
          componentName: 'Child',
          loadStrategy: 'immediate',
          props: [],
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
          props: [],
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
          props: [],
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

    // CRITICAL: This test verifies Windows path handling
    // Skip on non-Windows platforms since path.relative() behaves differently
    it.skipIf(process.platform !== 'win32')(
      'should normalize Windows paths in manifest lookup',
      () => {
        const projectRoot = 'C:\\Users\\dev\\project'

        const discoveredIslands: DiscoveredIsland[] = [
          {
            id: 'counter',
            // Windows-style absolute path
            filePath: 'C:\\Users\\dev\\project\\src\\components\\Counter.client.tsx',
            componentName: 'Counter',
            loadStrategy: 'immediate',
            props: ['count'],
          },
        ]

        const viteManifest = {
          // Vite always uses forward slashes
          'src/components/Counter.client.tsx': {
            file: 'assets/Counter-abc.js',
            isEntry: false,
            isDynamicEntry: true,
          },
        }

        const manifest = generateHydrationManifest(discoveredIslands, viteManifest, projectRoot)

        expect(manifest.islands['Counter']).toBeDefined()
      }
    )
  })
})
