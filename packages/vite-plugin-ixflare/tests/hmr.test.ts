/**
 * @module tests/hmr
 * @description Unit tests for HMR functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setupHMR,
  handleRouteHMR,
  handleIslandHMR,
  handleServerComponentHMR,
  logBreakingChange,
  startHMRTiming,
  logHMRTiming,
} from '../src/hmr'
import type { ViteDevServer, ModuleNode } from 'vite'

/**
 * Create mock Vite dev server
 */
function createMockServer(): ViteDevServer {
  const modules = new Map<string, ModuleNode>()
  const sentMessages: unknown[] = []

  return {
    moduleGraph: {
      getModuleById: (id: string) => modules.get(id) || null,
      getModulesByFile: (file: string) => {
        const matching: ModuleNode[] = []
        modules.forEach((mod, id) => {
          if (id === file) {
            matching.push(mod)
          }
        })
        return matching.length > 0 ? new Set(matching) : null
      },
      invalidateModule: vi.fn(),
    },
    ws: {
      on: vi.fn(),
      send: (msg: unknown) => {
        sentMessages.push(msg)
      },
    },
    config: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
    // Store sent messages for inspection
    __sentMessages: sentMessages,
  } as unknown as ViteDevServer & { __sentMessages: unknown[] }
}

/**
 * Create mock module node
 */
function createMockModule(id: string, url: string = id): ModuleNode {
  return {
    id,
    url,
    file: id,
    type: 'js',
  } as ModuleNode
}

