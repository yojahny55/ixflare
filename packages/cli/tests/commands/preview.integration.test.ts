import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { preview } from '../../src/commands/preview'
import { EventEmitter } from 'node:events'

// Mock Node.js modules
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  watch: vi.fn(() => ({
    close: vi.fn(),
  })),
}))

vi.mock('prompts', () => ({
  default: vi.fn(() => Promise.resolve({ confirmed: true })),
}))

// Mock dev.ts port utilities
vi.mock('../../src/commands/dev.js', () => ({
  isValidPort: vi.fn((port: number) => !isNaN(port) && port >= 1 && port <= 65535),
  MIN_PORT: 1,
  MAX_PORT: 65535,
  isPortAvailable: vi.fn(() => Promise.resolve(true)),
  findAvailablePort: vi.fn((startPort: number) => Promise.resolve(startPort)),
  displayPortConflictMessage: vi.fn(),
}))

describe('preview command integration', () => {
  let mockProcess: any
  let mockExit: ReturnType<typeof vi.spyOn>
  let mockConsoleError: ReturnType<typeof vi.spyOn>
  let mockConsoleLog: ReturnType<typeof vi.spyOn>
  let mockStdoutIsTTY: boolean | undefined

  // Increase max listeners to prevent warning during tests
  const originalMaxListeners = process.getMaxListeners()
  const originalIsTTY = process.stdout.isTTY

  beforeEach(() => {
    // Increase max listeners to prevent memory leak warning during tests
    process.setMaxListeners(50)

    // Default to TTY mode for tests
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    })

    // Mock child process
    mockProcess = new EventEmitter()
    mockProcess.killed = false
    mockProcess.kill = vi.fn()
    vi.mocked(spawn).mockReturnValue(mockProcess as any)

    // Mock file system - default to true
    vi.mocked(existsSync).mockReturnValue(true)

    // Mock console and process
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      // Throw to stop execution flow in tests
      throw new Error('process.exit called')
    }) as never)
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Mock process.argv to simulate CLI args
    process.argv = ['node', 'ix', 'preview']

    // Clear CI environment
    delete process.env.CI
  })

  afterEach(() => {
    // Remove all SIGINT/SIGTERM listeners added during tests
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    // Restore original max listeners
    process.setMaxListeners(originalMaxListeners)
    // Restore original isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })

    vi.clearAllMocks()
    mockExit.mockRestore()
    mockConsoleError.mockRestore()
    mockConsoleLog.mockRestore()
  })

  describe('help flag', () => {
    it('should display help and return early when --help is provided', async () => {
      await preview({ help: true })

      const logCalls = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(logCalls).toContain('Usage:')
      expect(logCalls).toContain('ix preview')
      expect(logCalls).toContain('--port')
      expect(logCalls).toContain('--env')
      expect(logCalls).toContain('--open')
      expect(logCalls).toContain('--yes')
      expect(logCalls).toContain('--help')
      expect(spawn).not.toHaveBeenCalled()
    })
  })

  describe('dist directory validation', () => {
    it('should exit with error if dist/ directory does not exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return !(path as string).includes('dist')
      })

      try {
        await preview({ port: 3001 })
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('dist/ directory not found')
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should exit with error if dist/_worker/index.js does not exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if ((path as string).includes('_worker/index.js')) return false
        return true
      })

      try {
        await preview({ port: 3001 })
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Production build not found')
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should suggest running ix build when dist is missing', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      try {
        await preview({ port: 3001 })
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('ix build'))
    })
  })

  describe('port availability', () => {
    it('should use suggested port when requested port is unavailable', async () => {
      const { isPortAvailable, findAvailablePort, displayPortConflictMessage } =
        await import('../../src/commands/dev.js')
      vi.mocked(isPortAvailable).mockResolvedValueOnce(false)
      vi.mocked(findAvailablePort).mockResolvedValueOnce(3002)

      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      expect(displayPortConflictMessage).toHaveBeenCalledWith(3001, 3002)

      const spawnCall = vi.mocked(spawn).mock.calls[0]
      expect(spawnCall[1]).toContain('3002')

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should exit when no available port is found', async () => {
      const { isPortAvailable, findAvailablePort } = await import('../../src/commands/dev.js')
      vi.mocked(isPortAvailable).mockResolvedValueOnce(false)
      vi.mocked(findAvailablePort).mockRejectedValueOnce(new Error('No ports available'))

      try {
        await preview({ port: 3001 })
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Port 3001 is in use'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('wrangler command building', () => {
    it('should spawn wrangler with local mode by default', async () => {
      const previewPromise = preview({ port: 3001 })

      // Wait for spawn to be called
      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      const spawnCall = vi.mocked(spawn).mock.calls[0]
      expect(spawnCall[0]).toBe('npx')
      expect(spawnCall[1]).toContain('wrangler')
      expect(spawnCall[1]).toContain('dev')
      expect(spawnCall[1]).toContain('--local')
      expect(spawnCall[1]).toContain('--port')
      expect(spawnCall[1]).toContain('3001')
      expect(spawnCall[1]).toContain('--persist-to')
      expect(spawnCall[1]).toContain('.wrangler/state')

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should spawn wrangler with remote mode when env is specified', async () => {
      const previewPromise = preview({ port: 3001, env: 'staging' })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      const spawnCall = vi.mocked(spawn).mock.calls[0]
      expect(spawnCall[1]).toContain('--remote')
      expect(spawnCall[1]).toContain('--env')
      expect(spawnCall[1]).toContain('staging')
      expect(spawnCall[1]).not.toContain('--local')

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should include --open flag when open option is true', async () => {
      const previewPromise = preview({ port: 3001, open: true })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      const spawnCall = vi.mocked(spawn).mock.calls[0]
      expect(spawnCall[1]).toContain('--open')

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should use shell: false for security', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      const spawnCall = vi.mocked(spawn).mock.calls[0]
      expect(spawnCall[2]).toMatchObject({ shell: false })

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should use custom port when specified', async () => {
      const previewPromise = preview({ port: 4000 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      const spawnCall = vi.mocked(spawn).mock.calls[0]
      expect(spawnCall[1]).toContain('--port')
      expect(spawnCall[1]).toContain('4000')

      // Cleanup
      mockProcess.emit('exit', 0)
    })
  })

  describe('banner display', () => {
    it('should display preview banner with local mode message', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalled()
      })

      // Check for banner elements
      const logCalls = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(logCalls).toContain('Production Preview')
      expect(logCalls).toContain('Using production build from dist/')
      expect(logCalls).toContain('Miniflare simulating Workers env')
      expect(logCalls).toContain('D1 using local SQLite database')
      expect(logCalls).toContain('http://localhost:3001')

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should display remote environment in banner when env is specified', async () => {
      const previewPromise = preview({ port: 3001, env: 'staging' })

      await vi.waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalled()
      })

      const logCalls = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(logCalls).toContain('Remote environment: staging')
      expect(logCalls).not.toContain('Miniflare')

      // Cleanup
      mockProcess.emit('exit', 0)
    })
  })

  describe('process cleanup', () => {
    it('should kill wrangler process on SIGINT', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate SIGINT
      try {
        process.emit('SIGINT')
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should kill wrangler process on SIGTERM', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate SIGTERM
      try {
        process.emit('SIGTERM')
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should not kill already killed process', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Mark process as killed
      mockProcess.killed = true

      // Simulate SIGINT
      try {
        process.emit('SIGINT')
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockProcess.kill).not.toHaveBeenCalled()
    })
  })

  describe('production environment handling', () => {
    it('should skip confirmation prompt when --yes flag is provided', async () => {
      const prompts = await import('prompts')

      const previewPromise = preview({ port: 3001, env: 'production', yes: true })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // prompts should NOT have been called because --yes was provided
      expect(prompts.default).not.toHaveBeenCalled()

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should show confirmation prompt for production without --yes flag in TTY mode', async () => {
      const prompts = await import('prompts')

      const previewPromise = preview({ port: 3001, env: 'production' })

      await vi.waitFor(() => {
        expect(prompts.default).toHaveBeenCalled()
      })

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should detect "prod" as production environment', async () => {
      const prompts = await import('prompts')

      const previewPromise = preview({ port: 3001, env: 'prod' })

      await vi.waitFor(() => {
        expect(prompts.default).toHaveBeenCalled()
      })

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should not show confirmation for non-production environments', async () => {
      const prompts = await import('prompts')
      vi.mocked(prompts.default).mockClear()

      const previewPromise = preview({ port: 3001, env: 'staging' })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // prompts should NOT have been called for staging
      expect(prompts.default).not.toHaveBeenCalled()

      // Cleanup
      mockProcess.emit('exit', 0)
    })

    it('should fail in non-TTY mode without --yes flag for production', async () => {
      // Set non-TTY mode
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      })

      try {
        await preview({ port: 3001, env: 'production' })
      } catch {
        // Expected - process.exit throws in test
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot prompt for confirmation in non-interactive mode')
      )
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should work in CI mode with --yes flag for production', async () => {
      process.env.CI = 'true'

      const previewPromise = preview({ port: 3001, env: 'production', yes: true })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Should show warning but proceed
      const logCalls = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(logCalls).toContain('Confirmation skipped via --yes flag')

      // Cleanup
      mockProcess.emit('exit', 0)
    })
  })

  describe('error handling', () => {
    it('should reject promise when wrangler exits with non-zero code', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate wrangler error exit
      mockProcess.emit('exit', 1)

      await expect(previewPromise).rejects.toThrow('Preview server exited with code 1')
    })

    it('should resolve promise on successful exit (code 0)', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate successful exit
      mockProcess.emit('exit', 0)

      await expect(previewPromise).resolves.toBeUndefined()
    })

    it('should resolve promise on null exit code', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate exit with null code (normal termination)
      mockProcess.emit('exit', null)

      await expect(previewPromise).resolves.toBeUndefined()
    })

    it('should reject promise on spawn error', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate spawn error
      mockProcess.emit('error', new Error('spawn failed'))

      await expect(previewPromise).rejects.toThrow('spawn failed')
    })
  })
})
