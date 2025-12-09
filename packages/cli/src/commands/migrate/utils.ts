/**
 * @module commands/migrate/utils
 * @description Utility functions for migration system
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { MigrationFile } from './types'

/**
 * Get the migrations directory path
 * @param cwd Current working directory (defaults to process.cwd())
 * @returns Absolute path to migrations directory
 */
export function getMigrationsDir(cwd?: string): string {
  const baseDir = cwd || process.cwd()
  return join(baseDir, 'migrations')
}

/**
 * Ensure migrations directory exists, create if not
 * @param cwd Current working directory
 */
export function ensureMigrationsDir(cwd?: string): void {
  const migrationsDir = getMigrationsDir(cwd)
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true })
  }
}

/**
 * Get the next sequential migration ID
 * @param dir Migrations directory path
 * @returns Next migration ID (e.g., '001', '002', '023')
 */
export function getNextMigrationId(dir: string): string {
  if (!existsSync(dir)) {
    return '001'
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .filter((f) => /^\d{3}_/.test(f)) // Must start with 3 digits

  if (files.length === 0) {
    return '001'
  }

  // Extract IDs and find max
  const ids = files.map((f) => {
    const match = f.match(/^(\d{3})_/)
    return match ? parseInt(match[1], 10) : 0
  })

  const maxId = Math.max(...ids)
  const nextId = maxId + 1

  // Pad to 3 digits
  return String(nextId).padStart(3, '0')
}

/**
 * Parse migration filename into components
 * @param filename The migration filename
 * @returns Parsed components or null if invalid format
 */
export function parseMigrationFilename(filename: string): { id: string; name: string } | null {
  // Expected format: 001_add_bio_to_users.sql
  const match = filename.match(/^(\d{3})_(.+)\.sql$/)
  if (!match) {
    return null
  }

  return {
    id: match[1],
    name: match[2],
  }
}

/**
 * Get all migration files from directory (sorted by ID)
 * @param dir Migrations directory path
 * @returns Array of MigrationFile objects
 */
export function getAllMigrations(dir: string): MigrationFile[] {
  if (!existsSync(dir)) {
    return []
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .filter((f) => /^\d{3}_/.test(f))
    .sort() // Lexicographic sort works for 3-digit IDs

  return files.map((filename) => {
    const parsed = parseMigrationFilename(filename)!
    const upPath = join(dir, filename)
    const downFilename = filename.replace('.sql', '.down.sql')
    const downPath = join(dir, downFilename)

    return {
      id: parsed.id,
      name: parsed.name,
      filename,
      upPath,
      downPath,
      appliedAt: null, // Will be populated by query to _migrations table
    }
  })
}

/**
 * Validate migration name (alphanumeric, hyphens, underscores only)
 * @param name The migration name to validate
 * @returns True if valid, false otherwise
 */
export function isValidMigrationName(name: string): boolean {
  return /^[a-z0-9_-]+$/i.test(name)
}

/**
 * Convert migration name to snake_case
 * @param name The migration name
 * @returns snake_case version
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/[\s-]+/g, '_')
    .replace(/^_/, '')
    .replace(/_+/g, '_')
}

/**
 * Format timestamp as readable date
 * @param timestamp Unix milliseconds
 * @returns Formatted date string (YYYY-MM-DD HH:MM:SS)
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

/**
 * Get database name from wrangler.toml
 * @param cwd Current working directory (defaults to process.cwd())
 * @returns Database name or null if not found
 */
export function getDatabaseNameFromWrangler(cwd?: string): string | null {
  try {
    const baseDir = cwd || process.cwd()
    const wranglerPath = join(baseDir, 'wrangler.toml')
    const wranglerContent = readFileSync(wranglerPath, 'utf-8')

    // Simple regex to find database_name in d1_databases section
    const match = wranglerContent.match(/database_name\s*=\s*["']([^"']+)["']/)

    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Escape a string value for safe SQL insertion
 * Prevents SQL injection by escaping single quotes
 * @param value The string value to escape
 * @returns Escaped string safe for SQL
 */
export function escapeSqlString(value: string): string {
  // Escape single quotes by doubling them (SQL standard)
  return value.replace(/'/g, "''")
}

/**
 * Strip SQL comments from content to avoid false positives in destructive operation detection
 * Removes both single-line (--) and multi-line block comments
 * @param sql The SQL content to strip comments from
 * @returns SQL content without comments
 */
export function stripSqlComments(sql: string): string {
  // Remove multi-line comments /* ... */
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, '')

  // Remove single-line comments -- ... (to end of line)
  result = result.replace(/--.*$/gm, '')

  return result
}

/**
 * Destructive SQL patterns that require --force flag
 * Used by both apply.ts and rollback.ts
 */
export const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+INDEX\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\s+\w+\s+DROP\b/i,
]

/**
 * Check if SQL content contains destructive operations
 * Strips comments before checking to avoid false positives
 * @param sql The SQL content to check
 * @returns Array of destructive operations found
 */
export function containsDestructiveOperations(sql: string): string[] {
  // Strip comments to avoid false positives like "-- TODO: DROP TABLE later"
  const strippedSql = stripSqlComments(sql)
  const found: string[] = []

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    const match = strippedSql.match(pattern)
    if (match) {
      found.push(match[0])
    }
  }
  return found
}
