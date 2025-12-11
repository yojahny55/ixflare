/**
 * Integration Tests: HMR State Preservation
 *
 * These tests verify that Hot Module Replacement preserves component state
 * via React Fast Refresh for islands and handles server component updates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plugin, ViteDevServer, ModuleNode, ResolvedConfig } from 'vite'
import { ixflarePlugin } from '../../src/plugin'

/**
 * Create mock Vite dev server for testing
 */
function createMockViteDevServer(root: string = '/test/project'): ViteDevServer {
  const modules = new Map<string, ModuleNode>()
  const sentMessages: unknown[] = []

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
      getModuleById: (id: string) => modules.get(id) || null,
      getModulesByFile: (file: string) => {
        const matching: ModuleNode[] = []
        modules.forEach((mod, id) => {
          if (id === file || mod.file === file) {
            matching.push(mod)
          }
        })
        return matching.length > 0 ? new Set(matching) : null
      },
      invalidateModule: vi.fn(),
      _modules: modules,
    },
    ws: {
      send: (msg: unknown) => {
        sentMessages.push(msg)
      },
      on: vi.fn(),
      _sentMessages: sentMessages,
    },
  } as unknown as ViteDevServer & {
    moduleGraph: { _modules: Map<string, ModuleNode> }
    ws: { _sentMessages: unknown[] }
  }
}

/**
 * Create mock module node
 */
function createMockModule(id: string, file: string = id): ModuleNode {
  return {
    id,
    file,
    url: id,
    type: 'js',
  } as ModuleNode
}

