/**
 * @module tests/commands/db/studio
 * @description Tests for db:studio command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { studio } from '../../../src/commands/db/studio'

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        // Simulate successful studio launch and immediate close
        setTimeout(() => callback(0), 10)
      }
    }),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}))

// Mock better-sqlite3 for table counting
const mockDatabase = {
  prepare: vi.fn(),
  close: vi.fn(),
}

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => mockDatabase),
  }
})

describe('db:studio command', () => {
  const testDir = join(process.cwd(), '.test-studio')
  const originalCwd = process.cwd()
  const originalExit = process.exit

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })

    // Mock process.cwd()
    process.cwd = vi.fn(() => testDir)

    // Mock process.exit to prevent test termination
    process.exit = vi.fn() as never

    // Reset better-sqlite3 mock to default (no tables)
    mockDatabase.prepare = vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => ({ count: 0 })),
    }))
  })

  afterEach(() => {
    // Clean up after each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }

    // Restore original functions
    process.cwd = vi.fn(() => originalCwd)
    process.exit = originalExit as never
    vi.clearAllMocks()
  })

  describe('--help flag', () => {
    it('should show help information when --help is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ help: true })

      expect(consoleSpy).toHaveBeenCalled()
      const helpOutput = consoleSpy.mock.calls.join('\n')
      expect(helpOutput).toContain('ix db:studio')
      expect(helpOutput).toContain('Launch database GUI')
      expect(helpOutput).toContain('--port')
      expect(helpOutput).toContain('--remote')
      expect(helpOutput).toContain('--open')

      consoleSpy.mockRestore()
    })

    it('should show help when -h flag is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ help: true })

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('wrangler.toml validation', () => {
    it('should error when wrangler.toml is missing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('No database configured')

      consoleErrorSpy.mockRestore()
    })

    it('should error when wrangler.toml has no database configured', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'name = "test-app"\n')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should parse database name from wrangler.toml', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      const wranglerContent = `
name = "test-app"

[[d1_databases]]
binding = "DB"
database_name = "my-test-db"
database_id = "abc123"
      `
      writeFileSync(wranglerPath, wranglerContent)

      // Create mock D1 database
      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('my-test-db')

      consoleLogSpy.mockRestore()
    })
  })

  describe('local database discovery', () => {
    it('should error when local D1 database does not exist', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('Local D1 database not found')

      consoleErrorSpy.mockRestore()
    })

    it('should find local D1 database in .wrangler directory', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create mock D1 database
      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      const dbPath = join(d1Dir, 'db.sqlite')
      writeFileSync(dbPath, '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Should succeed without error
      expect(process.exit).not.toHaveBeenCalledWith(1)
      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should handle multiple D1 bindings and find first valid database', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create multiple binding directories
      const d1BaseDir = join(testDir, '.wrangler', 'state', 'v3', 'd1')
      const binding1 = join(d1BaseDir, 'binding-1')
      const binding2 = join(d1BaseDir, 'binding-2')

      mkdirSync(binding1, { recursive: true })
      mkdirSync(binding2, { recursive: true })

      // Only binding-2 has database
      writeFileSync(join(binding2, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Should succeed
      expect(process.exit).not.toHaveBeenCalledWith(1)

      consoleLogSpy.mockRestore()
    })
  })

  describe('drizzle.config.ts generation', () => {
    it('should generate drizzle.config.ts with correct database path', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create mock D1 database
      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Check drizzle.config.ts was created
      const configPath = join(testDir, 'drizzle.config.ts')
      expect(existsSync(configPath)).toBe(true)

      const configContent = readFileSync(configPath, 'utf-8')
      expect(configContent).toContain("dialect: 'sqlite'")
      expect(configContent).toContain('db.sqlite')
      expect(configContent).toContain('./src/models/*.ts')
      expect(configContent).toContain('./migrations')

      consoleLogSpy.mockRestore()
    })
  })

  describe('remote database support', () => {
    it('should show coming soon message for --remote flag', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio({ remote: true })

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('Remote database support coming soon')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('argument parsing', () => {
    it('should use default port 4000 when not specified', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('4000')

      consoleLogSpy.mockRestore()
    })

    it('should use custom port when --port is provided', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ port: '5000' })

      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('5000')

      consoleLogSpy.mockRestore()
    })

    it('should handle --open flag', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ open: true })

      // Should succeed
      expect(process.exit).not.toHaveBeenCalledWith(1)

      consoleLogSpy.mockRestore()
    })
  })

  describe('output formatting', () => {
    it('should display connection information', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "my-app-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('Database Studio')
      expect(output).toContain('my-app-db')
      expect(output).toContain('D1')
      expect(output).toContain('https://local.drizzle.studio')

      consoleLogSpy.mockRestore()
    })

    it('should display message when database has no tables', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      const output = consoleLogSpy.mock.calls.flat().join(' ')
      // When database is empty or table query fails, should show "No tables found"
      expect(output).toContain('No tables found')

      consoleLogSpy.mockRestore()
    })
  })
})
