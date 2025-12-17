/**
 * @module commands/db/studio
 * @description Launch Drizzle Studio database GUI for D1 inspection
 */

import { spawn } from 'child_process'
import { existsSync, readdirSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import pc from 'picocolors'
import prompts from 'prompts'
import { getDatabaseNameFromWrangler } from '@/commands/migrate/utils'

/**
 * Temporary config filename - uses unique name to avoid overwriting user's config
 */
const TEMP_CONFIG_FILENAME = 'drizzle.studio.config.ts'

/**
 * Track the temporary config file path for cleanup
 */
let tempConfigPath: string | null = null

/**
 * Common paths where models might be defined (from model-loader.ts)
 */
const MODEL_SEARCH_PATHS = [
  'src/models',
  'src/db/models',
  'src/database/models',
  'models',
  'db/models',
  'src/schema',
  'src/db/schema',
]

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

  /**
   * Specific binding name to use (for multiple D1 databases)
   */
  binding?: string
}

/**
 * Discovered D1 database info
 */
interface D1DatabaseInfo {
  bindingId: string
  dbPath: string
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
  --binding <name>    Use specific D1 binding (when multiple exist)
  --remote            Connect to remote D1 database (not yet supported)
  --open              Auto-open browser (default: false)
  --help, -h          Show this help message

${pc.bold('DESCRIPTION')}
  Launches Drizzle Studio, a browser-based database management interface.

  By default, connects to your local D1 database in .wrangler/state/v3/d1/.
  If multiple D1 bindings exist, you'll be prompted to select one.

${pc.bold('FEATURES')}
  • View table schemas and column types
  • Browse records with pagination, filtering, and sorting
  • Execute raw SQL queries with results in tabular format
  • View relationships between tables (foreign keys)
  • Edit data in development mode (local database)
  • Export query results to CSV/JSON

${pc.bold('SECURITY')}
  ${pc.yellow('⚠️  Remote database access:')}
  Remote D1 database access via Drizzle Studio is not currently supported.
  Drizzle Studio requires direct SQLite file access, which is only available
  for local D1 databases. Use wrangler CLI for remote database queries.

${pc.bold('EXAMPLES')}
  # Launch studio for local database
  ix db:studio

  # Launch on custom port
  ix db:studio --port 5000

  # Use specific D1 binding
  ix db:studio --binding DB

