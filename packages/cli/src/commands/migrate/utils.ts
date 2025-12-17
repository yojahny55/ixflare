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
 *
 * This follows the SQL standard for escaping string literals.
 * Single quotes are doubled: ' becomes ''
 *
 * SECURITY NOTE:
 * This is suitable for SQLite/D1 string literals used in wrangler d1 execute.
 * For more complex scenarios, consider:
 * - Using parameterized queries when available
 * - Validating input against an allowlist when possible
 *
 * LIMITATIONS:
 * - Only escapes single quotes (sufficient for SQLite string literals)
 * - Does not escape backslashes (not needed for SQLite)
 * - Does not handle binary data
 *
 * @param value The string value to escape
 * @returns Escaped string safe for SQL string literals
 */
export function escapeSqlString(value: string): string {
  // Escape single quotes by doubling them (SQL standard for SQLite)
  // This is the standard method for SQLite and matches wrangler d1's expectations
  return value.replace(/'/g, "''")
}

/**
 * Default timeout for wrangler commands (2 minutes)
 * Prevents CLI from hanging indefinitely on network issues
 */
export const WRANGLER_TIMEOUT_MS = 120000

/**
 * Result of a wrangler command execution
 */
export interface WranglerResult {
  success: boolean
  stdout: string
  stderr: string
  timedOut: boolean
}

/**
 * Spawn wrangler with timeout protection
 * Prevents CLI from hanging indefinitely on network issues or unresponsive wrangler
 *
 * @param args Arguments to pass to wrangler
 * @param cwd Working directory
 * @param timeoutMs Timeout in milliseconds (default: WRANGLER_TIMEOUT_MS)
 * @returns Promise resolving to execution result
 */
export function spawnWranglerWithTimeout(
  args: string[],
  cwd: string,
  timeoutMs: number = WRANGLER_TIMEOUT_MS
): Promise<WranglerResult> {
  // Dynamic import to avoid circular dependencies
  const { spawn } = require('child_process')

  return new Promise((resolve) => {
    const wrangler = spawn('wrangler', args, {
      cwd,
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    // Set timeout to prevent indefinite hanging
    const timeoutId = setTimeout(() => {
      timedOut = true
      wrangler.kill('SIGTERM')
      // Force kill after 5 seconds if SIGTERM didn't work
      setTimeout(() => {
        if (!wrangler.killed) {
          wrangler.kill('SIGKILL')
        }
      }, 5000)
    }, timeoutMs)

    wrangler.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    wrangler.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    wrangler.on('error', (err: Error) => {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        stdout,
        stderr: `Process error: ${err.message}`,
        timedOut: false,
      })
    })

    wrangler.on('close', (code: number | null) => {
      clearTimeout(timeoutId)
      resolve({
        success: code === 0 && !timedOut,
        stdout,
        stderr: timedOut ? `Wrangler timed out after ${timeoutMs / 1000} seconds` : stderr,
        timedOut,
      })
    })
  })
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
 *
 * Note: DELETE FROM without WHERE is considered destructive (bulk delete)
 * DELETE FROM with WHERE is allowed without --force
 */
export const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\bDROP\s+TABLE\b/i, description: 'DROP TABLE' },
  { pattern: /\bDROP\s+INDEX\b/i, description: 'DROP INDEX' },
  { pattern: /\bDROP\s+COLUMN\b/i, description: 'DROP COLUMN' },
  { pattern: /\bTRUNCATE\b/i, description: 'TRUNCATE' },
  { pattern: /\bALTER\s+TABLE\s+\w+\s+DROP\b/i, description: 'ALTER TABLE DROP' },
]

/**
 * Check if a DELETE statement is a bulk delete (no WHERE clause)
 * DELETE FROM table; - destructive (bulk delete)
 * DELETE FROM table WHERE id = 1; - not destructive (targeted delete)
 */
function isBulkDelete(sql: string): boolean {
  // Find all DELETE FROM statements
  const deleteRegex = /\bDELETE\s+FROM\s+["`]?\w+["`]?\s*([^;]*);/gi
  let match

  while ((match = deleteRegex.exec(sql)) !== null) {
    const afterFrom = match[1].trim().toUpperCase()
    // If there's no WHERE clause, it's a bulk delete
    if (!afterFrom.includes('WHERE')) {
      return true
    }
  }

  return false
}

/**
 * Check if SQL content contains destructive operations
 * Strips comments before checking to avoid false positives
 *
 * Destructive operations include:
 * - DROP TABLE, DROP INDEX, DROP COLUMN
 * - TRUNCATE
 * - ALTER TABLE ... DROP
 * - DELETE FROM without WHERE clause (bulk delete)
 *
 * NOT considered destructive:
 * - DELETE FROM ... WHERE ... (targeted delete)
 *
 * @param sql The SQL content to check
 * @returns Array of destructive operations found
 */
export function containsDestructiveOperations(sql: string): string[] {
  // Strip comments to avoid false positives like "-- TODO: DROP TABLE later"
  const strippedSql = stripSqlComments(sql)
  const found: string[] = []

  // Check standard destructive patterns
  for (const { pattern, description } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(strippedSql)) {
      found.push(description)
    }
  }

  // Check for bulk DELETE (DELETE FROM without WHERE)
  if (isBulkDelete(strippedSql)) {
    found.push('DELETE FROM (bulk delete without WHERE)')
  }

  return found
}
