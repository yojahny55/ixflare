/**
 * @module tests/commands/migrate/rollback
 * @description Tests for migration rollback command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// Mock prompts module
vi.mock('prompts', () => ({
  default: vi.fn(),
}))

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import prompts from 'prompts'
import { spawn } from 'child_process'
import { rollbackMigration } from '../../../src/commands/migrate/rollback'

describe('rollbackMigration', () => {
  const testDir = join(process.cwd(), '.test-migrations-rollback')
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
    await rollbackMigration({})

    expect(process.exit).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalledWith('Error: No database configured')
  })

  it('should report no migrations to rollback when none applied', async () => {
    // Create wrangler.toml with database config
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

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

    await rollbackMigration({})

    expect(console.log).toHaveBeenCalledWith('No applied migrations to rollback.')
  })

  it('should fail when down migration file does not exist', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with only up migration
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')
    // Note: NOT creating 001_test.down.sql

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return one applied migration
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  { results: [{ id: 1, name: '001_test.sql', applied_at: Date.now() }] },
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

    await rollbackMigration({ yes: true }) // Use --yes to skip confirmation prompt

    expect(process.exit).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No down migration found for 001_test.sql')
    )
  })

  it('should prompt for confirmation before rollback', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with up and down migrations
    // Use non-destructive down migration to avoid --force requirement
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')
    writeFileSync(join(migrationsDir, '001_test.down.sql'), '-- Placeholder rollback')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return one applied migration
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  { results: [{ id: 1, name: '001_test.sql', applied_at: Date.now() }] },
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

    // Mock prompts to cancel
    const mockPrompts = prompts as unknown as ReturnType<typeof vi.fn>
    mockPrompts.mockResolvedValue({ confirmed: false })

    await rollbackMigration({})

    expect(mockPrompts).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith('Rollback cancelled.')
  })

  it('should skip confirmation with --yes flag', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with up and down migrations
    // Use non-destructive down migration
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')
    writeFileSync(join(migrationsDir, '001_test.down.sql'), '-- Non-destructive rollback')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  { results: [{ id: 1, name: '001_test.sql', applied_at: Date.now() }] },
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

    // Mock prompts should NOT be called with --yes
    const mockPrompts = prompts as unknown as ReturnType<typeof vi.fn>

    await rollbackMigration({ yes: true })

    // prompts should not have been called
    expect(mockPrompts).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith('✓ Migration rolled back successfully!')
  })

  it('should rollback the last applied migration', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations directory with multiple migrations
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_first.sql'), 'CREATE TABLE first (id INTEGER);')
    writeFileSync(join(migrationsDir, '001_first.down.sql'), '-- Rollback first migration')
    writeFileSync(join(migrationsDir, '002_second.sql'), 'CREATE TABLE second (id INTEGER);')
    writeFileSync(join(migrationsDir, '002_second.down.sql'), '-- Rollback second migration')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return two applied migrations
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
                      { id: 1, name: '001_first.sql', applied_at: Date.now() - 1000 },
                      { id: 2, name: '002_second.sql', applied_at: Date.now() },
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

    await rollbackMigration({ yes: true })

    // Should rollback the second (last) migration
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('002_second.sql'))
    expect(console.log).toHaveBeenCalledWith('✓ Migration rolled back successfully!')
  })

  it('should require --force for destructive down migrations', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations with destructive down migration
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')
    writeFileSync(join(migrationsDir, '001_test.down.sql'), 'DROP TABLE test;')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return one applied migration
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  { results: [{ id: 1, name: '001_test.sql', applied_at: Date.now() }] },
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

    // Try rollback without --force
    await rollbackMigration({ yes: true })

    // Should fail without --force
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Destructive operations require --force flag')
    )
  })

  it('should allow destructive rollback with --force flag', async () => {
    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // Create migrations with destructive down migration
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE test (id INTEGER);')
    writeFileSync(join(migrationsDir, '001_test.down.sql'), 'DROP TABLE test;')

    // Mock process.cwd to return testDir
    process.cwd = () => testDir

    // Mock spawn to return one applied migration
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(
                JSON.stringify([
                  { results: [{ id: 1, name: '001_test.sql', applied_at: Date.now() }] },
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

    // Rollback with --force
    await rollbackMigration({ yes: true, force: true })

    // Should succeed with --force
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Down migration contains destructive operations')
    )
    expect(console.log).toHaveBeenCalledWith('✓ Migration rolled back successfully!')
  })
})
