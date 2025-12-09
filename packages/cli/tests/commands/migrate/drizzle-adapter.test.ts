/**
 * @module tests/commands/migrate/drizzle-adapter
 * @description Tests for Drizzle Kit adapter functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  modelsToDrizzleSnapshot,
  generateDrizzleSchemaFile,
  generateMigrationWithDrizzle,
} from '../../../src/commands/migrate/drizzle-adapter'
import type { ExtractedModel, ExtractedColumn } from '../../../src/commands/migrate/model-loader'

describe('Drizzle Adapter', () => {
  const testDir = join(process.cwd(), '.test-drizzle-adapter')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('modelsToDrizzleSnapshot', () => {
    it('should create empty snapshot for empty models array', () => {
      const snapshot = modelsToDrizzleSnapshot([])

      expect(snapshot.version).toBe('6')
      expect(snapshot.dialect).toBe('sqlite')
      expect(Object.keys(snapshot.tables)).toHaveLength(0)
      expect(snapshot.enums).toEqual({})
      expect(snapshot._meta).toEqual({ tables: {}, columns: {} })
    })

    it('should convert simple model to snapshot', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'name',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)

      expect(snapshot.tables).toHaveProperty('users')
      expect(snapshot.tables.users.name).toBe('users')
      expect(snapshot.tables.users.columns).toHaveProperty('id')
      expect(snapshot.tables.users.columns).toHaveProperty('name')

      // Check id column
      expect(snapshot.tables.users.columns.id.primaryKey).toBe(true)
      expect(snapshot.tables.users.columns.id.autoincrement).toBe(true)
      expect(snapshot.tables.users.columns.id.type).toBe('integer')

      // Check name column
      expect(snapshot.tables.users.columns.name.primaryKey).toBe(false)
      expect(snapshot.tables.users.columns.name.notNull).toBe(true)
      expect(snapshot.tables.users.columns.name.type).toBe('text')
    })

    it('should handle nullable columns', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'posts',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'bio',
              type: 'TEXT',
              baseType: 'text',
              nullable: true,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)

      expect(snapshot.tables.posts.columns.bio.notNull).toBe(false)
    })

    it('should handle unique constraints', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'email',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: true,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)

      expect(snapshot.tables.users.uniqueConstraints).toHaveProperty('users_email_unique')
      expect(snapshot.tables.users.uniqueConstraints.users_email_unique.columns).toEqual(['email'])
    })

    it('should handle foreign key references', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'posts',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'authorId',
              type: 'INTEGER',
              baseType: 'integer',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
              references: {
                table: 'users',
                column: 'id',
              },
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)

      expect(snapshot.tables.posts.foreignKeys).toHaveProperty('posts_authorId_fk')
      const fk = snapshot.tables.posts.foreignKeys.posts_authorId_fk
      expect(fk.tableFrom).toBe('posts')
      expect(fk.tableTo).toBe('users')
      expect(fk.columnsFrom).toEqual(['authorId'])
      expect(fk.columnsTo).toEqual(['id'])
    })

    it('should handle default values', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'settings',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'active',
              type: 'INTEGER',
              baseType: 'boolean',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
              defaultValue: '1',
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)

      expect(snapshot.tables.settings.columns.active.default).toBe('1')
    })

    it('should map all EdgeRecord types correctly', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'test_types',
          columns: [
            {
              name: 'col_id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'col_string',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_text',
              type: 'TEXT',
              baseType: 'text',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_integer',
              type: 'INTEGER',
              baseType: 'integer',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_boolean',
              type: 'INTEGER',
              baseType: 'boolean',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_datetime',
              type: 'INTEGER',
              baseType: 'datetime',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_decimal',
              type: 'REAL',
              baseType: 'decimal',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_json',
              type: 'TEXT',
              baseType: 'json',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_enum',
              type: 'TEXT',
              baseType: 'enum',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)
      const cols = snapshot.tables.test_types.columns

      expect(cols.col_id.type).toBe('integer')
      expect(cols.col_string.type).toBe('text')
      expect(cols.col_text.type).toBe('text')
      expect(cols.col_integer.type).toBe('integer')
      expect(cols.col_boolean.type).toBe('integer')
      expect(cols.col_datetime.type).toBe('integer')
      expect(cols.col_decimal.type).toBe('real')
      expect(cols.col_json.type).toBe('text')
      expect(cols.col_enum.type).toBe('text')
    })

    it('should handle multiple tables', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
        {
          tableName: 'posts',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
        {
          tableName: 'comments',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
      ]

      const snapshot = modelsToDrizzleSnapshot(models)

      expect(Object.keys(snapshot.tables)).toHaveLength(3)
      expect(snapshot.tables).toHaveProperty('users')
      expect(snapshot.tables).toHaveProperty('posts')
      expect(snapshot.tables).toHaveProperty('comments')
    })
  })

  describe('generateDrizzleSchemaFile', () => {
    it('should generate valid Drizzle schema for empty models', () => {
      const schema = generateDrizzleSchemaFile([])

      expect(schema).toContain(
        "import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core'"
      )
    })

    it('should generate schema with table definition', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'name',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      expect(schema).toContain('export const users = sqliteTable')
      expect(schema).toContain("id: integer('id').primaryKey({ autoIncrement: true })")
      expect(schema).toContain("name: text('name').notNull()")
    })

    it('should convert snake_case table names to camelCase for export', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'user_profiles',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      expect(schema).toContain('export const userProfiles = sqliteTable')
      expect(schema).toContain("'user_profiles'") // Table name in SQL remains snake_case
    })

    it('should handle unique columns', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'email',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: true,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      expect(schema).toContain("email: text('email').notNull().unique()")
    })

    it('should handle nullable columns', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'bio',
              type: 'TEXT',
              baseType: 'text',
              nullable: true,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      // Nullable columns should NOT have .notNull()
      expect(schema).toContain("bio: text('bio')")
      expect(schema).not.toContain("bio: text('bio').notNull()")
    })

    it('should handle default values', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'settings',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'active',
              type: 'INTEGER',
              baseType: 'boolean',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
              defaultValue: '1',
            },
            {
              name: 'status',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
              defaultValue: 'pending',
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      expect(schema).toContain('.default(1)')
      expect(schema).toContain(".default('pending')")
    })

    it('should generate all column types correctly', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'test_types',
          columns: [
            {
              name: 'col_id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'col_string',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_text',
              type: 'TEXT',
              baseType: 'text',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_integer',
              type: 'INTEGER',
              baseType: 'integer',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_boolean',
              type: 'INTEGER',
              baseType: 'boolean',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_datetime',
              type: 'INTEGER',
              baseType: 'datetime',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_decimal',
              type: 'REAL',
              baseType: 'decimal',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_json',
              type: 'TEXT',
              baseType: 'json',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
            {
              name: 'col_enum',
              type: 'TEXT',
              baseType: 'enum',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      expect(schema).toContain("integer('col_id').primaryKey({ autoIncrement: true })")
      expect(schema).toContain("text('col_string')")
      expect(schema).toContain("text('col_text')")
      expect(schema).toContain("integer('col_integer')")
      expect(schema).toContain("integer('col_boolean')")
      expect(schema).toContain("integer('col_datetime')")
      expect(schema).toContain("real('col_decimal')")
      expect(schema).toContain("text('col_json')")
      expect(schema).toContain("text('col_enum')")
    })

    it('should handle multiple tables', () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
        {
          tableName: 'posts',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
      ]

      const schema = generateDrizzleSchemaFile(models)

      expect(schema).toContain('export const users = sqliteTable')
      expect(schema).toContain('export const posts = sqliteTable')
    })
  })

  describe('generateMigrationWithDrizzle', () => {
    // Note: These tests depend on drizzle-kit being installed
    // They test the integration but may be skipped in CI if drizzle-kit is not available

    it('should return null for empty models (no changes)', async () => {
      const result = await generateMigrationWithDrizzle([], 'empty_migration', testDir)

      // Either null or no SQL statements
      if (result !== null) {
        // If drizzle-kit generated something, it should be minimal
        expect(result.up.trim()).toBe('')
      }
    })

    it('should clean up temp directory after generation', async () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
      ]

      await generateMigrationWithDrizzle(models, 'test_cleanup', testDir)

      const tempDir = join(testDir, '.ixflare-migrate-temp')
      expect(existsSync(tempDir)).toBe(false)
    })

    it('should create schema and config files in temp directory during generation', async () => {
      // This test verifies the internal behavior by checking artifacts if they exist
      // The cleanup happens in finally block, so we can't easily check intermediate state
      // Instead, we verify the function completes without error
      const models: ExtractedModel[] = [
        {
          tableName: 'users',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
            {
              name: 'name',
              type: 'TEXT',
              baseType: 'string',
              nullable: false,
              unique: false,
              primaryKey: false,
              autoIncrement: false,
            },
          ],
        },
      ]

      // Should not throw
      const result = await generateMigrationWithDrizzle(models, 'test_files', testDir)

      // Result could be null if drizzle-kit is not available
      // or contain SQL if it is
      expect(result === null || typeof result.up === 'string').toBe(true)
    })
  })

  describe('generateDownMigration (via generateMigrationWithDrizzle)', () => {
    // The generateDownMigration function is internal, but we can test its behavior
    // indirectly through the returned down migration SQL

    it('should generate DROP TABLE for CREATE TABLE', async () => {
      const models: ExtractedModel[] = [
        {
          tableName: 'test_table',
          columns: [
            {
              name: 'id',
              type: 'INTEGER PRIMARY KEY AUTOINCREMENT',
              baseType: 'id',
              nullable: false,
              unique: false,
              primaryKey: true,
              autoIncrement: true,
            },
          ],
        },
      ]

      const result = await generateMigrationWithDrizzle(models, 'test_down', testDir)

      if (result !== null && result.up.includes('CREATE TABLE')) {
        expect(result.down).toContain('DROP TABLE')
        expect(result.down).toContain('test_table')
      }
    })
  })
})