describe('HMR Functions', () => {
  describe('setupHMR', () => {
    it('should register connection listener when enabled', () => {
      const server = createMockServer()
      setupHMR(server, { enabled: true })

      expect(server.ws.on).toHaveBeenCalledWith('connection', expect.any(Function))
    })

    it('should not register listener when disabled', () => {
      const server = createMockServer()
      setupHMR(server, { enabled: false })

      expect(server.ws.on).not.toHaveBeenCalled()
    })

    it('should register vite:beforeFullReload listener for breaking change detection', () => {
      const server = createMockServer()
      setupHMR(server, { enabled: true })

      expect(server.ws.on).toHaveBeenCalledWith('vite:beforeFullReload', expect.any(Function))
    })

    it('should log breaking change when beforeFullReload is triggered', () => {
      const listeners = new Map<string, Function>()
      const server = createMockServer()

      // Override ws.on to capture listeners
      server.ws.on = vi.fn((event: string, callback: Function) => {
        listeners.set(event, callback)
      })

      setupHMR(server, { enabled: true })

      // Trigger the beforeFullReload listener
      const beforeFullReloadListener = listeners.get('vite:beforeFullReload')
      expect(beforeFullReloadListener).toBeDefined()

      beforeFullReloadListener!({ path: '/src/components/Counter.client.tsx' })

      expect(server.config.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Full reload triggered'),
        expect.any(Object)
      )
    })
  })

  describe('handleRouteHMR', () => {
    it('should return modules for route file', () => {
      const server = createMockServer()
      const file = '/src/routes/index.tsx'
      const mockModule = createMockModule(file)

      server.moduleGraph.getModuleById = vi.fn().mockReturnValue(mockModule)
      server.moduleGraph.getModulesByFile = vi.fn().mockReturnValue(new Set([mockModule]))

      const modules = handleRouteHMR(file, server)

      expect(modules.length).toBeGreaterThan(0)
      expect(modules).toContain(mockModule)
    })

    it('should include virtual module in returned modules', () => {
      const server = createMockServer()
      const file = '/src/routes/dashboard.tsx'
      const routeModule = createMockModule(file)
      const virtualModule = createMockModule('\0virtual:ixflare-routes')

      server.moduleGraph.getModuleById = vi.fn((id: string) => {
        if (id === file) return routeModule
        if (id === '\0virtual:ixflare-routes') return virtualModule
        return null
      })
      server.moduleGraph.getModulesByFile = vi.fn().mockReturnValue(new Set([routeModule]))

      const modules = handleRouteHMR(file, server)

      expect(modules).toContain(virtualModule)
    })
  })

  describe('handleIslandHMR', () => {
    it('should invalidate virtual islands module', () => {
      const server = createMockServer()
      const file = '/src/components/Counter.client.tsx'
      const virtualModule = createMockModule('\0virtual:ixflare-islands')

      server.moduleGraph.getModuleById = vi.fn((id: string) => {
        if (id === '\0virtual:ixflare-islands') return virtualModule
        if (id === file) return createMockModule(file)
        return null
      })
      server.moduleGraph.getModulesByFile = vi.fn().mockReturnValue(
        new Set([createMockModule(file)])
      )

      const modules = handleIslandHMR(file, server)

      expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(virtualModule)
    })

    it('should send HMR update for virtual islands module', () => {
      const server = createMockServer()
      const file = '/src/components/Search.client.tsx'
      const virtualModule = createMockModule('\0virtual:ixflare-islands')

      server.moduleGraph.getModuleById = vi.fn().mockReturnValue(virtualModule)

      handleIslandHMR(file, server)

      const sentMessages = (server as unknown as { __sentMessages: unknown[] }).__sentMessages
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0]).toMatchObject({
        type: 'update',
        updates: [
          {
            type: 'js-update',
            path: 'virtual:ixflare-islands',
          },
        ],
      })
    })

    it('should return island module and virtual module', () => {
      const server = createMockServer()
      const file = '/src/components/Button.client.tsx'
      const islandModule = createMockModule(file)
      const virtualModule = createMockModule('\0virtual:ixflare-islands')

      server.moduleGraph.getModuleById = vi.fn((id: string) => {
        if (id === '\0virtual:ixflare-islands') return virtualModule
        if (id === file) return islandModule
        return null
      })
      server.moduleGraph.getModulesByFile = vi.fn().mockReturnValue(new Set([islandModule]))

      const modules = handleIslandHMR(file, server)

      expect(modules).toContain(islandModule)
      expect(modules).toContain(virtualModule)
    })

    it('should log with (state preserved) message', () => {
      const server = createMockServer()
      const file = '/src/components/Counter.client.tsx'

      server.moduleGraph.getModuleById = vi.fn().mockReturnValue(null)

      handleIslandHMR(file, server)

      expect(server.config.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('(state preserved)'),
        expect.any(Object)
      )
    })
  })

  describe('handleServerComponentHMR', () => {
    it('should send custom ixflare:server-update event', () => {
      const server = createMockServer()
      const file = '/src/routes/dashboard/index.tsx'
      const routePath = '/dashboard'

      handleServerComponentHMR(file, server, routePath)

      const sentMessages = (server as unknown as { __sentMessages: unknown[] }).__sentMessages
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0]).toMatchObject({
        type: 'custom',
        event: 'ixflare:server-update',
        data: {
          route: routePath,
          timestamp: expect.any(Number),
        },
      })
    })

    it('should log route path in message', () => {
      const server = createMockServer()
      const file = '/src/routes/users/index.tsx'
      const routePath = '/users'

      handleServerComponentHMR(file, server, routePath)

      expect(server.config.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(routePath),
        expect.any(Object)
      )
    })
  })

  describe('logBreakingChange', () => {
    it('should log warning with reason', () => {
      const server = createMockServer()
      const reason = 'Component renamed from Counter to CounterWidget'

      logBreakingChange(reason, server)

      expect(server.config.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Full reload triggered'),
        expect.any(Object)
      )
      expect(server.config.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(reason),
        expect.any(Object)
      )
    })
  })

  describe('HMR Timing', () => {
    it('should measure HMR duration', () => {
      const server = createMockServer()
      const file = '/src/components/Test.client.tsx'

      const timing = startHMRTiming(file, 'island')
      expect(timing.file).toBe(file)
      expect(timing.type).toBe('island')
      expect(timing.start).toBeGreaterThan(0)

      // Simulate some work
      const start = Date.now()
      while (Date.now() - start < 10) {
        // Wait
      }

      logHMRTiming(timing, server)

      expect(server.config.logger.info).toHaveBeenCalled()
      const logCall = (server.config.logger.info as unknown as { mock: { calls: unknown[][] } })
        .mock.calls[0]
      expect(logCall[0]).toMatch(/\(\d+ms\)/)
    })

    it('should warn for slow HMR updates (>1s)', () => {
      const server = createMockServer()
      const file = '/src/routes/slow.tsx'

      // Create timing with start time 2 seconds ago
      const timing = {
        start: Date.now() - 2000,
        file,
        type: 'route' as const,
      }

      logHMRTiming(timing, server)

      expect(server.config.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow HMR update'),
        expect.any(Object)
      )
    })

    it('should not warn for fast HMR updates (<1s)', () => {
      const server = createMockServer()
      const file = '/src/routes/fast.tsx'

      const timing = startHMRTiming(file, 'route')
      logHMRTiming(timing, server)

      expect(server.config.logger.warn).not.toHaveBeenCalled()
      expect(server.config.logger.info).toHaveBeenCalled()
    })
  })
})
