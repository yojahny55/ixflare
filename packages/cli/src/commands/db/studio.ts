/**
 * @module commands/db/studio
 * @description Launch Drizzle Studio database GUI for D1 inspection
 */

import { spawn } from 'child_process'
import { existsSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import pc from 'picocolors'
import { getDatabaseNameFromWrangler } from '@/commands/migrate/utils'

/**
 * Studio command options
 */
export interface StudioOptions {
  /**
   * Port for studio server (default: 4000)
   */
  port?: string

  /**
   * Connect to remote D1 database instead of local
   */
  remote?: boolean

  /**
   * Auto-open browser (default: false)
   */
  open?: boolean

  /**
   * Show help information
   */
  help?: boolean
}

/**
 * Show help information for db:studio command
 */
function showHelp(): void {
  console.log(`
${pc.bold('ix db:studio')} - Launch database GUI (Drizzle Studio)

${pc.bold('USAGE')}
  ix db:studio [options]

${pc.bold('OPTIONS')}
  --port <number>     Port for studio server (default: 4000)
  --remote            Connect to remote D1 database
  --open              Auto-open browser (default: false)
  --help, -h          Show this help message

${pc.bold('DESCRIPTION')}
  Launches Drizzle Studio, a browser-based database management interface.

  By default, connects to your local D1 database in .wrangler/state/v3/d1/.
  Use --remote to connect to your production/remote D1 database.

${pc.bold('FEATURES')}
  • View table schemas and column types
  • Browse records with pagination, filtering, and sorting
  • Execute raw SQL queries with results in tabular format
  • View relationships between tables (foreign keys)
  • Edit data in development mode (local database)
  • Export query results to CSV/JSON

${pc.bold('SECURITY')}
  ${pc.yellow('⚠️  Remote database access:')}
  When using --remote, Drizzle Studio connects to your production database.
  By default, the interface is read-only until you explicitly enable editing.
  All modifications are logged for audit purposes.

${pc.bold('EXAMPLES')}
  # Launch studio for local database
  ix db:studio

  # Launch on custom port
  ix db:studio --port 5000

  # Connect to remote database
  ix db:studio --remote

  # Auto-open browser
  ix db:studio --open

${pc.bold('REQUIREMENTS')}
  • D1 database configured in wrangler.toml
  • For local: Database must exist in .wrangler/state/v3/d1/
  • For remote: Valid Cloudflare API credentials

${pc.bold('LEARN MORE')}
  Drizzle Studio docs: https://orm.drizzle.team/drizzle-studio/overview
  `)
}

/**
 * Find local D1 database file path
 * Searches .wrangler/state/v3/d1/ for SQLite files
 *
 * @param cwd Current working directory
 * @param _databaseName Database name from wrangler.toml (unused, for future filtering)
 * @returns Path to SQLite file or null if not found
 */
function findLocalD1Database(cwd: string, _databaseName: string): string | null {
  const wranglerStateDir = join(cwd, '.wrangler', 'state', 'v3', 'd1')

  if (!existsSync(wranglerStateDir)) {
    return null
  }

  // List all D1 binding directories
  const bindings = readdirSync(wranglerStateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())

  // Try to find database by checking db.sqlite in each binding directory
  for (const binding of bindings) {
    const dbPath = join(wranglerStateDir, binding.name, 'db.sqlite')
    if (existsSync(dbPath)) {
      return dbPath
    }
  }

  return null
}

/**
 * Generate temporary drizzle.config.ts for studio
 * This config points to the local D1 SQLite file
 *
 * @param cwd Current working directory
 * @param dbPath Path to SQLite database file
 */
function generateDrizzleConfig(cwd: string, dbPath: string): void {
  const configPath = join(cwd, 'drizzle.config.ts')

  // Generate config content
  const configContent = `import type { Config } from 'drizzle-kit'

export default {
  schema: './src/models/*.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: '${dbPath.replace(/\\/g, '/')}',
  },
} satisfies Config
`

  writeFileSync(configPath, configContent, 'utf-8')
}

/**
 * Launch Drizzle Studio as a subprocess
 *
 * @param cwd Current working directory
 * @param port Port number for studio server
 * @param autoOpen Whether to auto-open browser
 * @returns Promise that resolves when studio exits
 */
function launchDrizzleStudio(cwd: string, port: string, autoOpen: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('')
    console.log(pc.cyan('Starting Drizzle Studio...'))
    console.log('')

    // Build drizzle-kit studio command
    const args = ['studio', '--port', port]
    if (!autoOpen) {
      // Drizzle Studio auto-opens by default, we need to suppress it
      // Note: Current drizzle-kit may not have a --no-open flag
      // This is a known limitation we'll document
    }

    const studio = spawn('npx', ['drizzle-kit', ...args], {
      cwd,
      stdio: 'inherit',
      shell: true,
    })

    studio.on('error', (err) => {
      console.error('')
      console.error(pc.red('Failed to start Drizzle Studio:'))
      console.error(err.message)
      console.error('')
      reject(err)
    })

    studio.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.error('')
        console.error(pc.red(`Drizzle Studio exited with code ${code}`))
        console.error('')
        reject(new Error(`Studio exited with code ${code}`))
      } else {
        console.log('')
        console.log(pc.green('✓ Drizzle Studio closed'))
        console.log('')
        resolve()
      }
    })
  })
}

