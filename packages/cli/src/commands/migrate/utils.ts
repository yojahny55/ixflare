/**
 * @module commands/migrate/utils
 * @description Utility functions for migration system
 */

import { existsSync, mkdirSync, readdirSync } from 'fs'
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
