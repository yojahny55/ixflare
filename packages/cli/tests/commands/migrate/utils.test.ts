/**
 * @module tests/commands/migrate/utils
 * @description Tests for migration utility functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  getMigrationsDir,
  ensureMigrationsDir,
  getNextMigrationId,
  parseMigrationFilename,
  getAllMigrations,
  isValidMigrationName,
  toSnakeCase,
  formatTimestamp,
} from '../../../src/commands/migrate/utils'

describe('Migration Utils', () => {
  const testDir = join(process.cwd(), '.test-migrations')

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up after each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('getMigrationsDir', () => {
    it('should return migrations directory path', () => {
      const dir = getMigrationsDir(testDir)
      expect(dir).toBe(join(testDir, 'migrations'))
    })

    it('should use process.cwd() when no cwd provided', () => {
      const dir = getMigrationsDir()
      expect(dir).toBe(join(process.cwd(), 'migrations'))
    })
  })

  describe('ensureMigrationsDir', () => {
    it('should create migrations directory if it does not exist', () => {
      const migrationsDir = join(testDir, 'migrations')
      expect(existsSync(migrationsDir)).toBe(false)

      ensureMigrationsDir(testDir)

      expect(existsSync(migrationsDir)).toBe(true)
    })

    it('should not fail if directory already exists', () => {
      const migrationsDir = join(testDir, 'migrations')
      mkdirSync(migrationsDir, { recursive: true })

      expect(() => ensureMigrationsDir(testDir)).not.toThrow()
      expect(existsSync(migrationsDir)).toBe(true)
    })
  })

  describe('getNextMigrationId', () => {
    it('should return 001 for empty directory', () => {
      mkdirSync(testDir, { recursive: true })
      const nextId = getNextMigrationId(testDir)
      expect(nextId).toBe('001')
    })

    it('should return 001 for non-existent directory', () => {
      const nextId = getNextMigrationId(join(testDir, 'non-existent'))
      expect(nextId).toBe('001')
    })

    it('should return next sequential ID', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_initial.sql'), '')
      writeFileSync(join(testDir, '002_add_users.sql'), '')

      const nextId = getNextMigrationId(testDir)
      expect(nextId).toBe('003')
    })

    it('should handle gaps in sequence', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_initial.sql'), '')
      writeFileSync(join(testDir, '005_skip_ahead.sql'), '')

      const nextId = getNextMigrationId(testDir)
      expect(nextId).toBe('006')
    })

    it('should ignore down migration files', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_initial.sql'), '')
      writeFileSync(join(testDir, '001_initial.down.sql'), '')

      const nextId = getNextMigrationId(testDir)
      expect(nextId).toBe('002')
    })

    it('should ignore non-migration files', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_initial.sql'), '')
      writeFileSync(join(testDir, 'readme.txt'), '')
      writeFileSync(join(testDir, 'invalid_name.sql'), '')

      const nextId = getNextMigrationId(testDir)
      expect(nextId).toBe('002')
    })
  })

  describe('parseMigrationFilename', () => {
    it('should parse valid migration filename', () => {
      const result = parseMigrationFilename('001_add_bio_to_users.sql')
      expect(result).toEqual({
        id: '001',
        name: 'add_bio_to_users',
      })
    })

    it('should return null for invalid format', () => {
      expect(parseMigrationFilename('invalid.sql')).toBeNull()
      expect(parseMigrationFilename('01_too_short.sql')).toBeNull()
      expect(parseMigrationFilename('001_no_extension')).toBeNull()
      expect(parseMigrationFilename('001_wrong.txt')).toBeNull()
    })

    it('should handle down migration files', () => {
      const result = parseMigrationFilename('001_add_bio_to_users.down.sql')
      // Should parse with .down in the name part
      expect(result).toEqual({
        id: '001',
        name: 'add_bio_to_users.down',
      })
    })
  })

  describe('getAllMigrations', () => {
    it('should return empty array for non-existent directory', () => {
      const migrations = getAllMigrations(join(testDir, 'non-existent'))
      expect(migrations).toEqual([])
    })

    it('should return all migration files sorted by ID', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '002_second.sql'), '')
      writeFileSync(join(testDir, '001_first.sql'), '')
      writeFileSync(join(testDir, '003_third.sql'), '')

      const migrations = getAllMigrations(testDir)

      expect(migrations).toHaveLength(3)
      expect(migrations[0].id).toBe('001')
      expect(migrations[1].id).toBe('002')
      expect(migrations[2].id).toBe('003')
    })

    it('should include up and down paths', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_test.sql'), '')
      writeFileSync(join(testDir, '001_test.down.sql'), '')

      const migrations = getAllMigrations(testDir)

      expect(migrations[0].upPath).toBe(join(testDir, '001_test.sql'))
      expect(migrations[0].downPath).toBe(join(testDir, '001_test.down.sql'))
    })

    it('should ignore down migration files in listing', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_test.sql'), '')
      writeFileSync(join(testDir, '001_test.down.sql'), '')

      const migrations = getAllMigrations(testDir)

      expect(migrations).toHaveLength(1)
    })

    it('should ignore non-migration files', () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, '001_valid.sql'), '')
      writeFileSync(join(testDir, 'readme.txt'), '')
      writeFileSync(join(testDir, 'invalid.sql'), '')

      const migrations = getAllMigrations(testDir)

      expect(migrations).toHaveLength(1)
      expect(migrations[0].filename).toBe('001_valid.sql')
    })
  })

  describe('isValidMigrationName', () => {
    it('should accept valid names', () => {
      expect(isValidMigrationName('add_bio_to_users')).toBe(true)
      expect(isValidMigrationName('create-posts-table')).toBe(true)
      expect(isValidMigrationName('migration123')).toBe(true)
      expect(isValidMigrationName('AddBioToUsers')).toBe(true)
    })

    it('should reject invalid names', () => {
      expect(isValidMigrationName('has spaces')).toBe(false)
      expect(isValidMigrationName('has@special')).toBe(false)
      expect(isValidMigrationName('has.dots')).toBe(false)
      expect(isValidMigrationName('')).toBe(false)
    })
  })

  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('addBioToUsers')).toBe('add_bio_to_users')
      expect(toSnakeCase('CreatePostsTable')).toBe('create_posts_table')
    })

    it('should handle spaces', () => {
      expect(toSnakeCase('add bio to users')).toBe('add_bio_to_users')
    })

    it('should handle hyphens', () => {
      expect(toSnakeCase('add-bio-to-users')).toBe('add_bio_to_users')
    })

    it('should handle mixed formats', () => {
      expect(toSnakeCase('AddBio-to Users')).toBe('add_bio_to_users')
    })

    it('should collapse multiple underscores', () => {
      expect(toSnakeCase('add__bio___users')).toBe('add_bio_users')
    })

    it('should not add leading underscore', () => {
      expect(toSnakeCase('AddBio')).toBe('add_bio')
    })
  })

  describe('formatTimestamp', () => {
    it('should format Unix milliseconds as readable date', () => {
      // 2024-12-01 10:30:00 UTC (adjust for timezone)
      const timestamp = 1733050200000
      const formatted = formatTimestamp(timestamp)

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      // Time will vary based on timezone, just check format
      expect(formatted).toContain('2024-12-01')
    })

    it('should handle current time', () => {
      const now = Date.now()
      const formatted = formatTimestamp(now)

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })
  })
})