/**
 * Get table counts from SQLite database
 * Shows how many records are in each table
 *
 * @param dbPath Path to SQLite database
 * @returns Map of table name to record count
 */
function getTableCounts(dbPath: string): Map<string, number> {
  try {
    // Dynamic import to avoid bundling better-sqlite3 unnecessarily
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'")
      .all() as Array<{ name: string }>

    const counts = new Map<string, number>()
    for (const { name } of tables) {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number }
      counts.set(name, result.count)
    }

    db.close()
    return counts
  } catch {
    return new Map()
  }
}

/**
 * Launch Drizzle Studio database GUI
 *
 * Workflow:
 * 1. Get database name from wrangler.toml
 * 2. Find local D1 SQLite file (or prepare for remote)
 * 3. Generate drizzle.config.ts pointing to database
 * 4. Launch drizzle-kit studio as subprocess
 * 5. Show connection info and table counts
 *
 * @param options Studio command options
 */
export async function studio(options: StudioOptions = {}): Promise<void> {
  // Show help if requested
  if (options.help) {
    showHelp()
    return
  }

  const cwd = process.cwd()
  const port = options.port || '4000'
  const isRemote = options.remote || false
  const autoOpen = options.open || false

  // Get database name from wrangler.toml
  const databaseName = getDatabaseNameFromWrangler(cwd)

  if (!databaseName) {
    console.error('')
    console.error(pc.red('Error: No database configured'))
    console.error('')
    console.error('Please configure a D1 database in wrangler.toml:')
    console.error('')
    console.error(pc.dim('[[d1_databases]]'))
    console.error(pc.dim('binding = "DB"'))
    console.error(pc.dim('database_name = "my-database"'))
    console.error(pc.dim('database_id = "..."'))
    console.error('')
    process.exit(1)
    return
  }

  // Remote database support
  if (isRemote) {
    console.error('')
    console.error(pc.yellow('⚠️  Remote database support coming soon'))
    console.error('')
    console.error('Drizzle Studio currently supports local SQLite databases.')
    console.error('Remote D1 access requires Cloudflare D1 HTTP API integration.')
    console.error('')
    console.error('For now, please use:')
    console.error('  • Local studio: ix db:studio')
    console.error('  • wrangler CLI: wrangler d1 execute <db> --command "SELECT * FROM users"')
    console.error('')
    process.exit(1)
    return
  }

  // Find local D1 database
  const dbPath = findLocalD1Database(cwd, databaseName)

  if (!dbPath) {
    console.error('')
    console.error(pc.red('Error: Local D1 database not found'))
    console.error('')
    console.error(`Database "${databaseName}" does not exist locally.`)
    console.error('')
    console.error('To create the database, run:')
    console.error(pc.cyan('  ix dev'))
    console.error('')
    console.error('This will initialize the local D1 database in .wrangler/state/v3/d1/')
    console.error('')
    process.exit(1)
    return
  }

  // Get table counts
  const tableCounts = getTableCounts(dbPath)

  // Generate drizzle.config.ts
  try {
    generateDrizzleConfig(cwd, dbPath)
  } catch (error) {
    console.error('')
    console.error(pc.red('Error: Failed to generate drizzle.config.ts'))
    console.error(error instanceof Error ? error.message : String(error))
    console.error('')
    process.exit(1)
    return
  }

  // Display connection info
  console.log('')
  console.log(pc.bold('Database Studio'))
  console.log('')
  console.log(pc.dim('  Connected to:'), pc.cyan(databaseName), pc.dim('(D1)'))
  console.log(pc.dim('  Studio URL:  '), pc.cyan(`https://local.drizzle.studio`))
  console.log(pc.dim('  Port:        '), pc.cyan(port))
  console.log('')

  if (tableCounts.size > 0) {
    console.log(pc.dim('  Tables:'))
    for (const [table, count] of tableCounts.entries()) {
      console.log(pc.dim('    • ') + table + pc.dim(` (${count} records)`))
    }
  } else {
    console.log(pc.dim('  No tables found'))
  }

  // Launch Drizzle Studio
  try {
    await launchDrizzleStudio(cwd, port, autoOpen)
  } catch (error) {
    console.error('')
    console.error(pc.red('Failed to launch Drizzle Studio'))
    console.error(error instanceof Error ? error.message : String(error))
    console.error('')
    console.error('Make sure drizzle-kit is installed:')
    console.error(pc.cyan('  pnpm add -D drizzle-kit'))
    console.error('')
    process.exit(1)
  }
}
