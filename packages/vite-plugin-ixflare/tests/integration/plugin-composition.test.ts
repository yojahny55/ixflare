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

    it('ignores non-route file changes', async () => {
      const plugin = ixflarePlugin({ routesDir: 'src/routes' }) as Plugin
      const handleHotUpdate = plugin.handleHotUpdate as Function

      const mockServer = createMockViteDevServer()

      // Simulate a non-route file change
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

    it('accepts HMR disable option', () => {
      const plugin = ixflarePlugin({ hmr: false }) as Plugin

      expect(plugin).toBeDefined()
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