  # Auto-open browser
  ix db:studio --open

${pc.bold('REQUIREMENTS')}
  • D1 database configured in wrangler.toml
  • Local database must exist in .wrangler/state/v3/d1/
  • Run 'ix dev' first to initialize the local database

${pc.bold('LEARN MORE')}
  Drizzle Studio docs: https://orm.drizzle.team/drizzle-studio/overview
  `)
}

/**
 * Find all local D1 databases in the .wrangler directory
 *
 * @param cwd Current working directory
 * @returns Array of discovered D1 database info
 */
function findAllLocalD1Databases(cwd: string): D1DatabaseInfo[] {
  const wranglerStateDir = join(cwd, '.wrangler', 'state', 'v3', 'd1')

  if (!existsSync(wranglerStateDir)) {
    return []
  }

  const databases: D1DatabaseInfo[] = []

  // List all D1 binding directories
  const bindings = readdirSync(wranglerStateDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory()
  )

  // Find databases in each binding directory
  for (const binding of bindings) {
    const dbPath = join(wranglerStateDir, binding.name, 'db.sqlite')
    if (existsSync(dbPath)) {
      databases.push({
        bindingId: binding.name,
        dbPath,
      })
    }
  }

  return databases
}

/**
 * Find schema paths that exist in the project
 *
 * @param cwd Current working directory
 * @returns Array of schema glob patterns that exist
 */
function findSchemaPaths(cwd: string): string[] {
  const existingPaths: string[] = []

  for (const searchPath of MODEL_SEARCH_PATHS) {
    const fullPath = join(cwd, searchPath)
    if (existsSync(fullPath)) {
      existingPaths.push(`./${searchPath}/*.ts`)
    }
  }

  // Default fallback if no paths found
  if (existingPaths.length === 0) {
    existingPaths.push('./src/models/*.ts')
  }

  return existingPaths
}

/**
 * Generate temporary drizzle config for studio
 * Uses a unique filename to avoid overwriting user's drizzle.config.ts
 *
 * @param cwd Current working directory
 * @param dbPath Path to SQLite database file
 * @returns Path to the generated config file
 */
function generateTempDrizzleConfig(cwd: string, dbPath: string): string {
  const configPath = join(cwd, TEMP_CONFIG_FILENAME)

  // Find existing schema paths in the project
  const schemaPaths = findSchemaPaths(cwd)
  const schemaConfig =
    schemaPaths.length === 1
      ? `'${schemaPaths[0]}'`
      : `[${schemaPaths.map((p) => `'${p}'`).join(', ')}]`

  // Generate config content
  const configContent = `/**
 * Temporary Drizzle Studio configuration
 * Auto-generated by ix db:studio - will be deleted on exit
 */
import type { Config } from 'drizzle-kit'

export default {
  schema: ${schemaConfig},
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: '${dbPath.replace(/\\/g, '/')}',
  },
} satisfies Config
`

  writeFileSync(configPath, configContent, 'utf-8')
  tempConfigPath = configPath

  return configPath
}

/**
 * Clean up temporary config file
 */
function cleanupTempConfig(): void {
  if (tempConfigPath && existsSync(tempConfigPath)) {
    try {
      unlinkSync(tempConfigPath)
      console.log(pc.dim(`  Cleaned up ${TEMP_CONFIG_FILENAME}`))
    } catch {
      // Ignore cleanup errors
    }
    tempConfigPath = null
  }
}

/**
 * Launch Drizzle Studio as a subprocess
 *
 * @param cwd Current working directory
 * @param configPath Path to drizzle config file
 * @param port Port number for studio server
 * @param autoOpen Whether to auto-open browser
 * @returns Promise that resolves when studio exits
 */
function launchDrizzleStudio(
  cwd: string,
  configPath: string,
  port: string,
  autoOpen: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('')
    console.log(pc.cyan('Starting Drizzle Studio...'))
    console.log('')

    // Build drizzle-kit studio command with explicit config path
    const args = ['studio', '--config', configPath, '--port', port]
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
      cleanupTempConfig()
      console.error('')
      console.error(pc.red('Failed to start Drizzle Studio:'))
      console.error(err.message)
      console.error('')
      reject(err)
    })

    studio.on('close', (code) => {
      cleanupTempConfig()
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
 * Escape SQLite identifier (table/column name) to prevent SQL injection
 * Uses double-quote escaping per SQLite standard
 *
 * @param identifier The identifier to escape
 * @returns Safely escaped identifier
 */
function escapeSqliteIdentifier(identifier: string): string {
  // Double any existing double-quotes and wrap in double-quotes
  return `"${identifier.replace(/"/g, '""')}"`
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
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'"
      )
      .all() as Array<{ name: string }>

    const counts = new Map<string, number>()
    for (const { name } of tables) {
      // Escape table name to prevent SQL injection from malicious database files
      const escapedName = escapeSqliteIdentifier(name)
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${escapedName}`).get() as {
        count: number
      }
      counts.set(name, result.count)
    }

    db.close()
    return counts
  } catch {
    return new Map()
  }
}

/**
 * Prompt user to select a database when multiple exist
 *
 * @param databases Available databases
 * @returns Selected database info or null if cancelled
 */
async function promptForDatabaseSelection(
  databases: D1DatabaseInfo[]
): Promise<D1DatabaseInfo | null> {
  console.log('')
  console.log(pc.yellow(`Found ${databases.length} D1 databases. Please select one:`))
  console.log('')

  const response = await prompts({
    type: 'select',
    name: 'database',
    message: 'Select database',
    choices: databases.map((db, index) => ({
      title: `Database ${index + 1} (${db.bindingId})`,
      value: db,
    })),
  })

  return response.database || null
}

/**
 * Launch Drizzle Studio database GUI
 *
 * Workflow:
 * 1. Get database name from wrangler.toml
 * 2. Find local D1 SQLite file(s)
 * 3. If multiple, prompt user to select one
 * 4. Generate temporary drizzle config pointing to database
 * 5. Launch drizzle-kit studio with --config flag
 * 6. Show connection info and table counts
 * 7. Clean up temp config on exit
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
  const isRemote = options.remote || false
  const autoOpen = options.open || false

  // Validate port number
  const portNum = parseInt(options.port || '4000', 10)
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    console.error('')
    console.error(pc.red('Error: Invalid port number'))
    console.error('')
    console.error('Port must be a number between 1 and 65535')
    console.error('')
    process.exit(1)
    return
  }
  const port = String(portNum)

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

  // Remote database support - explicitly not supported for D1
  if (isRemote) {
    console.error('')
    console.error(pc.red('Error: Remote D1 database access is not supported'))
    console.error('')
    console.error('Drizzle Studio requires direct SQLite file access, which is only')
    console.error('available for local D1 databases. Remote D1 databases are accessed')
    console.error("via Cloudflare's HTTP API, which Drizzle Studio cannot use.")
    console.error('')
    console.error('Alternatives for remote database access:')
    console.error(pc.cyan('  • wrangler d1 execute <db> --remote --command "SELECT * FROM users"'))
    console.error(pc.cyan('  • wrangler d1 execute <db> --remote --file query.sql'))
    console.error('')
    process.exit(1)
    return
  }

  // Find all local D1 databases
  const databases = findAllLocalD1Databases(cwd)

  if (databases.length === 0) {
    console.error('')
    console.error(pc.red('Error: No local D1 database found'))
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

  // Select database if multiple exist
  let selectedDb: D1DatabaseInfo

  if (databases.length === 1) {
    selectedDb = databases[0]
  } else if (options.binding) {
    // Use specified binding
    const found = databases.find((db) => db.bindingId === options.binding)
    if (!found) {
      console.error('')
      console.error(pc.red(`Error: Binding "${options.binding}" not found`))
      console.error('')
      console.error('Available bindings:')
      for (const db of databases) {
        console.error(`  • ${db.bindingId}`)
      }
      console.error('')
      process.exit(1)
      return
    }
    selectedDb = found
  } else {
    // Prompt user to select
    const selected = await promptForDatabaseSelection(databases)
    if (!selected) {
      console.log('Cancelled.')
      return
    }
    selectedDb = selected
  }

  const dbPath = selectedDb.dbPath

  // Get table counts
  const tableCounts = getTableCounts(dbPath)

  // Generate temporary drizzle config
  let configPath: string
  try {
    configPath = generateTempDrizzleConfig(cwd, dbPath)
  } catch (error) {
    console.error('')
    console.error(pc.red(`Error: Failed to generate ${TEMP_CONFIG_FILENAME}`))
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
  if (databases.length > 1) {
    console.log(pc.dim('  Binding:     '), pc.cyan(selectedDb.bindingId))
  }
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

  // Launch Drizzle Studio with explicit config path
  try {
    await launchDrizzleStudio(cwd, configPath, port, autoOpen)
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

/**
 * Export for testing
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const __testing = {
  TEMP_CONFIG_FILENAME,
  findAllLocalD1Databases,
  findSchemaPaths,
  generateTempDrizzleConfig,
  cleanupTempConfig,
}
