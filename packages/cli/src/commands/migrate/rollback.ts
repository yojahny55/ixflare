/**
 * @module commands/migrate/rollback
 * @description Rollback the last applied migration
 */

import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import {
  getMigrationsDir,
  getAllMigrations,
  getDatabaseNameFromWrangler,
  escapeSqlString,
} from './utils'
import type { MigrateOptions, MigrationRecord } from './types'
import prompts from 'prompts'

/**
 * Destructive SQL patterns that require --force flag
 */
const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+INDEX\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\s+\w+\s+DROP\b/i,
]

/**
 * Check if SQL content contains destructive operations
 */
function containsDestructiveOperations(sql: string): string[] {
  const found: string[] = []
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    const match = sql.match(pattern)
    if (match) {
      found.push(match[0])
    }
  }
  return found
}

/**
 * Check down migration file for destructive operations
 */
function checkDownMigrationForDestructiveOps(downPath: string): string[] {
  try {
    const content = readFileSync(downPath, 'utf-8')
    return containsDestructiveOperations(content)
  } catch {
    return []
  }
}

/**
 * Rollback the last applied migration
 *
 * @param options Migration options
 */
export async function rollbackMigration(options: MigrateOptions = {}): Promise<void> {
  const cwd = process.cwd()
  const migrationsDir = getMigrationsDir(cwd)

  // Get database name from wrangler.toml or options
  const databaseName = options.database || getDatabaseNameFromWrangler()

  if (!databaseName) {
    console.error('Error: No database configured')
    console.error('')
    console.error('Please configure a D1 database in wrangler.toml')
    process.exit(1)
  }

  // Get applied migrations from database
  const appliedMigrations = await getAppliedMigrations(databaseName, options.env)

  if (appliedMigrations.length === 0) {
    console.log('')
    console.log('No applied migrations to rollback.')
    console.log('')
    return
  }

  // Get the last applied migration
  const lastMigration = appliedMigrations[appliedMigrations.length - 1]
  const allMigrations = getAllMigrations(migrationsDir)
  const migrationFile = allMigrations.find((m) => m.filename === lastMigration.name)

  if (!migrationFile) {
    console.error(`Error: Migration file not found: ${lastMigration.name}`)
    process.exit(1)
  }

  // Check if down migration exists
  if (!existsSync(migrationFile.downPath)) {
    console.error('')
    console.error(`Error: No down migration found for ${lastMigration.name}`)
    console.error('')
    console.error('To fix this:')
    console.error(`  1. Create ${migrationFile.downPath} manually`)
    console.error('  2. Add SQL statements to reverse the up migration')
    console.error('')
    console.error('See: https://ixflare.dev/docs/migrations#rollback')
    console.error('')
    process.exit(1)
  }

  // Check for destructive operations in down migration
  const destructiveOps = checkDownMigrationForDestructiveOps(migrationFile.downPath)

  // Display rollback information
  console.log('')
  console.log('Last applied migration:')
  console.log(`  ${lastMigration.name}`)
  console.log('')

  // Warn about destructive operations in down migration
  if (destructiveOps.length > 0) {
    console.log('\x1b[33m⚠ Warning: Down migration contains destructive operations:\x1b[0m')
    for (const op of destructiveOps) {
      console.log(`  - ${op}`)
    }
    console.log('')

    if (!options.force) {
      console.error('\x1b[31mError: Destructive operations require --force flag\x1b[0m')
      console.error('')
      console.error('Use: ix migrate:rollback --force')
      console.error('')
      console.error('This is a safety measure to prevent accidental data loss.')
      process.exit(1)
      return
    }
  }

  // Prompt for confirmation unless --yes flag
  if (!options.yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: 'Rollback this migration?',
      initial: false, // Default to no for safety
    })

    if (!response.confirmed) {
      console.log('Rollback cancelled.')
      return
    }
  }

  console.log('')

  // Execute down migration
  try {
    await executeMigration(databaseName, migrationFile.downPath, options.env)
    await removeMigrationRecord(databaseName, lastMigration.name, options.env)

    console.log(`Rolled back: ${lastMigration.name}`)
    console.log('')
    console.log('✓ Migration rolled back successfully!')
    console.log('')
  } catch (error) {
    console.error(`Failed to rollback: ${lastMigration.name}`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

/**
 * Get applied migrations from _migrations table
 */
async function getAppliedMigrations(
  databaseName: string,
  env?: 'local' | 'remote'
): Promise<MigrationRecord[]> {
  const query = 'SELECT id, name, applied_at FROM _migrations ORDER BY id ASC'

  try {
    const result = await executeSqlQuery(databaseName, query, env)
    return result
  } catch {
    return []
  }
}

/**
 * Remove migration record from _migrations table
 */
async function removeMigrationRecord(
  databaseName: string,
  filename: string,
  env?: 'local' | 'remote'
): Promise<void> {
  // Use escapeSqlString to prevent SQL injection
  const safeFilename = escapeSqlString(filename)
  const sql = `DELETE FROM _migrations WHERE name = '${safeFilename}'`
  await executeSql(databaseName, sql, env)
}

/**
 * Execute a migration file
 */
async function executeMigration(
  databaseName: string,
  filePath: string,
  env?: 'local' | 'remote'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', databaseName, '--file', filePath]

    if (env === 'local' || !env) {
      args.push('--local')
    } else {
      args.push('--remote')
    }

    const wrangler = spawn('wrangler', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let stderr = ''

    wrangler.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('error', (err) => {
      reject(new Error(`Failed to execute wrangler: ${err.message}`))
    })

    wrangler.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve()
      } else {
        reject(new Error(`Migration failed: ${stderr}`))
      }
    })
  })
}

/**
 * Execute raw SQL statement
 */
async function executeSql(
  databaseName: string,
  sql: string,
  env?: 'local' | 'remote'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', databaseName, '--command', sql]

    if (env === 'local' || !env) {
      args.push('--local')
    } else {
      args.push('--remote')
    }

    const wrangler = spawn('wrangler', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let stderr = ''

    wrangler.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('error', (err) => {
      reject(new Error(`Failed to execute wrangler: ${err.message}`))
    })

    wrangler.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve()
      } else {
        reject(new Error(`SQL execution failed: ${stderr}`))
      }
    })
  })
}

/**
 * Execute SQL query and return results
 */
async function executeSqlQuery(
  databaseName: string,
  sql: string,
  env?: 'local' | 'remote'
): Promise<MigrationRecord[]> {
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', databaseName, '--command', sql, '--json']

    if (env === 'local' || !env) {
      args.push('--local')
    } else {
      args.push('--remote')
    }

    const wrangler = spawn('wrangler', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''

    wrangler.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    wrangler.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('error', (err) => {
      reject(new Error(`Failed to execute wrangler: ${err.message}`))
    })

    wrangler.on('close', (exitCode) => {
      if (exitCode === 0) {
        try {
          const result = JSON.parse(stdout)
          const rows = result[0]?.results || []
          resolve(rows)
        } catch (err) {
          reject(new Error(`Failed to parse query results: ${err}`))
        }
      } else {
        reject(new Error(`Query failed: ${stderr}`))
      }
    })
  })
}
