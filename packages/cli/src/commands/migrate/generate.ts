/**
 * @module commands/migrate/generate
 * @description Generate migration files from schema changes
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  getMigrationsDir,
  ensureMigrationsDir,
  getNextMigrationId,
  toSnakeCase,
  isValidMigrationName,
} from './utils'

/**
 * Field configuration interface (simplified for CLI use)
 */
interface FieldConfig {
  type: 'id' | 'string' | 'text' | 'integer' | 'decimal' | 'boolean' | 'datetime' | 'json' | 'enum'
  nullable: boolean
  unique?: boolean
  default?: unknown | (() => unknown)
  values?: readonly string[]
}

/**
 * Generate a new migration file
 *
 * @param name The migration name (e.g., 'add_bio_to_users')
 * @param options Optional configuration
 */
export async function generateMigration(name: string, options?: { cwd?: string }): Promise<void> {
  const cwd = options?.cwd || process.cwd()

  // Validate migration name
  if (!name || name.trim() === '') {
    console.error('Error: Migration name is required')
    console.error('')
    console.error('Usage: ix migrate:generate <name>')
    console.error('Example: ix migrate:generate add_bio_to_users')
    process.exit(1)
  }

  // Convert to snake_case and validate
  const migrationName = toSnakeCase(name)

  if (!isValidMigrationName(migrationName)) {
    console.error(`Error: Invalid migration name: ${migrationName}`)
    console.error(
      'Migration names must contain only alphanumeric characters, hyphens, and underscores'
    )
    process.exit(1)
  }

  // Ensure migrations directory exists
  ensureMigrationsDir(cwd)
  const migrationsDir = getMigrationsDir(cwd)

  // Get next migration ID
  const migrationId = getNextMigrationId(migrationsDir)

  // Create migration filename
  const filename = `${migrationId}_${migrationName}.sql`
  const downFilename = `${migrationId}_${migrationName}.down.sql`

  const upPath = join(migrationsDir, filename)
  const downPath = join(migrationsDir, downFilename)

  // For now, create empty migration files
  // In a full implementation, this would detect schema changes and generate SQL
  const upMigration = generatePlaceholderUpMigration(migrationName)
  const downMigration = generatePlaceholderDownMigration(migrationName)

  // Write migration files
  writeFileSync(upPath, upMigration, 'utf-8')
  writeFileSync(downPath, downMigration, 'utf-8')

  // Output success message
  console.log('')
  console.log('Migration generated successfully!')
  console.log('')
  console.log(`  Up:   ${filename}`)
  console.log(`  Down: ${downFilename}`)
  console.log('')
  console.log('Next steps:')
  console.log('  1. Edit the migration files to add your SQL statements')
  console.log('  2. Run: ix migrate (to apply migrations)')
  console.log('  3. Run: ix migrate:status (to check migration status)')
  console.log('')
}

/**
 * Generate placeholder up migration content
 */
function generatePlaceholderUpMigration(name: string): string {
  const timestamp = new Date().toISOString()
  return `-- Migration: ${name}
-- Created: ${timestamp}
-- Description: Add your migration description here

-- Add your SQL statements below:

-- Example:
-- ALTER TABLE users ADD COLUMN bio TEXT;
-- ALTER TABLE users ADD COLUMN avatar_url TEXT;
`
}

/**
 * Generate placeholder down migration content
 */
function generatePlaceholderDownMigration(name: string): string {
  const timestamp = new Date().toISOString()
  return `-- Migration Rollback: ${name}
-- Created: ${timestamp}
-- Description: Rollback changes from the up migration

-- Add your rollback SQL statements below:

-- Example (reverse order of up migration):
-- ALTER TABLE users DROP COLUMN avatar_url;
-- ALTER TABLE users DROP COLUMN bio;
`
}

/**
 * Convert EdgeRecord field type to SQLite type
 * This is a simplified version - full implementation would use Drizzle Kit
 */
export function fieldTypeToSql(field: FieldConfig): string {
  let sqlType: string

  switch (field.type) {
    case 'id':
      return 'INTEGER PRIMARY KEY AUTOINCREMENT'

    case 'string':
      sqlType = 'TEXT'
      break

    case 'text':
      sqlType = 'TEXT'
      break

    case 'integer':
      sqlType = 'INTEGER'
      break

    case 'decimal':
      sqlType = 'REAL'
      break

    case 'boolean':
      sqlType = 'INTEGER' // SQLite doesn't have boolean, use 0/1
      break

    case 'datetime':
      sqlType = 'INTEGER' // Unix timestamp in milliseconds
      break

    case 'json':
      sqlType = 'TEXT' // JSON stored as TEXT
      break

    case 'enum':
      sqlType = 'TEXT'
      break

    default:
      sqlType = 'TEXT'
  }

  // Add NOT NULL constraint if not nullable
  if (!field.nullable) {
    sqlType += ' NOT NULL'
  }

  // Add default value if specified
  if (field.default !== undefined) {
    const defaultValue = typeof field.default === 'function' ? field.default() : field.default

    if (typeof defaultValue === 'string') {
      sqlType += ` DEFAULT '${defaultValue}'`
    } else if (typeof defaultValue === 'boolean') {
      sqlType += ` DEFAULT ${defaultValue ? 1 : 0}`
    } else {
      sqlType += ` DEFAULT ${defaultValue}`
    }
  }

  // Add UNIQUE constraint if specified
  if (field.unique) {
    sqlType += ' UNIQUE'
  }

  // Add CHECK constraint for enum values
  if (field.type === 'enum' && field.values && field.values.length > 0) {
    const values = field.values.map((v: string) => `'${v}'`).join(', ')
    sqlType += ` CHECK(value IN (${values}))`
  }

  return sqlType
}
