/**
 * @module tests/commands/migrate/status
 * @description Tests for migration status command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'child_process'
import { migrationStatus } from '../../../src/commands/migrate/status'

describe('migrationStatus', () => {
  const testDir = join(process.cwd(), '.test-migrations-status')
  const originalExit = process.exit
  const originalConsoleError = console.error
  const originalConsoleLog = console.log
  const originalCwd = process.cwd

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })

    // Mock process.exit to prevent tests from exiting
    process.exit = vi.fn() as never

    // Mock console methods
    console.error = vi.fn()
    console.log = vi.fn()

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up after each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }

    // Restore process.exit
    process.exit = originalExit

    // Restore console methods
    console.error = originalConsoleError
    console.log = originalConsoleLog

    // Restore process.cwd
    process.cwd = originalCwd
  })

  it('should fail when no database is configured', async () => {
    // No wrangler.toml exists
    await migrationStatus()

    expect(process.exit).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalledWith('Error: No database configured')
  })

  it('should report no migrations found when migrations directory is empty', async () => {
    // Create wrangler.toml with database config
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    await migrationStatus()

    expect(console.log).toHaveBeenCalledWith('No migrations found.')
  })

  it('should show pending migration status', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with a migration file
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return empty applied migrations
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(JSON.stringify([{ results: [] }]))
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }
      return mockProcess
    })

    await migrationStatus()

    expect(console.log).toHaveBeenCalledWith('Migration Status:')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('001_test.sql'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('pending'))
    expect(console.log).toHaveBeenCalledWith('Pending:  1')
  })

  it('should show applied migration status with timestamp', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with a migration file
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return one applied migration
    const timestamp = Date.now()
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  { results: [{ id: 1, name: '001_test.sql', applied_at: timestamp }] },
                ])
              )
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }
      return mockProcess
    })

    await migrationStatus()

    expect(console.log).toHaveBeenCalledWith('Migration Status:')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✓'))
    expect(console.log).toHaveBeenCalledWith('Applied:  1 / 1')
    expect(console.log).toHaveBeenCalledWith('Pending:  0')
  })

  it('should show mixed applied and pending migrations', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with multiple migration files
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_first.sql'), 'CREATE TABLE first (id INTEGER);')
    writeFileSync(join(migrationsDir, '002_second.sql'), 'CREATE TABLE second (id INTEGER);')
    writeFileSync(join(migrationsDir, '003_third.sql'), 'CREATE TABLE third (id INTEGER);')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return only first two as applied
    const timestamp = Date.now()
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  {
                    results: [
                      { id: 1, name: '001_first.sql', applied_at: timestamp - 2000 },
                      { id: 2, name: '002_second.sql', applied_at: timestamp - 1000 },
                    ],
                  },
                ])
              )
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }
      return mockProcess
    })

    await migrationStatus()

    expect(console.log).toHaveBeenCalledWith('Migration Status:')
    expect(console.log).toHaveBeenCalledWith('Applied:  2 / 3')
    expect(console.log).toHaveBeenCalledWith('Pending:  1')
    expect(console.log).toHaveBeenCalledWith('Run: ix migrate (to apply pending migrations)')
  })

  it('should show database name in output', async () => {
    // Create wrangler.toml in actual cwd since getDatabaseNameFromWrangler uses process.cwd()
    // The test must create the wrangler.toml where process.cwd points
    const originalCwdValue = process.cwd()

    // Create test directory structure
    const testCwdDir = join(testDir, 'cwd-test')
    mkdirSync(testCwdDir, { recursive: true })

    // Create wrangler.toml
    writeFileSync(
      join(testCwdDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "my-custom-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with a migration file
    const migrationsDir = join(testCwdDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')

    // Mock process.cwd to return testCwdDir
    process.cwd = () => testCwdDir

    // Mock spawn
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(JSON.stringify([{ results: [] }]))
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }
      return mockProcess
    })

    await migrationStatus()

    expect(console.log).toHaveBeenCalledWith('Database: my-custom-db')
  })
})
