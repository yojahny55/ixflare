import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'child_process'
import { truncateAllTables } from '../../src/seed/truncate'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

describe('truncate', () => {
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSpawn = spawn as ReturnType<typeof vi.fn>
    mockSpawn.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  function createMockProcess(
    exitCode: number,
    stdout = '',
    stderr = ''
  ): {
    stdout: { on: ReturnType<typeof vi.fn> }
    stderr: { on: ReturnType<typeof vi.fn> }
    on: ReturnType<typeof vi.fn>
  } {
    const stdoutHandler = vi.fn()
    const stderrHandler = vi.fn()
    const onHandler = vi.fn()

    const mockProcess = {
      stdout: { on: stdoutHandler },
      stderr: { on: stderrHandler },
      on: onHandler,
    }

    // Setup stdout data callback
    stdoutHandler.mockImplementation((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data' && stdout) {
        setTimeout(() => callback(Buffer.from(stdout)), 0)
      }
    })

    // Setup stderr data callback
    stderrHandler.mockImplementation((event: string, callback: (data: Buffer) => void) => {
      if (event === 'data' && stderr) {
        setTimeout(() => callback(Buffer.from(stderr)), 0)
      }
    })

    // Setup close/error callbacks
    onHandler.mockImplementation((event: string, callback: (arg?: number | Error) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 10)
      }
    })

    return mockProcess
  }

  describe('truncateAllTables()', () => {
    it('should disable and re-enable foreign keys', async () => {
      const calls: string[] = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        calls.push(command)

        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(0, JSON.stringify([{ results: [] }]))
        }
        return createMockProcess(0)
      })

      await truncateAllTables('test-db', 'local')

      expect(calls[0]).toBe('PRAGMA foreign_keys = OFF')
      expect(calls[calls.length - 1]).toBe('PRAGMA foreign_keys = ON')
    })

    it('should query for all non-system tables', async () => {
      const calls: string[] = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        calls.push(command)

        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(0, JSON.stringify([{ results: [{ name: 'users' }] }]))
        }
        if (command.includes('SELECT COUNT')) {
          return createMockProcess(0, JSON.stringify([{ results: [{ count: 5 }] }]))
        }
        return createMockProcess(0)
      })

      await truncateAllTables('test-db', 'local')

      const tableQuery = calls.find((c) => c.includes('SELECT name FROM sqlite_master'))
      expect(tableQuery).toBeDefined()
      expect(tableQuery).toContain("name NOT LIKE 'sqlite_%'")
      expect(tableQuery).toContain("name NOT LIKE '_migrations'")
      expect(tableQuery).toContain("name NOT LIKE 'd1_migrations'")
    })

    it('should delete from all discovered tables', async () => {
      const calls: string[] = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        calls.push(command)

        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(
            0,
            JSON.stringify([{ results: [{ name: 'users' }, { name: 'posts' }] }])
          )
        }
        if (command.includes('SELECT COUNT')) {
          return createMockProcess(0, JSON.stringify([{ results: [{ count: 10 }] }]))
        }
        return createMockProcess(0)
      })

      const result = await truncateAllTables('test-db', 'local')

      expect(calls.some((c) => c.includes('DELETE FROM "users"'))).toBe(true)
      expect(calls.some((c) => c.includes('DELETE FROM "posts"'))).toBe(true)
      expect(result.get('users')).toBe(10)
      expect(result.get('posts')).toBe(10)
    })

    it('should reset sqlite_sequence', async () => {
      const calls: string[] = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        calls.push(command)

        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(0, JSON.stringify([{ results: [] }]))
        }
        return createMockProcess(0)
      })

      await truncateAllTables('test-db', 'local')

      expect(calls.some((c) => c === 'DELETE FROM sqlite_sequence')).toBe(true)
    })

    it('should use --local flag for local environment', async () => {
      const spawnCalls: Array<{ cmd: string; args: string[] }> = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        spawnCalls.push({ cmd, args })

        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(0, JSON.stringify([{ results: [] }]))
        }
        return createMockProcess(0)
      })

      await truncateAllTables('test-db', 'local')

      expect(spawnCalls.every((call) => call.args.includes('--local'))).toBe(true)
    })

    it('should use --remote flag for remote environment', async () => {
      const spawnCalls: Array<{ cmd: string; args: string[] }> = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        spawnCalls.push({ cmd, args })

        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(0, JSON.stringify([{ results: [] }]))
        }
        return createMockProcess(0)
      })

      await truncateAllTables('test-db', 'remote')

      expect(spawnCalls.every((call) => call.args.includes('--remote'))).toBe(true)
    })

    it('should escape table names with special characters', async () => {
      const calls: string[] = []

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        calls.push(command)

        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(
            0,
            JSON.stringify([{ results: [{ name: 'user"data' }] }])
          )
        }
        if (command.includes('SELECT COUNT')) {
          return createMockProcess(0, JSON.stringify([{ results: [{ count: 0 }] }]))
        }
        return createMockProcess(0)
      })

      await truncateAllTables('test-db', 'local')

      // Should escape double quotes in identifier
      expect(calls.some((c) => c.includes('DELETE FROM "user""data"'))).toBe(true)
    })

    it('should re-enable foreign keys even on error', async () => {
      const calls: string[] = []
      let errorThrown = false

      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''
        calls.push(command)

        // Make the table query fail
        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(1, '', 'Database error')
        }
        return createMockProcess(0)
      })

      try {
        await truncateAllTables('test-db', 'local')
      } catch {
        errorThrown = true
      }

      expect(errorThrown).toBe(true)
      expect(calls[calls.length - 1]).toBe('PRAGMA foreign_keys = ON')
    })

    it('should return empty map when no tables exist', async () => {
      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.find((a) => args[args.indexOf(a) - 1] === '--command') || ''

        if (command.includes('SELECT name FROM sqlite_master')) {
          return createMockProcess(0, JSON.stringify([{ results: [] }]))
        }
        return createMockProcess(0)
      })

      const result = await truncateAllTables('test-db', 'local')

      expect(result.size).toBe(0)
    })
  })
})
