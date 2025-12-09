/**
 * @module commands/migrate/apply
 * @description Apply pending migrations to the database
 */

import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { getMigrationsDir, getAllMigrations } from './utils'
import type { MigrateOptions, MigrationRecord } from './types'
import prompts from 'prompts'

/**
 * Apply all pending migrations
 *
 * @param options Migration options
 */
export async function applyMigrations(options: MigrateOptions = {}): Promise<void> {
  const cwd = process.cwd()
  const migrationsDir = getMigrationsDir(cwd)

  // Get database name from wrangler.toml or options
  const databaseName = options.database || getDatabaseNameFromWrangler()

  if (!databaseName) {
    console.error('Error: No database configured')
    console.error('')
    console.error('Please configure a D1 database in wrangler.toml:')
    console.error('')
    console.error('[[d1_databases]]')
    console.error('binding = "DB"')
    console.error('database_name = "my-database"')
    console.error('database_id = "..."')
    console.error('')
    process.exit(1)
  }

  // Ensure _migrations table exists
  await ensureMigrationsTable(databaseName, options.env)

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
  const appliedSet = new Set(appliedMigrations.map((m) => m.name))

  // Calculate pending migrations
  const pendingMigrations = allMigrations.filter((m) => !appliedSet.has(m.filename))

  if (pendingMigrations.length === 0) {
    console.log('')
    console.log('✓ All migrations applied!')
    console.log('')
    console.log(`Database: ${databaseName}`)
    console.log(`Applied:  ${appliedMigrations.length} migration(s)`)
    console.log('')
    return
  }

  // Display pending migrations
  console.log('')
  console.log('Pending migrations:')
  pendingMigrations.forEach((m) => {
    console.log(`  ${m.filename}`)
  })
  console.log('')

  // Prompt for confirmation unless --yes flag
  if (!options.yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: `Apply ${pendingMigrations.length} migration(s)?`,
      initial: true,
    })

    if (!response.confirmed) {
      console.log('Migration cancelled.')
      return
    }
  }

  console.log('')

  // Apply each pending migration
  let appliedCount = 0
  for (const migration of pendingMigrations) {
    const startTime = Date.now()

    try {
      await executeMigration(databaseName, migration.upPath, options.env)
      await recordMigration(databaseName, migration.filename, options.env)

      const duration = Date.now() - startTime
      console.log(`Applied: ${migration.filename} (${duration}ms)`)

      appliedCount++
    } catch (error) {
      console.error(`Failed: ${migration.filename}`)
      console.error(error instanceof Error ? error.message : String(error))
      console.error('')
      console.error('Migration stopped. Fix the error and try again.')
      process.exit(1)
    }
  }

  console.log('')
  console.log(`✓ ${appliedCount} migration(s) applied successfully!`)
  console.log('')
}

/**
 * Get database name from wrangler.toml
 */
function getDatabaseNameFromWrangler(): string | null {
  try {
    const wranglerContent = readFileSync('wrangler.toml', 'utf-8')

    // Simple regex to find database_name in d1_databases section
    const match = wranglerContent.match(/database_name\s*=\s*["']([^"']+)["']/)

    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Ensure _migrations table exists
 */
async function ensureMigrationsTable(
  databaseName: string,
  env?: 'local' | 'remote'
): Promise<void> {
  const createTableSql = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
  `.trim()

  await executeSql(databaseName, createTableSql, env)
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
 * Record a migration in the _migrations table
 */
async function recordMigration(
  databaseName: string,
  filename: string,
  env?: 'local' | 'remote'
): Promise<void> {
  const timestamp = Date.now()
  const sql = `INSERT INTO _migrations (name, applied_at) VALUES ('${filename}', ${timestamp})`

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
        resolve()
      } else {
        reject(new Error(`Migration failed: ${stderr || stdout}`))
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
          // Parse JSON output from wrangler
          const result = JSON.parse(stdout)

          // Extract rows from result (format may vary)
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
