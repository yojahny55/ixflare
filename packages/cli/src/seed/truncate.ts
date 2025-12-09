/**
 * @module seed/truncate
 * @description Table truncation logic for fresh seeding
 */

import { spawn } from 'child_process'

/**
 * Execute SQL command via wrangler d1 execute
 * @param databaseName Database name from wrangler.toml
 * @param sql SQL command to execute
 * @param env Environment (local or remote)
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

    wrangler.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Failed to execute SQL: ${stderr}`))
      }
    })

    wrangler.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Execute SQL query and get results via wrangler d1 execute
 * @param databaseName Database name from wrangler.toml
 * @param sql SQL query to execute
 * @param env Environment (local or remote)
 */
async function executeSqlQuery<T = unknown>(
  databaseName: string,
  sql: string,
  env?: 'local' | 'remote'
): Promise<T[]> {
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

    wrangler.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    wrangler.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout)
          // Wrangler returns [{ results: [...] }]
          const results = result[0]?.results || []
          resolve(results)
        } catch (error) {
          reject(new Error(`Failed to parse query results: ${String(error)}`))
        }
      } else {
        reject(new Error(`Failed to execute query: ${stderr}`))
      }
    })

    wrangler.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Truncate all tables in the database
 * CRITICAL: Handles foreign key constraints by disabling them outside transaction
 *
 * @param databaseName Database name from wrangler.toml
 * @param env Environment (local or remote)
 * @returns Map of table names to number of rows deleted
 */
export async function truncateAllTables(
  databaseName: string,
  env?: 'local' | 'remote'
): Promise<Map<string, number>> {
  const deletedCounts = new Map<string, number>()

  // CRITICAL: PRAGMA foreign_keys must be set OUTSIDE transaction
  // D1's batch() creates implicit transaction, so we use individual exec() calls
  await executeSql(databaseName, 'PRAGMA foreign_keys = OFF', env)

  try {
    // Get all tables (exclude system tables and migrations)
    const query = `
      SELECT name FROM sqlite_master
      WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_migrations'
        AND name NOT LIKE 'd1_migrations'
    `.trim()

    const tables = await executeSqlQuery<{ name: string }>(databaseName, query, env)

    // Get row counts before deletion
    for (const table of tables) {
      const countQuery = `SELECT COUNT(*) as count FROM ${escapeIdentifier(table.name)}`
      const result = await executeSqlQuery<{ count: number }>(databaseName, countQuery, env)
      const count = result[0]?.count || 0
      deletedCounts.set(table.name, count)
    }

    // Delete from all tables (order doesn't matter with FK disabled)
    for (const table of tables) {
      await executeSql(databaseName, `DELETE FROM ${escapeIdentifier(table.name)}`, env)
    }

    // Reset autoincrement counters
    await executeSql(databaseName, 'DELETE FROM sqlite_sequence', env)
  } finally {
    // Re-enable foreign keys
    await executeSql(databaseName, 'PRAGMA foreign_keys = ON', env)
  }

  return deletedCounts
}

/**
 * Escape SQL identifier (table/column name)
 * @param identifier The identifier to escape
 * @returns Escaped identifier
 */
function escapeIdentifier(identifier: string): string {
  // SQLite uses double quotes for identifiers
  return `"${identifier.replace(/"/g, '""')}"`
}
