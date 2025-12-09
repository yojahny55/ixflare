/**
 * @module tests/commands/migrate/generate
 * @description Tests for migration generation command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { generateMigration, fieldTypeToSql } from '../../../src/commands/migrate/generate'

// Simplified field config for testing
interface FieldConfig {
  type: 'id' | 'string' | 'text' | 'integer' | 'decimal' | 'boolean' | 'datetime' | 'json' | 'enum'
  nullable: boolean
  unique?: boolean
  default?: unknown | (() => unknown)
  values?: readonly string[]
  autoIncrement?: boolean
  primaryKey?: boolean
}

describe('generateMigration', () => {
  const testDir = join(process.cwd(), '.test-migrations-generate')
  const originalExit = process.exit
  const originalConsoleError = console.error
  const originalConsoleLog = console.log

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
  })

  it('should create up and down migration files', async () => {
    await generateMigration('add_bio_to_users', { cwd: testDir })

    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(join(migrationsDir, '001_add_bio_to_users.sql'))).toBe(true)
    expect(existsSync(join(migrationsDir, '001_add_bio_to_users.down.sql'))).toBe(true)
  })

  it('should use sequential IDs for multiple migrations', async () => {
    const migrationsDir = join(testDir, 'migrations')
    mkdirSync(migrationsDir, { recursive: true })

    // Create first migration manually
    writeFileSync(join(migrationsDir, '001_initial.sql'), '')

    await generateMigration('add_users', { cwd: testDir })

    expect(existsSync(join(migrationsDir, '002_add_users.sql'))).toBe(true)
  })

  it('should convert migration name to snake_case', async () => {
    await generateMigration('AddBioToUsers', { cwd: testDir })

    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(join(migrationsDir, '001_add_bio_to_users.sql'))).toBe(true)
  })

  it('should create placeholder content in migration files', async () => {
    await generateMigration('test_migration', { cwd: testDir })

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
    expect(console.error).toHaveBeenCalledWith('Error: Migration name is required')
  })

  it('should fail with invalid migration name', async () => {
    await generateMigration('invalid migration!', { cwd: testDir })

    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should create migrations directory if it does not exist', async () => {
    const migrationsDir = join(testDir, 'migrations')
    expect(existsSync(migrationsDir)).toBe(false)

    await generateMigration('test', { cwd: testDir })

    expect(existsSync(migrationsDir)).toBe(true)
  })
})

describe('fieldTypeToSql', () => {
  it('should convert id field to SQLite PRIMARY KEY', () => {
    const field: FieldConfig = {
      type: 'id',
      nullable: false,
      autoIncrement: true,
      primaryKey: true,
    }
    expect(fieldTypeToSql(field)).toBe('INTEGER PRIMARY KEY AUTOINCREMENT')
  })

  it('should convert string field to TEXT', () => {
    const field: FieldConfig = { type: 'string', nullable: false }
    expect(fieldTypeToSql(field)).toBe('TEXT NOT NULL')
  })

  it('should add nullable for nullable fields', () => {
    const field: FieldConfig = { type: 'string', nullable: true }
    expect(fieldTypeToSql(field)).not.toContain('NOT NULL')
  })

  it('should add default value for strings', () => {
    const field: FieldConfig = { type: 'string', nullable: false, default: 'user' }
    expect(fieldTypeToSql(field)).toBe("TEXT NOT NULL DEFAULT 'user'")
  })

  it('should add default value for booleans', () => {
    const field: FieldConfig = { type: 'boolean', nullable: false, default: false }
    expect(fieldTypeToSql(field)).toBe('INTEGER NOT NULL DEFAULT 0')
  })

  it('should add default value for integers', () => {
    const field: FieldConfig = { type: 'integer', nullable: false, default: 0 }
    expect(fieldTypeToSql(field)).toBe('INTEGER NOT NULL DEFAULT 0')
  })

  it('should add UNIQUE constraint', () => {
    const field: FieldConfig = { type: 'string', nullable: false, unique: true }
    expect(fieldTypeToSql(field)).toBe('TEXT NOT NULL UNIQUE')
  })

  it('should handle integer type', () => {
    const field: FieldConfig = { type: 'integer', nullable: false }
    expect(fieldTypeToSql(field)).toBe('INTEGER NOT NULL')
  })

  it('should handle decimal type', () => {
    const field: FieldConfig = { type: 'decimal', nullable: false }
    expect(fieldTypeToSql(field)).toBe('REAL NOT NULL')
  })

  it('should handle datetime type', () => {
    const field: FieldConfig = { type: 'datetime', nullable: false }
    expect(fieldTypeToSql(field)).toBe('INTEGER NOT NULL')
  })

  it('should handle json type', () => {
    const field: FieldConfig = { type: 'json', nullable: false }
    expect(fieldTypeToSql(field)).toBe('TEXT NOT NULL')
  })

  it('should handle enum type with CHECK constraint', () => {
    const field: FieldConfig = {
      type: 'enum',
      nullable: false,
      values: ['user', 'admin', 'moderator'],
    }
    const result = fieldTypeToSql(field)
    expect(result).toContain('TEXT NOT NULL')
    expect(result).toContain("CHECK(value IN ('user', 'admin', 'moderator'))")
  })
})
