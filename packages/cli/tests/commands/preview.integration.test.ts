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

describe('preview command integration', () => {
  let mockProcess: any
  let mockExit: ReturnType<typeof vi.spyOn>
  let mockConsoleError: ReturnType<typeof vi.spyOn>
  let mockConsoleLog: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Mock child process
    mockProcess = new EventEmitter()
    mockProcess.killed = false
    mockProcess.kill = vi.fn()
    vi.mocked(spawn).mockReturnValue(mockProcess as any)

    // Mock file system
    vi.mocked(existsSync).mockReturnValue(true)

    // Mock console and process
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Mock process.argv to simulate CLI args
    process.argv = ['node', 'ix', 'preview']
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockExit.mockRestore()
    mockConsoleError.mockRestore()
    mockConsoleLog.mockRestore()
  })

  describe('dist directory validation', () => {
    it('should exit with error if dist/ directory does not exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return !(path as string).includes('dist')
      })

      await preview({ port: 3001 })

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('dist/ directory not found'),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should exit with error if dist/_worker/index.js does not exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if ((path as string).includes('_worker/index.js')) return false
        return true
      })

      await preview({ port: 3001 })

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Production build not found'),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should suggest running ix build when dist is missing', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      await preview({ port: 3001 })

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('ix build'))
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
      process.emit('SIGINT')

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should kill wrangler process on SIGTERM', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate SIGTERM
      process.emit('SIGTERM')

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
      process.emit('SIGINT')

      expect(mockProcess.kill).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should exit with error code when wrangler exits with non-zero code', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate wrangler error exit
      mockProcess.emit('exit', 1)

      await vi.waitFor(() => {
        expect(mockExit).toHaveBeenCalledWith(1)
      })
    })

    it('should handle successful exit (code 0)', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate successful exit
      mockProcess.emit('exit', 0)

      await vi.waitFor(() => {
        // Should not call exit for success
        expect(mockExit).not.toHaveBeenCalled()
      })
    })

    it('should handle null exit code', async () => {
      const previewPromise = preview({ port: 3001 })

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalled()
      })

      // Simulate exit with null code (normal termination)
      mockProcess.emit('exit', null)

      await vi.waitFor(() => {
        // Should not call exit for null code
        expect(mockExit).not.toHaveBeenCalled()
      })
    })
  })
})
