/**
 * @module commands/migrate/status
 * @description Show migration status
 */

import { spawn } from 'child_process'
import {
  getMigrationsDir,
  getAllMigrations,
  formatTimestamp,
  getDatabaseNameFromWrangler,
  WRANGLER_TIMEOUT_MS,
} from './utils'
import type { MigrationRecord, MigrateOptions } from './types'

/**
 * Display help information for migrate:status command
 */
export function showMigrationStatusHelp(): void {
  console.log(`
Usage: ix migrate:status [options]

Display the current status of all database migrations.

Options:
  --remote            Query remote database (default: local)
  -h, --help          Show this help message

Examples:
  ix migrate:status
    Show migration status for local database

  ix migrate:status --remote
    Show migration status for remote D1 database

Output:
  ✓ 001_initial.sql              (2024-01-15 10:30:45)  <- Applied
  ✓ 002_add_users.sql            (2024-01-15 11:22:10)  <- Applied
  ○ 003_add_posts.sql            (pending)              <- Not yet applied

Summary:
  Database: <name>
  Applied:  2 / 3
  Pending:  1

See also:
  ix migrate              Apply pending migrations
  ix migrate:rollback     Rollback last migration
  ix migrate:generate     Create new migration
`)
}

/**
 * Display migration status
 */
export async function migrationStatus(options: MigrateOptions = {}): Promise<void> {
  // Show help if requested
  if (options.help) {
    showMigrationStatusHelp()
    process.exit(0)
  }

  const cwd = process.cwd()
  const migrationsDir = getMigrationsDir(cwd)

  // Get database name from wrangler.toml
  const databaseName = getDatabaseNameFromWrangler()

  if (!databaseName) {
    console.error('Error: No database configured')
    console.error('')
    console.error('Please configure a D1 database in wrangler.toml')
    process.exit(1)
  }

  // Get all migration files
  const allMigrations = getAllMigrations(migrationsDir)

  if (allMigrations.length === 0) {
    console.log('')
    console.log('No migrations found.')
    console.log('')
    console.log('Create a migration with: ix migrate:generate <name>')
    console.log('')
    return
  }

  // Get applied migrations from database
  const appliedMigrations = await getAppliedMigrations(databaseName, options.env)
  const appliedMap = new Map(appliedMigrations.map((m) => [m.name, m]))

  // Display status
  console.log('')
  console.log('Migration Status:')
  console.log('')

  for (const migration of allMigrations) {
    const applied = appliedMap.get(migration.filename)

    if (applied) {
      const timestamp = formatTimestamp(applied.applied_at)
      console.log(`  ✓ ${migration.filename.padEnd(40)} (${timestamp})`)
    } else {
      console.log(`  ○ ${migration.filename.padEnd(40)} (pending)`)
    }
  }

  console.log('')
  console.log(`Database: ${databaseName}`)
  console.log(`Applied:  ${appliedMigrations.length} / ${allMigrations.length}`)
  console.log(`Pending:  ${allMigrations.length - appliedMigrations.length}`)
  console.log('')

  if (appliedMigrations.length < allMigrations.length) {
    console.log('Run: ix migrate (to apply pending migrations)')
    console.log('')
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
    // Table might not exist yet
    return []
  }
}

/**
 * Execute SQL query and return results
 * Includes timeout protection to prevent indefinite hanging
 */
async function executeSqlQuery(
  databaseName: string,
  sql: string,
  env?: 'local' | 'remote'
): Promise<MigrationRecord[]> {
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', databaseName, '--command', sql, '--json']

    if (env === 'remote') {
      args.push('--remote')
    } else {
      args.push('--local')
    }

    const wrangler = spawn('wrangler', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    // Set timeout to prevent indefinite hanging
    const timeoutId = setTimeout(() => {
      timedOut = true
      wrangler.kill('SIGTERM')
    }, WRANGLER_TIMEOUT_MS)

    wrangler.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    wrangler.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('error', (err) => {
      clearTimeout(timeoutId)
      reject(new Error(`Failed to execute wrangler: ${err.message}`))
    })

    wrangler.on('close', (exitCode) => {
      clearTimeout(timeoutId)

      if (timedOut) {
        reject(new Error(`Wrangler timed out after ${WRANGLER_TIMEOUT_MS / 1000} seconds`))
        return
      }

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
