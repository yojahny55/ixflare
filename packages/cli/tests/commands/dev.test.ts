/**
 * @module tests/commands/dev
 * @description Tests for dev command
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { ChildProcess } from 'node:child_process'

// Mock dependencies before importing
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('node:net', () => ({
  createServer: vi.fn(),
}))

vi.mock('node:os', () => ({
  networkInterfaces: vi.fn(),
}))

// Mock process.exit to prevent test from exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

describe('dev command', () => {
  let spawnMock: Mock
  let createServerMock: Mock
  let networkInterfacesMock: Mock
  let mockProcess: Partial<ChildProcess>
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock

  beforeEach(async () => {
    // Setup mocks
    const { spawn } = await import('node:child_process')
    const { createServer } = await import('node:net')
    const { networkInterfaces } = await import('node:os')

    spawnMock = spawn as Mock
    createServerMock = createServer as Mock
    networkInterfacesMock = networkInterfaces as Mock

    // Mock process
    mockProcess = {
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: vi.fn(),
      kill: vi.fn(),
    }

    // Spy on console
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Port availability checking', () => {
    it('should check if default port 3000 is available', async () => {
      // Mock port as available
      let listeningCallback: (() => void) | null = null
      const mockServer = {
        listen: vi.fn((port) => {
          // Trigger 'listening' event immediately
          if (listeningCallback) {
            setTimeout(() => listeningCallback!(), 0)
          }
        }),
        close: vi.fn((callback) => {
          if (callback) callback()
        }),
        once: vi.fn((event, callback) => {
          if (event === 'listening') {
            listeningCallback = callback
          }
        }),
      }
      createServerMock.mockReturnValue(mockServer)

      const { isPortAvailable } = await import('../../src/commands/dev')

      const available = await isPortAvailable(3000)

      expect(available).toBe(true)
      expect(createServerMock).toHaveBeenCalled()
      expect(mockServer.listen).toHaveBeenCalledWith(3000)
      expect(mockServer.close).toHaveBeenCalled()
    })

    it('should return false when port is occupied', async () => {
      // Mock port as occupied
      let errorCallback: ((err: { code: string }) => void) | null = null
      const mockServer = {
        listen: vi.fn((port) => {
          // Trigger error event immediately
          if (errorCallback) {
            setTimeout(() => errorCallback!({ code: 'EADDRINUSE' }), 0)
          }
        }),
        close: vi.fn((callback) => {
          if (callback) callback()
        }),
        once: vi.fn((event, callback) => {
          if (event === 'error') {
            errorCallback = callback
          }
        }),
      }
      createServerMock.mockReturnValue(mockServer)

      const { isPortAvailable } = await import('../../src/commands/dev')

      const available = await isPortAvailable(3000)

      expect(available).toBe(false)
    })

    it('should find next available port when default is occupied', async () => {
      const { findAvailablePort } = await import('../../src/commands/dev')

      // Mock first port as occupied, second as available
      let callCount = 0
      let errorCallback: ((err: { code: string }) => void) | null = null
      let listeningCallback: (() => void) | null = null

      createServerMock.mockImplementation(() => {
        callCount++
        const isFirstCall = callCount === 1

        return {
          listen: vi.fn((port) => {
            if (isFirstCall && errorCallback) {
              // First call - port occupied
              setTimeout(() => errorCallback!({ code: 'EADDRINUSE' }), 0)
            } else if (!isFirstCall && listeningCallback) {
              // Second call - port available
              setTimeout(() => listeningCallback!(), 0)
            }
          }),
          close: vi.fn((callback) => {
            if (callback) callback()
          }),
          once: vi.fn((event, callback) => {
            if (event === 'error') {
              errorCallback = callback
            } else if (event === 'listening') {
              listeningCallback = callback
            }
          }),
        }
      })

      const port = await findAvailablePort(3000)

      expect(port).toBe(3001)
    })
  })

  describe('Network interface detection', () => {
    it('should detect local network IP address', async () => {
      networkInterfacesMock.mockReturnValue({
        eth0: [
          { family: 'IPv4', internal: false, address: '192.168.1.5' },
          { family: 'IPv6', internal: false, address: 'fe80::1' },
        ],
        lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      })

      const { getNetworkAddress } = await import('../../src/commands/dev')

      const address = getNetworkAddress()

      expect(address).toBe('192.168.1.5')
    })

    it('should return undefined when no external network interface exists', async () => {
      networkInterfacesMock.mockReturnValue({
        lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      })

      const { getNetworkAddress } = await import('../../src/commands/dev')

      const address = getNetworkAddress()

      expect(address).toBeUndefined()
    })
  })

  describe('Banner display', () => {
    it('should display banner with local and network URLs', async () => {
      const { displayBanner } = await import('../../src/commands/dev')

      displayBanner({
        port: 3000,
        networkAddress: '192.168.1.5',
        startTime: 312,
      })

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')

      expect(output).toContain('Ixflare')
      expect(output).toContain('http://localhost:3000')
      expect(output).toContain('http://192.168.1.5:3000')
      expect(output).toContain('312ms')
    })

    it('should handle missing network address gracefully', async () => {
      const { displayBanner } = await import('../../src/commands/dev')

      displayBanner({
        port: 3000,
        networkAddress: undefined,
        startTime: 250,
      })

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')

      expect(output).toContain('http://localhost:3000')
      expect(output).not.toContain('Network:')
    })
  })

  describe('CLI argument parsing', () => {
    it('should parse --port argument', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      const args = parseDevArgs(['--port', '8080'])

      expect(args.port).toBe(8080)
    })

    it('should parse --host argument', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      const args = parseDevArgs(['--host', '0.0.0.0'])

      expect(args.host).toBe('0.0.0.0')
    })

    it('should parse --open flag', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      const args = parseDevArgs(['--open'])

      expect(args.open).toBe(true)
    })

    it('should use default values when no arguments provided', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      const args = parseDevArgs([])

      expect(args.port).toBe(3000)
      expect(args.host).toBeUndefined()
      expect(args.open).toBe(false)
    })
  })

  describe('Port conflict handling', () => {
    it('should display helpful message when port is occupied', async () => {
      const { displayPortConflictMessage } = await import('../../src/commands/dev')

      displayPortConflictMessage(3000, 3001)

      expect(consoleErrorSpy).toHaveBeenCalled()
      const output = consoleErrorSpy.mock.calls.map((call) => call[0]).join('\n')

      expect(output).toContain('Port 3000 is in use')
      expect(output).toContain('--port 3001')
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('Vite subprocess management', () => {
    it('should spawn vite with correct arguments', async () => {
      spawnMock.mockReturnValue(mockProcess)

      const { dev } = await import('../../src/commands/dev')

      // Mock port as available with proper server methods
      let listeningCallback: (() => void) | null = null
      const mockServer = {
        listen: vi.fn((port) => {
          // Trigger 'listening' event immediately
          if (listeningCallback) {
            setTimeout(() => listeningCallback!(), 0)
          }
        }),
        close: vi.fn((callback) => {
          if (callback) callback()
        }),
        once: vi.fn((event, callback) => {
          if (event === 'listening') {
            listeningCallback = callback
          }
        }),
      }
      createServerMock.mockReturnValue(mockServer)

      networkInterfacesMock.mockReturnValue({
        eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.5' }],
      })

      await dev({ port: 3000 })

      expect(spawnMock).toHaveBeenCalledWith(
        'npx',
        expect.arrayContaining(['vite', '--port', '3000']),
        expect.objectContaining({
          stdio: 'inherit',
          shell: true,
        })
      )
    })

    it('should handle process cleanup on exit', async () => {
      const killSpy = vi.fn()
      mockProcess.kill = killSpy
      mockProcess.killed = false
      spawnMock.mockReturnValue(mockProcess)

      // Spy on process.on to capture signal handlers
      const processOnSpy = vi.spyOn(process, 'on')

      // Mock port as available with proper server methods
      let listeningCallback: (() => void) | null = null
      const mockServer = {
        listen: vi.fn((port) => {
          if (listeningCallback) {
            setTimeout(() => listeningCallback!(), 0)
          }
        }),
        close: vi.fn((callback) => {
          if (callback) callback()
        }),
        once: vi.fn((event, callback) => {
          if (event === 'listening') {
            listeningCallback = callback
          }
        }),
      }
      createServerMock.mockReturnValue(mockServer)

      const { dev } = await import('../../src/commands/dev')

      await dev({ port: 3000 })

      // Find SIGINT handler and call it
      const sigintCall = processOnSpy.mock.calls.find((call) => call[0] === 'SIGINT')
      expect(sigintCall).toBeDefined()

      if (sigintCall) {
        const handler = sigintCall[1] as () => void
        handler()
      }

      expect(killSpy).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(0)
    })
  })
})
