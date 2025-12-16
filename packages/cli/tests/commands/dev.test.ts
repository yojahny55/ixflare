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
        version: '1.2.3',
      })

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')

      expect(output).toContain('Ixflare')
      expect(output).toContain('v1.2.3')
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
        version: '0.0.1',
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
      // Issue #6 fix: displayPortConflictMessage no longer calls process.exit
      // The caller (dev function) handles the exit
      expect(mockExit).not.toHaveBeenCalled()
    })
  })

  describe('Port validation', () => {
    it('should return true for valid ports', async () => {
      const { isValidPort } = await import('../../src/commands/dev')

      expect(isValidPort(1)).toBe(true)
      expect(isValidPort(80)).toBe(true)
      expect(isValidPort(3000)).toBe(true)
      expect(isValidPort(8080)).toBe(true)
      expect(isValidPort(65535)).toBe(true)
    })

    it('should return false for invalid ports', async () => {
      const { isValidPort } = await import('../../src/commands/dev')

      expect(isValidPort(0)).toBe(false)
      expect(isValidPort(-1)).toBe(false)
      expect(isValidPort(65536)).toBe(false)
      expect(isValidPort(NaN)).toBe(false)
      expect(isValidPort(3.14)).toBe(false)
      expect(isValidPort(Infinity)).toBe(false)
    })

    it('should reject invalid port in parseDevArgs and exit', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      // This should call process.exit(1)
      parseDevArgs(['--port', 'abc'])

      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const output = consoleErrorSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Invalid port')
    })

    it('should reject out-of-range port in parseDevArgs', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      parseDevArgs(['--port', '99999'])

      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('Host validation (OWASP A03 - Command Injection Prevention)', () => {
    it('should return true for valid hostnames', async () => {
      const { isValidHost } = await import('../../src/commands/dev')

      expect(isValidHost('localhost')).toBe(true)
      expect(isValidHost('0.0.0.0')).toBe(true)
      expect(isValidHost('192.168.1.1')).toBe(true)
      expect(isValidHost('example.com')).toBe(true)
      expect(isValidHost('sub.example.com')).toBe(true)
      expect(isValidHost('my-server.local')).toBe(true)
      expect(isValidHost('true')).toBe(true) // Vite uses 'true' for --host
    })

    it('should return false for malicious inputs (command injection attempts)', async () => {
      const { isValidHost } = await import('../../src/commands/dev')

      // Command injection attempts
      expect(isValidHost('localhost; rm -rf /')).toBe(false)
      expect(isValidHost('localhost && echo pwned')).toBe(false)
      expect(isValidHost('localhost | cat /etc/passwd')).toBe(false)
      expect(isValidHost('$(whoami)')).toBe(false)
      expect(isValidHost('`whoami`')).toBe(false)
      expect(isValidHost("localhost'; DROP TABLE users;--")).toBe(false)
      expect(isValidHost('localhost\nmalicious')).toBe(false)
    })

    it('should reject invalid host in parseDevArgs and exit', async () => {
      const { parseDevArgs } = await import('../../src/commands/dev')

      // This should call process.exit(1)
      parseDevArgs(['--host', 'localhost; rm -rf /'])

      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const output = consoleErrorSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Invalid host')
    })
  })

  describe('Vite subprocess management', () => {
    it('should spawn vite with correct arguments, piped stdio, and shell: false for security', async () => {
      // Issue #3 fix: Now uses piped stdio to detect Vite ready signal
      // SECURITY: shell: false prevents command injection (OWASP A03)
      const mockStdout = { on: vi.fn() }
      const mockStderr = { on: vi.fn() }
      const processWithPipes = {
        ...mockProcess,
        stdout: mockStdout,
        stderr: mockStderr,
      }
      spawnMock.mockReturnValue(processWithPipes)

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
          stdio: ['inherit', 'pipe', 'pipe'],
          shell: false, // SECURITY: Must be false to prevent command injection
        })
      )

      // Verify stdout/stderr handlers are attached
      expect(mockStdout.on).toHaveBeenCalledWith('data', expect.any(Function))
      expect(mockStderr.on).toHaveBeenCalledWith('data', expect.any(Function))
    })

    it('should display banner when Vite outputs ready signal', async () => {
      const mockStdout = { on: vi.fn() }
      const mockStderr = { on: vi.fn() }
      const processWithPipes = {
        ...mockProcess,
        stdout: mockStdout,
        stderr: mockStderr,
      }
      spawnMock.mockReturnValue(processWithPipes)

      // Mock port as available
      let listeningCallback: (() => void) | null = null
      const mockServer = {
        listen: vi.fn(() => {
          if (listeningCallback) setTimeout(() => listeningCallback!(), 0)
        }),
        close: vi.fn((cb) => cb && cb()),
        once: vi.fn((event, cb) => {
          if (event === 'listening') listeningCallback = cb
        }),
      }
      createServerMock.mockReturnValue(mockServer)

      networkInterfacesMock.mockReturnValue({
        eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.5' }],
      })

      const { dev } = await import('../../src/commands/dev')

      await dev({ port: 3000 })

      // Get the stdout data handler and simulate Vite ready signal
      const stdoutHandler = mockStdout.on.mock.calls.find((call) => call[0] === 'data')?.[1]
      expect(stdoutHandler).toBeDefined()

      // Simulate Vite ready output
      const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      stdoutHandler(Buffer.from('VITE v5.0.0 ready in 123 ms\n'))

      // Banner should be displayed
      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Ixflare')

      stdoutWriteSpy.mockRestore()
    })

    it('should handle process cleanup on exit', async () => {
      const killSpy = vi.fn()
      const mockStdout = { on: vi.fn() }
      const mockStderr = { on: vi.fn() }
      const processWithPipes = {
        on: vi.fn(),
        stdout: mockStdout,
        stderr: mockStderr,
        kill: killSpy,
        killed: false,
      }
      spawnMock.mockReturnValue(processWithPipes)

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

  describe('Banner padding', () => {
    it('should handle long network URLs without breaking layout', async () => {
      const { displayBanner } = await import('../../src/commands/dev')

      // Long IP address with high port number
      displayBanner({
        port: 65535,
        networkAddress: '192.168.100.100',
        startTime: 1234,
        version: '0.0.1',
      })

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')

      // Should still contain the URLs (possibly truncated)
      expect(output).toContain('192.168.100.100')
      // Each line should end with │
      const lines = consoleLogSpy.mock.calls.map((call) => call[0])
      for (const line of lines) {
        if (line && line.includes('│') && !line.includes('╭') && !line.includes('╰')) {
          expect(line.endsWith('│')).toBe(true)
        }
      }
    })
  })

  describe('Version detection', () => {
    it('should return version from package.json', async () => {
      const { getVersion } = await import('../../src/commands/dev')

      const version = getVersion()

      // Should return a valid semver string
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })
})
