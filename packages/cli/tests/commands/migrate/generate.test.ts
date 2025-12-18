/**
 * @module tests/commands/migrate/generate
 * @description Tests for migration generation command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { generateMigration } from '../../../src/commands/migrate/generate'

describe('generateMigration', () => {
  const testDir = join(process.cwd(), '.test-migrations-generate')
  const originalExit = process.exit
  const originalConsoleError = console.error
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn

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
    console.warn = vi.fn()
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
    console.warn = originalConsoleWarn
  })

  it('should create up and down migration files', async () => {
    await generateMigration('add_bio_to_users', { cwd: testDir, empty: true })

    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(join(migrationsDir, '001_add_bio_to_users.sql'))).toBe(true)
    expect(existsSync(join(migrationsDir, '001_add_bio_to_users.down.sql'))).toBe(true)
  })

  it('should use sequential IDs for multiple migrations', async () => {
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })

    // Create first migration manually
    writeFileSync(join(migrationsDir, '001_initial.sql'), '')

    await generateMigration('add_users', { cwd: testDir, empty: true })

    expect(existsSync(join(migrationsDir, '002_add_users.sql'))).toBe(true)
  })

  it('should convert migration name to snake_case', async () => {
    await generateMigration('AddBioToUsers', { cwd: testDir, empty: true })

    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(join(migrationsDir, '001_add_bio_to_users.sql'))).toBe(true)
  })

  it('should create placeholder content in migration files', async () => {
    await generateMigration('test_migration', { cwd: testDir, empty: true })

    const migrationsDir = join(testDir, 'migrations')
    const upContent = readFileSync(join(migrationsDir, '001_test_migration.sql'), 'utf-8')
    const downContent = readFileSync(join(migrationsDir, '001_test_migration.down.sql'), 'utf-8')

    expect(upContent).toContain('Migration: test_migration')
    expect(upContent).toContain('Add your SQL statements below')
    expect(downContent).toContain('Migration Rollback: test_migration')
    expect(downContent).toContain('rollback SQL statements')
  })

  it('should fail with empty migration name', async () => {
    await generateMigration('', { cwd: testDir })

    expect(process.exit).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('IX_E401'))
  })

  it('should fail with invalid migration name', async () => {
    await generateMigration('invalid migration!', { cwd: testDir })

    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should create migrations directory if it does not exist', async () => {
    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(migrationsDir)).toBe(false)

    await generateMigration('test', { cwd: testDir, empty: true })

    expect(existsSync(migrationsDir)).toBe(true)
  })

  it('should generate migration from schema file', async () => {
    // Create a schema file
    const schemaPath = join(testDir, 'schema.json')
    writeFileSync(
      schemaPath,
      JSON.stringify({
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
              { name: 'email', type: 'TEXT NOT NULL UNIQUE' },
              { name: 'name', type: 'TEXT NOT NULL' },
            ],
          },
        ],
      })
    )

    // Create wrangler.toml
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    // This will warn that database isn't available but still generate placeholder
    await generateMigration('add_users', { cwd: testDir, schema: 'schema.json' })

    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(join(migrationsDir, '001_add_users.sql'))).toBe(true)
  })

  it('should show help text for --schema option', async () => {
    await generateMigration('', { cwd: testDir })

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('IX_E401'))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('migrate:generate'))
  })

  it('should handle --empty flag to skip schema detection', async () => {
    // Create wrangler.toml (would normally trigger introspection)
    writeFileSync(
      join(testDir, 'wrangler.toml'),
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "test-db"\ndatabase_id = "abc123"`
    )

    await generateMigration('test', { cwd: testDir, empty: true })

    const migrationsDir = join(testDir, 'migrations')
    const content = readFileSync(join(migrationsDir, '001_test.sql'), 'utf-8')

    // Should contain placeholder, not auto-generated SQL
    expect(content).toContain('Add your SQL statements below')
  })

  it('should display help text when --help flag is passed', async () => {
    await generateMigration('', { cwd: testDir, help: true })

    expect(console.log).toHaveBeenCalled()
    const logCalls = (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls
    const helpText = logCalls.map((call: string[]) => call.join(' ')).join('\n')

    expect(helpText).toContain('Usage: ix migrate:generate')
    expect(helpText).toContain('--schema')
    expect(helpText).toContain('--empty')
    expect(helpText).toContain('Examples:')
  })

  it('should exit after displaying help without creating files', async () => {
    await generateMigration('test_help', { cwd: testDir, help: true })

    const migrationsDir = join(testDir, 'migrations')

    // Should not create migration files when showing help
    if (existsSync(migrationsDir)) {
      expect(existsSync(join(migrationsDir, '001_test_help.sql'))).toBe(false)
    }

    expect(process.exit).toHaveBeenCalledWith(0)
  })
})
