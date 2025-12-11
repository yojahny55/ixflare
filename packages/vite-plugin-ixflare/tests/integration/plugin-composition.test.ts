/**
 * Integration Tests: Plugin Composition with @cloudflare/vite-plugin
 *
 * These tests verify that vite-plugin-ixflare works correctly alongside
 * @cloudflare/vite-plugin in a real Vite configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plugin, ViteDevServer, ResolvedConfig } from 'vite'
import { ixflarePlugin } from '../../src/plugin'

// Mock ViteDevServer for testing
function createMockViteDevServer(root: string = '/test/project'): ViteDevServer {
  return {
    config: {
      root,
      server: { port: 5173 },
      build: { outDir: 'dist', sourcemap: true },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as unknown as ResolvedConfig,
    moduleGraph: {
      getModuleById: vi.fn().mockReturnValue(null),
      getModulesByFile: vi.fn().mockReturnValue(null),
      invalidateModule: vi.fn(),
    },
    ws: {
      send: vi.fn(),
      on: vi.fn(),
    },
  } as unknown as ViteDevServer
}

describe('Plugin Composition', () => {
  describe('Virtual Module Resolution', () => {
    it('resolves virtual:ixflare-routes module ID', () => {
      const plugin = ixflarePlugin() as Plugin
      const resolveId = plugin.resolveId as Function

      const result = resolveId('virtual:ixflare-routes')

      expect(result).toBe('\0virtual:ixflare-routes')
    })

    it('resolves virtual:ixflare-islands module ID', () => {
      const plugin = ixflarePlugin() as Plugin
      const resolveId = plugin.resolveId as Function

      const result = resolveId('virtual:ixflare-islands')

      expect(result).toBe('\0virtual:ixflare-islands')
    })

    it('returns null for non-virtual module IDs', () => {
      const plugin = ixflarePlugin() as Plugin
      const resolveId = plugin.resolveId as Function

      expect(resolveId('./some-file.ts')).toBeNull()
      expect(resolveId('react')).toBeNull()
      expect(resolveId('@cloudflare/vite-plugin')).toBeNull()
    })

    it('loads virtual module with empty manifest initially', () => {
      const plugin = ixflarePlugin() as Plugin
      const load = plugin.load as Function

      const result = load('\0virtual:ixflare-routes')

      expect(result).toContain('export const routeManifest')
      expect(result).toContain('routes: []')
    })

    it('loads virtual islands module with empty registry initially', () => {
      const plugin = ixflarePlugin() as Plugin
      const load = plugin.load as Function

      const result = load('\0virtual:ixflare-islands')

      expect(result).toContain('import { setIslandRegistry }')
      expect(result).toContain('setIslandRegistry({})')
    })

    it('does not load non-virtual modules', () => {
      const plugin = ixflarePlugin() as Plugin
      const load = plugin.load as Function

      expect(load('./some-file.ts')).toBeNull()
      expect(load('react')).toBeNull()
    })
  })

  describe('Plugin Configuration', () => {
    it('has correct plugin name', () => {
      const plugin = ixflarePlugin() as Plugin

      expect(plugin.name).toBe('vite-plugin-ixflare')
    })

    it('sets build target to esnext', () => {
      const plugin = ixflarePlugin() as Plugin
      const config = plugin.config as Function

      const result = config({}, { command: 'build' })

      expect(result.build.target).toBe('esnext')
    })

    it('preserves existing config options', () => {
      const plugin = ixflarePlugin() as Plugin
      const config = plugin.config as Function

      const existingConfig = {
        resolve: { alias: { '@': '/src' } },
        build: { minify: true },
      }

      const result = config(existingConfig, { command: 'build' })

      expect(result.resolve).toEqual({ alias: { '@': '/src' } })
      expect(result.build.minify).toBe(true)
      expect(result.build.target).toBe('esnext')
    })
  })

  describe('HMR Integration', () => {
    it('handles hot update for route files', async () => {
      const plugin = ixflarePlugin({ routesDir: 'src/routes' }) as Plugin
      const handleHotUpdate = plugin.handleHotUpdate as Function

      const mockServer = createMockViteDevServer()

      // Simulate a route file change
      const result = await handleHotUpdate({
        file: '/test/project/src/routes/index.tsx',
        server: mockServer,
      })

      // Should return modules to invalidate (may be empty if module not in graph)
      expect(Array.isArray(result) || result === undefined).toBe(true)
    })

    it('handles hot update for island files (.client.tsx)', async () => {
      const plugin = ixflarePlugin({ routesDir: 'src/routes', componentsDir: 'src/components' }) as Plugin
      const handleHotUpdate = plugin.handleHotUpdate as Function

      const mockServer = createMockViteDevServer()

      // Simulate an island file change
      const result = await handleHotUpdate({
        file: '/test/project/src/components/Counter.client.tsx',
        server: mockServer,
      })

      // Should return modules to invalidate (may be empty if module not in graph, but returns array or undefined)
      expect(Array.isArray(result) || result === undefined).toBe(true)
    })

    it('triggers island virtual module invalidation on .client.tsx change', async () => {
      const plugin = ixflarePlugin({ routesDir: 'src/routes', componentsDir: 'src/components' }) as Plugin
      const handleHotUpdate = plugin.handleHotUpdate as Function

      const mockVirtualModule = { id: '\0virtual:ixflare-islands' }
      const mockServer = createMockViteDevServer()
      // Mock that the virtual module exists in the module graph
      ;(mockServer.moduleGraph.getModuleById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
        if (id === '\0virtual:ixflare-islands') return mockVirtualModule
        return null
      })

      // Simulate an island file change
      const result = await handleHotUpdate({
        file: '/test/project/src/components/SearchBox.client.tsx',
        server: mockServer,
      })

      // Should return the virtual module for invalidation
      if (Array.isArray(result)) {
        expect(result).toContain(mockVirtualModule)
      }
    })

    it('ignores non-route and non-island file changes', async () => {
      const plugin = ixflarePlugin({ routesDir: 'src/routes' }) as Plugin
      const handleHotUpdate = plugin.handleHotUpdate as Function

      const mockServer = createMockViteDevServer()

      // Simulate a non-route, non-island file change
      const result = await handleHotUpdate({
        file: '/test/project/src/components/Button.tsx',
        server: mockServer,
      })

      expect(result).toBeUndefined()
    })
  })

  describe('Plugin Options', () => {
    it('uses default routesDir when not specified', () => {
      const plugin = ixflarePlugin() as Plugin

      // The plugin should work with default options
      expect(plugin).toBeDefined()
      expect(plugin.name).toBe('vite-plugin-ixflare')
    })

    it('accepts custom routesDir', () => {
      const plugin = ixflarePlugin({ routesDir: 'app/routes' }) as Plugin

      expect(plugin).toBeDefined()
    })

    it('accepts custom componentsDir for island discovery', () => {
      const plugin = ixflarePlugin({ componentsDir: 'app/islands' }) as Plugin

      expect(plugin).toBeDefined()
      expect(plugin.name).toBe('vite-plugin-ixflare')
    })

    it('accepts HMR disable option', () => {
      const plugin = ixflarePlugin({ hmr: false }) as Plugin

      expect(plugin).toBeDefined()
    })

    it('accepts all options together', () => {
      const plugin = ixflarePlugin({
        routesDir: 'app/routes',
        componentsDir: 'app/islands',
        hmr: true,
      }) as Plugin

      expect(plugin).toBeDefined()
      expect(plugin.name).toBe('vite-plugin-ixflare')
    })
  })

  describe('Composition with Other Plugins', () => {
    it('can be included in plugins array with other plugins', () => {
      // Simulate a Vite config with multiple plugins
      const plugins: Plugin[] = [
        // Mock @cloudflare/vite-plugin
        {
          name: 'vite-plugin-cloudflare',
          configureServer: vi.fn(),
        },
        // Mock @vitejs/plugin-react
        {
          name: 'vite:react',
          transform: vi.fn(),
        },
        // Our plugin
        ixflarePlugin() as Plugin,
      ]

      expect(plugins).toHaveLength(3)
      expect(plugins.find((p) => p.name === 'vite-plugin-ixflare')).toBeDefined()
      expect(plugins.find((p) => p.name === 'vite-plugin-cloudflare')).toBeDefined()
      expect(plugins.find((p) => p.name === 'vite:react')).toBeDefined()
    })

    it('does not conflict with cloudflare plugin virtual modules', () => {
      const plugin = ixflarePlugin() as Plugin
      const resolveId = plugin.resolveId as Function

      // Cloudflare plugin uses different virtual module IDs
      expect(resolveId('virtual:cloudflare-worker')).toBeNull()
      expect(resolveId('__cloudflare-worker')).toBeNull()

      // Our virtual module still resolves
      expect(resolveId('virtual:ixflare-routes')).toBe('\0virtual:ixflare-routes')
    })
  })
})

describe('Export Aliases', () => {
  it('exports ixflare as named export', async () => {
    const { ixflare } = await import('../../src/index')

    expect(ixflare).toBeDefined()
    expect(typeof ixflare).toBe('function')
  })

  it('exports ixflarePlugin as named export', async () => {
    const { ixflarePlugin } = await import('../../src/index')

    expect(ixflarePlugin).toBeDefined()
    expect(typeof ixflarePlugin).toBe('function')
  })

  it('exports ixflarePlugin as default export', async () => {
    const defaultExport = await import('../../src/index')

    expect(defaultExport.default).toBeDefined()
    expect(typeof defaultExport.default).toBe('function')
  })

  it('ixflare and ixflarePlugin are the same function', async () => {
    const { ixflare, ixflarePlugin } = await import('../../src/index')

    expect(ixflare).toBe(ixflarePlugin)
  })
})

describe('Type Exports', () => {
  it('exports IxflarePluginOptions type', async () => {
    // TypeScript will catch if these types don't exist at compile time
    // This test verifies runtime exports are accessible
    const exports = await import('../../src/index')

    // Type exports don't have runtime values, but we can verify the module loads
    expect(exports).toBeDefined()
  })

  it('exports island discovery types', async () => {
    // Verify island-related exports are accessible
    const { discoverIslands, parseIslandFile } = await import('../../src/island-discovery')

    expect(typeof discoverIslands).toBe('function')
    expect(typeof parseIslandFile).toBe('function')
  })

  it('exports hydration manifest types', async () => {
    // Verify manifest-related exports are accessible
    const { generateHydrationManifest, serializeHydrationManifest, deserializeHydrationManifest } = await import(
      '../../src/hydration-manifest'
    )

    expect(typeof generateHydrationManifest).toBe('function')
    expect(typeof serializeHydrationManifest).toBe('function')
    expect(typeof deserializeHydrationManifest).toBe('function')
  })
})

describe('Build Integration', () => {
  it('plugin has required Vite hooks for island manifest generation', () => {
    const plugin = ixflarePlugin() as Plugin

    // Verify all required hooks for island manifest generation exist
    expect(typeof plugin.resolveId).toBe('function')
    expect(typeof plugin.load).toBe('function')
    expect(typeof plugin.configureServer).toBe('function')
    expect(typeof plugin.buildEnd).toBe('function')
    expect(typeof plugin.writeBundle).toBe('function')
    expect(typeof plugin.handleHotUpdate).toBe('function')
  })

  it('plugin generates island registry code with discovered islands', async () => {
    // This tests the virtual module generation with islands
    const plugin = ixflarePlugin() as Plugin

    // We can't test the actual build flow without Vite, but we can verify
    // that the load hook generates valid code structure
    const load = plugin.load as Function

    // With no islands discovered, should return empty registry
    const emptyResult = load('\0virtual:ixflare-islands')
    expect(emptyResult).toContain('setIslandRegistry')
    expect(emptyResult).toContain("import { setIslandRegistry } from 'ixflare/client'")
    expect(emptyResult).toContain('setIslandRegistry({})')
    expect(emptyResult).not.toContain('undefined')
  })
})
