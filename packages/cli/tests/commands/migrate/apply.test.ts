/**
 * @module tests/commands/migrate/apply
 * @description Tests for migration apply command
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
import { applyMigrations } from '../../../src/commands/migrate/apply'

describe('applyMigrations', () => {
  const testDir = join(process.cwd(), '.test-migrations-apply')
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
    // Mock process.cwd to return testDir (no wrangler.toml exists)
    process.cwd = () => testDir

    await applyMigrations({})

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

    // Mock spawn for ensureMigrationsTable
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    mockSpawn.mockImplementation(() => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }
      return mockProcess
    })

    await applyMigrations({})

    expect(console.log).toHaveBeenCalledWith('No migrations found.')
  })

  it('should show pending migrations and prompt for confirmation', async () => {
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
    let callCount = 0
    mockSpawn.mockImplementation(() => {
      callCount++
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              // Return empty results for applied migrations query
              if (callCount === 2) {
                callback(JSON.stringify([{ results: [] }]))
              }
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

    await applyMigrations({})

    expect(console.log).toHaveBeenCalledWith('Pending migrations:')
    expect(console.log).toHaveBeenCalledWith('Migration cancelled.')
  })

  it('should skip confirmation with --yes flag', async () => {
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

    // Mock prompts should NOT be called with --yes
    const mockPrompts = prompts as unknown as ReturnType<typeof vi.fn>

    await applyMigrations({ yes: true })

    // prompts should not have been called
    expect(mockPrompts).not.toHaveBeenCalled()
  })

  it('should report all migrations applied when none pending', async () => {
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

    // Mock spawn to return the migration as already applied
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>
    let callCount = 0
    mockSpawn.mockImplementation(() => {
      callCount++
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              // Return migration as applied
              if (callCount === 2) {
                callback(
                  JSON.stringify([
                    { results: [{ id: 1, name: '001_test.sql', applied_at: Date.now() }] },
                  ])
                )
              }
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

    await applyMigrations({})

    expect(console.log).toHaveBeenCalledWith('✓ All migrations applied!')
  })
})
