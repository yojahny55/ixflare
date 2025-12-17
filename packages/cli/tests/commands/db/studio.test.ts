/**
 * @module tests/commands/db/studio
 * @description Tests for db:studio command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { studio, __testing } from '../../../src/commands/db/studio'

const { TEMP_CONFIG_FILENAME } = __testing

// Track spawn calls for verification
let spawnCalls: Array<{ command: string; args: string[]; options: object }> = []

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn((command: string, args: string[], options: object) => {
    spawnCalls.push({ command, args, options })
    return {
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          // Simulate successful studio launch and immediate close
          setTimeout(() => callback(0), 10)
        }
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    }
  }),
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

// Mock prompts for database selection
let promptsResponse: object = {}
vi.mock('prompts', () => ({
  default: vi.fn(() => promptsResponse),
}))

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

    // Reset spawn call tracking
    spawnCalls = []

    // Reset prompts response
    promptsResponse = {}

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
      const helpOutput = consoleSpy.mock.calls.flat().join(' ')
      expect(helpOutput).toContain('ix db:studio')
      expect(helpOutput).toContain('--port')
      expect(helpOutput).toContain('--binding')
      expect(helpOutput).toContain('--remote')
      expect(helpOutput).toContain('--open')
      expect(helpOutput).toContain('--help')

      consoleSpy.mockRestore()
    })

    it('should not launch studio when --help is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ help: true })

      expect(spawnCalls.length).toBe(0)

      consoleSpy.mockRestore()
    })
  })

  describe('database configuration validation', () => {
    it('should error when no wrangler.toml exists', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('No database configured')

      consoleErrorSpy.mockRestore()
    })

    it('should error when wrangler.toml has no database', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'name = "test-worker"')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('No database configured')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('local database discovery', () => {
    it('should error when no local database exists', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio()

      expect(process.exit).toHaveBeenCalledWith(1)
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('No local D1 database found')
      expect(errorOutput).toContain('ix dev')

      consoleErrorSpy.mockRestore()
    })

    it('should find database in .wrangler/state/v3/d1 directory', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create mock D1 database structure
      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Should attempt to launch studio
      expect(spawnCalls.length).toBe(1)

      consoleLogSpy.mockRestore()
    })
  })

  describe('unique config file (drizzle.studio.config.ts)', () => {
    it('should NOT touch existing drizzle.config.ts', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create existing drizzle.config.ts with specific content
      const existingConfig = join(testDir, 'drizzle.config.ts')
      const originalContent = 'export default { existing: true, custom: "user-config" }'
      writeFileSync(existingConfig, originalContent)

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Verify original drizzle.config.ts was NOT modified
      const afterContent = readFileSync(existingConfig, 'utf-8')
      expect(afterContent).toBe(originalContent)

      consoleLogSpy.mockRestore()
    })

    it('should create drizzle.studio.config.ts instead of drizzle.config.ts', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // The config is cleaned up after studio closes, so we verify via spawn args
      await studio()

      // Verify drizzle-kit was called with --config pointing to temp file
      expect(spawnCalls.length).toBe(1)
      const configArg = spawnCalls[0].args.find(
        (arg, i) => spawnCalls[0].args[i - 1] === '--config'
      )
      expect(configArg).toContain(TEMP_CONFIG_FILENAME)

      consoleLogSpy.mockRestore()
    })

    it('should pass --config flag to drizzle-kit studio', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Verify spawn was called with --config flag
      expect(spawnCalls.length).toBe(1)
      expect(spawnCalls[0].args).toContain('--config')
      const configIndex = spawnCalls[0].args.indexOf('--config')
      expect(configIndex).toBeGreaterThan(-1)
      expect(spawnCalls[0].args[configIndex + 1]).toContain(TEMP_CONFIG_FILENAME)

      consoleLogSpy.mockRestore()
    })
  })

  describe('multi-binding selection', () => {
    it('should auto-select when only one database exists', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'single-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const prompts = await import('prompts')

      await studio()

      // Should NOT prompt when only one database
      expect(prompts.default).not.toHaveBeenCalled()
      expect(spawnCalls.length).toBe(1)

      consoleLogSpy.mockRestore()
    })

    it('should prompt user when multiple databases exist', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create multiple D1 databases
      const d1Dir1 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'binding-1')
      const d1Dir2 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'binding-2')
      mkdirSync(d1Dir1, { recursive: true })
      mkdirSync(d1Dir2, { recursive: true })
      writeFileSync(join(d1Dir1, 'db.sqlite'), '')
      writeFileSync(join(d1Dir2, 'db.sqlite'), '')

      // Mock prompts to select first database
      promptsResponse = { database: { bindingId: 'binding-1', dbPath: join(d1Dir1, 'db.sqlite') } }

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const prompts = await import('prompts')

      await studio()

      // Should prompt when multiple databases
      expect(prompts.default).toHaveBeenCalled()
      expect(spawnCalls.length).toBe(1)

      consoleLogSpy.mockRestore()
    })

    it('should use --binding flag when provided', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create multiple D1 databases
      const d1Dir1 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'DB')
      const d1Dir2 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'CACHE')
      mkdirSync(d1Dir1, { recursive: true })
      mkdirSync(d1Dir2, { recursive: true })
      writeFileSync(join(d1Dir1, 'db.sqlite'), '')
      writeFileSync(join(d1Dir2, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const prompts = await import('prompts')

      await studio({ binding: 'DB' })

      // Should NOT prompt when --binding is specified
      expect(prompts.default).not.toHaveBeenCalled()
      expect(spawnCalls.length).toBe(1)

      consoleLogSpy.mockRestore()
    })

    it('should error when --binding does not match any database', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create multiple databases (binding flag only checked when multiple exist)
      const d1Dir1 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'DB')
      const d1Dir2 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'CACHE')
      mkdirSync(d1Dir1, { recursive: true })
      mkdirSync(d1Dir2, { recursive: true })
      writeFileSync(join(d1Dir1, 'db.sqlite'), '')
      writeFileSync(join(d1Dir2, 'db.sqlite'), '')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio({ binding: 'NONEXISTENT' })

      expect(process.exit).toHaveBeenCalledWith(1)
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('Binding "NONEXISTENT" not found')
      expect(errorOutput).toContain('Available bindings')

      consoleErrorSpy.mockRestore()
    })

    it('should cancel when user cancels selection prompt', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create multiple D1 databases
      const d1Dir1 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'binding-1')
      const d1Dir2 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'binding-2')
      mkdirSync(d1Dir1, { recursive: true })
      mkdirSync(d1Dir2, { recursive: true })
      writeFileSync(join(d1Dir1, 'db.sqlite'), '')
      writeFileSync(join(d1Dir2, 'db.sqlite'), '')

      // Mock prompts to cancel (empty response)
      promptsResponse = {}

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Should not launch studio when cancelled
      expect(spawnCalls.length).toBe(0)
      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('Cancelled')

      consoleLogSpy.mockRestore()
    })
  })

  describe('remote database support', () => {
    it('should show specific D1 error message for --remote flag', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio({ remote: true })

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')

      // Verify specific D1 error message
      expect(errorOutput).toContain('Remote D1 database access is not supported')
      expect(errorOutput).toContain('Drizzle Studio requires direct SQLite file access')
      expect(errorOutput).toContain('wrangler d1 execute')

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

    it('should error on invalid port (non-numeric)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio({ port: 'abc' })

      expect(process.exit).toHaveBeenCalledWith(1)
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('Invalid port number')

      consoleErrorSpy.mockRestore()
    })

    it('should error on invalid port (out of range)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio({ port: '99999' })

      expect(process.exit).toHaveBeenCalledWith(1)
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('Invalid port number')

      consoleErrorSpy.mockRestore()
    })

    it('should error on invalid port (negative)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await studio({ port: '-1' })

      expect(process.exit).toHaveBeenCalledWith(1)
      const errorOutput = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errorOutput).toContain('Invalid port number')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('subprocess execution', () => {
    it('should pass correct port to drizzle-kit', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ port: '5000' })

      // Verify spawn was called with correct arguments
      expect(spawnCalls.length).toBe(1)
      expect(spawnCalls[0].command).toBe('npx')
      expect(spawnCalls[0].args).toContain('drizzle-kit')
      expect(spawnCalls[0].args).toContain('studio')
      expect(spawnCalls[0].args).toContain('--port')
      expect(spawnCalls[0].args).toContain('5000')

      consoleLogSpy.mockRestore()
    })

    it('should use default port 4000 in subprocess when not specified', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Verify spawn was called with default port
      expect(spawnCalls.length).toBe(1)
      expect(spawnCalls[0].args).toContain('--port')
      expect(spawnCalls[0].args).toContain('4000')

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

    it('should show binding name when multiple databases exist', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create multiple D1 databases
      const d1Dir1 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'PRIMARY_DB')
      const d1Dir2 = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'CACHE_DB')
      mkdirSync(d1Dir1, { recursive: true })
      mkdirSync(d1Dir2, { recursive: true })
      writeFileSync(join(d1Dir1, 'db.sqlite'), '')
      writeFileSync(join(d1Dir2, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio({ binding: 'PRIMARY_DB' })

      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('Binding')
      expect(output).toContain('PRIMARY_DB')

      consoleLogSpy.mockRestore()
    })
  })

  describe('schema path discovery', () => {
    it('should find models in src/models directory', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create src/models directory
      const modelsDir = join(testDir, 'src', 'models')
      mkdirSync(modelsDir, { recursive: true })
      writeFileSync(join(modelsDir, 'user.ts'), 'export const User = {}')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Verify config was passed to spawn
      expect(spawnCalls.length).toBe(1)

      consoleLogSpy.mockRestore()
    })

    it('should find models in src/schema directory', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      // Create src/schema directory
      const schemaDir = join(testDir, 'src', 'schema')
      mkdirSync(schemaDir, { recursive: true })
      writeFileSync(join(schemaDir, 'schema.ts'), 'export const schema = {}')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await studio()

      // Verify studio launched
      expect(spawnCalls.length).toBe(1)

      consoleLogSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should handle table count errors gracefully', async () => {
      const wranglerPath = join(testDir, 'wrangler.toml')
      writeFileSync(wranglerPath, 'database_name = "test-db"')

      const d1Dir = join(testDir, '.wrangler', 'state', 'v3', 'd1', 'test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), '')

      // Make the database mock throw an error
      mockDatabase.prepare = vi.fn(() => {
        throw new Error('Database corrupted')
      })

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Should not throw, should continue with "No tables found"
      await studio()

      expect(process.exit).not.toHaveBeenCalledWith(1)
      const output = consoleLogSpy.mock.calls.flat().join(' ')
      expect(output).toContain('No tables found')

      consoleLogSpy.mockRestore()
    })
  })
})
