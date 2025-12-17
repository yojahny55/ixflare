/**
 * @module commands/migrate/types
 * @description Type definitions for migration system
 */

/**
 * Represents a migration file (up and down pair)
 */
export interface MigrationFile {
  /** Sequential ID (e.g., '001', '002') */
  id: string

  /** Migration name (e.g., 'add_bio_to_users') */
  name: string

  /** Full filename with extension (e.g., '001_add_bio_to_users.sql') */
  filename: string

  /** Full path to up migration file */
  upPath: string

  /** Full path to down migration file */
  downPath: string

  /** Timestamp when migration was applied (null if pending) */
  appliedAt?: Date | null
}

/**
 * Options for migration commands
 */
export interface MigrateOptions {
  /** Skip confirmation prompts */
  yes?: boolean

  /** Target environment (local or remote) */
  env?: 'local' | 'remote'

  /** Force execution of destructive operations (DROP, TRUNCATE, etc.) */
  force?: boolean

  /** Show help message */
  help?: boolean
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
  /** Whether the operation succeeded */
  success: boolean

  /** Migrations that were applied/rolled back */
  migrations: MigrationFile[]

  /** Error message if failed */
  error?: string
}

/**
 * Tracked migration record in _migrations table
 */
export interface MigrationRecord {
  /** Auto-increment ID */
  id: number

  /** Migration filename (e.g., '001_add_bio_to_users.sql') */
  name: string

  /** Unix millisecond timestamp when applied */
  applied_at: number
}

/**
 * Schema change detected during generation
 */
export interface SchemaChange {
  /** Type of change */
  type: 'table_added' | 'table_removed' | 'column_added' | 'column_removed' | 'column_modified'

  /** Table name affected */
  table: string

  /** Column name (if applicable) */
  column?: string

  /** Human-readable description */
  description: string
}