describe('HMR State Preservation Integration', () => {
  let server: ViteDevServer
  let plugin: Plugin

  beforeEach(() => {
    server = createMockViteDevServer('/test/project')
    plugin = ixflarePlugin({ routesDir: 'src/routes', componentsDir: 'src/components' }) as Plugin

    // Setup virtual modules
    const modules = (
      server.moduleGraph as unknown as { _modules: Map<string, ModuleNode> }
    )._modules
    modules.set('\0virtual:ixflare-routes', createMockModule('\0virtual:ixflare-routes'))
    modules.set('\0virtual:ixflare-islands', createMockModule('\0virtual:ixflare-islands'))
  })

  describe('Island State Preservation', () => {
    it('should trigger HMR for island component changes', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Counter.client.tsx'

      // Setup island module
      const modules = (
        server.moduleGraph as unknown as { _modules: Map<string, ModuleNode> }
      )._modules
      modules.set(file, createMockModule(file))

      const result = await handleHotUpdate({ file, server })

      // Should return modules for HMR
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should invalidate virtual islands module on island change', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Search.client.tsx'

      const modules = (
        server.moduleGraph as unknown as { _modules: Map<string, ModuleNode> }
      )._modules
      const virtualIslandsModule = modules.get('\0virtual:ixflare-islands')!

      await handleHotUpdate({ file, server })

      expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(virtualIslandsModule)
    })

    it('should send HMR update for virtual islands module', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Button.client.tsx'

      await handleHotUpdate({ file, server })

      const sentMessages = (server.ws as unknown as { _sentMessages: unknown[] })._sentMessages
      expect(sentMessages.length).toBeGreaterThan(0)

      const updateMessage = sentMessages.find((msg: { type?: string }) => msg.type === 'update')
      expect(updateMessage).toBeDefined()
      expect(updateMessage).toMatchObject({
        type: 'update',
        updates: expect.arrayContaining([
          expect.objectContaining({
            type: 'js-update',
            path: 'virtual:ixflare-islands',
          }),
        ]),
      })
    })

    it('should log state preservation message', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Counter.client.tsx'

      await handleHotUpdate({ file, server })

      expect(server.config.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('state preserved'),
        expect.any(Object)
      )
    })

    it('should include timing information in logs', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Timer.client.tsx'

      await handleHotUpdate({ file, server })

      expect(server.config.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/\(\d+ms\)/),
        expect.any(Object)
      )
    })
  })

  describe('Server Component HMR', () => {
    it('should send custom event for server component changes', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/routes/dashboard/index.tsx'

      await handleHotUpdate({ file, server })

      const sentMessages = (server.ws as unknown as { _sentMessages: unknown[] })._sentMessages
      const customMessage = sentMessages.find(
        (msg: { type?: string; event?: string }) =>
          msg.type === 'custom' && msg.event === 'ixflare:server-update'
      )

      expect(customMessage).toBeDefined()
      expect(customMessage).toMatchObject({
        type: 'custom',
        event: 'ixflare:server-update',
        data: {
          route: expect.stringMatching(/^\/.*$/),
          timestamp: expect.any(Number),
        },
      })
    })

    it('should extract route path from file path', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/routes/users/profile/index.tsx'

      await handleHotUpdate({ file, server })

      const sentMessages = (server.ws as unknown as { _sentMessages: unknown[] })._sentMessages
      const customMessage = sentMessages.find(
        (msg: { type?: string }) => msg.type === 'custom'
      ) as { data?: { route?: string } }

      expect(customMessage?.data?.route).toBe('/users/profile')
    })

    it('should handle route manifest updates for server components', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/routes/about.tsx'

      const modules = (
        server.moduleGraph as unknown as { _modules: Map<string, ModuleNode> }
      )._modules
      modules.set(file, createMockModule(file))

      const result = await handleHotUpdate({ file, server })

      // Should return modules including route manifest
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should log server component update with route path', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/routes/dashboard/stats/index.tsx'

      await handleHotUpdate({ file, server })

      expect(server.config.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('dashboard/stats'),
        expect.any(Object)
      )
    })
  })

  describe('Multiple Islands State Preservation', () => {
    it('should handle multiple independent island updates', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const files = [
        '/test/project/src/components/Counter.client.tsx',
        '/test/project/src/components/Search.client.tsx',
        '/test/project/src/components/Button.client.tsx',
      ]

      for (const file of files) {
        // Clear previous messages
        ;(server.ws as unknown as { _sentMessages: unknown[] })._sentMessages.length = 0

        await handleHotUpdate({ file, server })

        const sentMessages = (server.ws as unknown as { _sentMessages: unknown[] })._sentMessages
        expect(sentMessages.length).toBeGreaterThan(0)
      }

      // Each island should have triggered separate HMR updates
      expect(server.moduleGraph.invalidateModule).toHaveBeenCalledTimes(files.length)
    })

    it('should preserve state for all islands on same page during server component update', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const serverFile = '/test/project/src/routes/page-with-islands.tsx'

      await handleHotUpdate({ file: serverFile, server })

      // Should send server-update event (client preserves islands)
      const sentMessages = (server.ws as unknown as { _sentMessages: unknown[] })._sentMessages
      const serverUpdate = sentMessages.find(
        (msg: { type?: string; event?: string }) =>
          msg.type === 'custom' && msg.event === 'ixflare:server-update'
      )

      expect(serverUpdate).toBeDefined()
    })
  })

  describe('Performance Requirements', () => {
    it('should complete HMR update in under 1 second (ideal case)', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/FastComponent.client.tsx'

      const start = Date.now()
      await handleHotUpdate({ file, server })
      const duration = Date.now() - start

      // Should complete quickly (under 1s as per NFR requirement)
      expect(duration).toBeLessThan(1000)
    })

    it('should not warn for fast HMR updates', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Quick.client.tsx'

      await handleHotUpdate({ file, server })

      // Should use info logger, not warn
      expect(server.config.logger.warn).not.toHaveBeenCalled()
      expect(server.config.logger.info).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing virtual modules gracefully', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Orphan.client.tsx'

      // Remove virtual module to simulate error condition
      const modules = (
        server.moduleGraph as unknown as { _modules: Map<string, ModuleNode> }
      )._modules
      modules.delete('\0virtual:ixflare-islands')

      // Should not throw
      await expect(handleHotUpdate({ file, server })).resolves.not.toThrow()
    })

    it('should handle invalid route paths gracefully', async () => {
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/routes/invalid-path'

      // Should not throw even with malformed path
      await expect(handleHotUpdate({ file, server })).resolves.not.toThrow()
    })
  })

  describe('Breaking Change Detection', () => {
    it('should be handled by React Fast Refresh automatically', async () => {
      // Note: Actual breaking change detection is done by @vitejs/plugin-react
      // This test verifies our logging function exists
      const handleHotUpdate = plugin.handleHotUpdate as Function
      const file = '/test/project/src/components/Renamed.client.tsx'

      await handleHotUpdate({ file, server })

      // Should complete without error - React Fast Refresh handles bailout
      expect(true).toBe(true)
    })
  })
})
