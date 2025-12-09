/**
 * @module commands/migrate/generate
 * @description Generate migration files from schema changes
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { spawn } from 'child_process'
import {
  getMigrationsDir,
  ensureMigrationsDir,
  getNextMigrationId,
  toSnakeCase,
  isValidMigrationName,
  getDatabaseNameFromWrangler,
  escapeSqlString,
} from './utils'

/**
 * Represents a column in the database schema
 */
interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  primaryKey: boolean
}

/**
 * Represents a table in the database schema
 */
interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

/**
 * Schema change detected during generation
 */
interface SchemaChange {
  type: 'table_added' | 'table_removed' | 'column_added' | 'column_removed' | 'column_modified'
  table: string
  column?: string
  description: string
  upSql: string
  downSql: string
}

/**
 * Options for migration generation
 */
interface GenerateOptions {
  cwd?: string
  /** Path to schema definition file (JSON) */
  schema?: string
  /** Don't introspect database, just create placeholder */
  empty?: boolean
}

/**
 * Generate a new migration file
 *
 * If a schema file is provided, compares it against the current D1 schema
 * and generates migration SQL automatically.
 *
 * @param name The migration name (e.g., 'add_bio_to_users')
 * @param options Optional configuration
 */
export async function generateMigration(
  name: string,
  options: GenerateOptions = {}
): Promise<void> {
  const cwd = options.cwd || process.cwd()

  // Validate migration name
  if (!name || name.trim() === '') {
    console.error('Error: Migration name is required')
    console.error('')
    console.error('Usage: ix migrate:generate <name>')
    console.error('Example: ix migrate:generate add_bio_to_users')
    console.error('')
    console.error('Options:')
    console.error('  --schema <path>  Path to schema definition JSON file')
    console.error('  --empty          Create empty migration (skip schema detection)')
    process.exit(1)
    return
  }

  // Convert to snake_case and validate
  const migrationName = toSnakeCase(name)

  if (!isValidMigrationName(migrationName)) {
    console.error(`Error: Invalid migration name: ${migrationName}`)
    console.error(
      'Migration names must contain only alphanumeric characters, hyphens, and underscores'
    )
    process.exit(1)
    return
  }

  // Ensure migrations directory exists
  ensureMigrationsDir(cwd)
  const migrationsDir = getMigrationsDir(cwd)

  // Get next migration ID
  const migrationId = getNextMigrationId(migrationsDir)

  // Create migration filename
  const filename = `${migrationId}_${migrationName}.sql`
  const downFilename = `${migrationId}_${migrationName}.down.sql`

  const upPath = join(migrationsDir, filename)
  const downPath = join(migrationsDir, downFilename)

  let upMigration: string
  let downMigration: string
  let changes: SchemaChange[] = []

  // Try to detect schema changes if not --empty
  if (!options.empty) {
    const databaseName = getDatabaseNameFromWrangler(cwd)

    if (databaseName && options.schema) {
      // Schema file provided - compare against database
      try {
        changes = await detectSchemaChanges(cwd, databaseName, options.schema)
      } catch (error) {
        console.warn('Warning: Could not detect schema changes automatically')
        console.warn(error instanceof Error ? error.message : String(error))
        console.warn('Generating placeholder migration instead.')
        console.warn('')
      }
    } else if (databaseName) {
      // No schema file - try to introspect database and show current state
      try {
        const currentSchema = await introspectDatabase(cwd, databaseName)
        if (currentSchema.length > 0) {
          console.log('')
          console.log('Current database schema:')
          for (const table of currentSchema) {
            console.log(`  ${table.name}:`)
            for (const col of table.columns) {
              const pk = col.primaryKey ? ' [PK]' : ''
              const nullable = col.nullable ? '' : ' NOT NULL'
              const def = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : ''
              console.log(`    - ${col.name}: ${col.type}${nullable}${def}${pk}`)
            }
          }
          console.log('')
          console.log('Tip: Create a schema.json file to enable automatic change detection.')
          console.log('')
        }
      } catch {
        // Database not accessible, continue with placeholder
      }
    }
  }

  // Generate migration content
  if (changes.length > 0) {
    upMigration = generateMigrationFromChanges(migrationName, changes, 'up')
    downMigration = generateMigrationFromChanges(migrationName, changes, 'down')

    // Display detected changes
    console.log('')
    console.log('Detected changes:')
    for (const change of changes) {
      const symbol = change.type.includes('added')
        ? '+'
        : change.type.includes('removed')
          ? '-'
          : '~'
      console.log(`  ${symbol} ${change.description}`)
    }
    console.log('')
  } else {
    // Generate placeholder migrations
    upMigration = generatePlaceholderUpMigration(migrationName)
    downMigration = generatePlaceholderDownMigration(migrationName)
  }

  // Write migration files
  writeFileSync(upPath, upMigration, 'utf-8')
  writeFileSync(downPath, downMigration, 'utf-8')

  // Output success message
  console.log('')
  console.log(`Generated migration: migrations/${filename}`)
  console.log('')

  if (changes.length === 0) {
    console.log('Next steps:')
    console.log('  1. Edit the migration files to add your SQL statements')
    console.log('  2. Run: ix migrate (to apply migrations)')
    console.log('  3. Run: ix migrate:status (to check migration status)')
  } else {
    console.log('Next steps:')
    console.log('  1. Review the generated SQL in the migration files')
    console.log('  2. Run: ix migrate (to apply migrations)')
  }
  console.log('')
}

/**
 * Introspect the D1 database schema
 */
async function introspectDatabase(cwd: string, databaseName: string): Promise<TableInfo[]> {
  // Query sqlite_master for table information
  const tablesSql =
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != '_migrations'"

  const tablesResult = await executeSqlQuery(cwd, databaseName, tablesSql)

  const tables: TableInfo[] = []

  for (const row of tablesResult) {
    const tableName = row.name as string
    const columnsSql = `PRAGMA table_info(${escapeSqlString(tableName)})`

    try {
      const columnsResult = await executeSqlQuery(cwd, databaseName, columnsSql)

      const columns: ColumnInfo[] = columnsResult.map((col: Record<string, unknown>) => ({
        name: col.name as string,
        type: col.type as string,
        nullable: col.notnull === 0,
        defaultValue: col.dflt_value as string | null,
        primaryKey: col.pk === 1,
      }))

      tables.push({ name: tableName, columns })
    } catch {
      // Skip tables we can't introspect
    }
  }

  return tables
}

/**
 * Load schema definition from JSON file
 */
function loadSchemaFile(schemaPath: string): TableInfo[] {
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`)
  }

  const content = readFileSync(schemaPath, 'utf-8')
  const schema = JSON.parse(content)

  // Expected format:
  // {
  //   "tables": [
  //     {
  //       "name": "users",
  //       "columns": [
  //         { "name": "id", "type": "INTEGER PRIMARY KEY AUTOINCREMENT" },
  //         { "name": "email", "type": "TEXT NOT NULL UNIQUE" }
  //       ]
  //     }
  //   ]
  // }

  if (!schema.tables || !Array.isArray(schema.tables)) {
    throw new Error('Invalid schema file format. Expected { "tables": [...] }')
  }

  return schema.tables.map(
    (table: { name: string; columns: Array<{ name: string; type: string }> }) => ({
      name: table.name,
      columns: table.columns.map((col) => parseColumnType(col.name, col.type)),
    })
  )
}

/**
 * Parse a column type string into ColumnInfo
 */
function parseColumnType(name: string, typeStr: string): ColumnInfo {
  const upperType = typeStr.toUpperCase()

  return {
    name,
    type: extractBaseType(upperType),
    nullable: !upperType.includes('NOT NULL'),
    defaultValue: extractDefault(typeStr),
    primaryKey: upperType.includes('PRIMARY KEY'),
  }
}

/**
 * Extract base SQL type from full type string
 */
function extractBaseType(typeStr: string): string {
  // Remove constraints to get base type
  const match = typeStr.match(/^(INTEGER|TEXT|REAL|BLOB|NUMERIC)/i)
  return match ? match[1].toUpperCase() : 'TEXT'
}

/**
 * Extract default value from type string
 */
function extractDefault(typeStr: string): string | null {
  const match = typeStr.match(/DEFAULT\s+([^\s,]+)/i)
  return match ? match[1] : null
}

/**
 * Detect schema changes between current database and desired schema
 */
async function detectSchemaChanges(
  cwd: string,
  databaseName: string,
  schemaPath: string
): Promise<SchemaChange[]> {
  const currentSchema = await introspectDatabase(cwd, databaseName)
  const desiredSchema = loadSchemaFile(resolve(cwd, schemaPath))

  const changes: SchemaChange[] = []

  const currentTables = new Map(currentSchema.map((t) => [t.name, t]))
  const desiredTables = new Map(desiredSchema.map((t) => [t.name, t]))

  // Check for new tables
  for (const [tableName, desiredTable] of desiredTables) {
    if (!currentTables.has(tableName)) {
      const columnDefs = desiredTable.columns
        .map(
          (c) =>
            `"${c.name}" ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.defaultValue ? ` DEFAULT ${c.defaultValue}` : ''}`
        )
        .join(',\n  ')

      changes.push({
        type: 'table_added',
        table: tableName,
        description: `Added table: ${tableName}`,
        upSql: `CREATE TABLE "${tableName}" (\n  ${columnDefs}\n);`,
        downSql: `DROP TABLE "${tableName}";`,
      })
    }
  }

  // Check for removed tables
  for (const [tableName] of currentTables) {
    if (!desiredTables.has(tableName)) {
      const currentTable = currentTables.get(tableName)!
      const columnDefs = currentTable.columns
        .map(
          (c) =>
            `"${c.name}" ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.defaultValue ? ` DEFAULT ${c.defaultValue}` : ''}`
        )
        .join(',\n  ')

      changes.push({
        type: 'table_removed',
        table: tableName,
        description: `Removed table: ${tableName}`,
        upSql: `DROP TABLE "${tableName}";`,
        downSql: `CREATE TABLE "${tableName}" (\n  ${columnDefs}\n);`,
      })
    }
  }

  // Check for column changes in existing tables
  for (const [tableName, desiredTable] of desiredTables) {
    const currentTable = currentTables.get(tableName)
    if (!currentTable) continue

    const currentCols = new Map(currentTable.columns.map((c) => [c.name, c]))
    const desiredCols = new Map(desiredTable.columns.map((c) => [c.name, c]))

    // Check for new columns
    for (const [colName, desiredCol] of desiredCols) {
      if (!currentCols.has(colName)) {
        const colDef = `${desiredCol.type}${desiredCol.nullable ? '' : ' NOT NULL'}${desiredCol.defaultValue ? ` DEFAULT ${desiredCol.defaultValue}` : ''}`

        changes.push({
          type: 'column_added',
          table: tableName,
          column: colName,
          description: `Added column: ${tableName}.${colName} (${desiredCol.type.toLowerCase()}${desiredCol.nullable ? ', nullable' : ''})`,
          upSql: `ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${colDef};`,
          downSql: `ALTER TABLE "${tableName}" DROP COLUMN "${colName}";`,
        })
      }
    }

    // Check for removed columns
    for (const [colName, currentCol] of currentCols) {
      if (!desiredCols.has(colName)) {
        const colDef = `${currentCol.type}${currentCol.nullable ? '' : ' NOT NULL'}${currentCol.defaultValue ? ` DEFAULT ${currentCol.defaultValue}` : ''}`

        changes.push({
          type: 'column_removed',
          table: tableName,
          column: colName,
          description: `Removed column: ${tableName}.${colName}`,
          upSql: `ALTER TABLE "${tableName}" DROP COLUMN "${colName}";`,
          downSql: `ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${colDef};`,
        })
      }
    }
  }

  return changes
}

/**
 * Generate migration content from detected changes
 */
function generateMigrationFromChanges(
  name: string,
  changes: SchemaChange[],
  direction: 'up' | 'down'
): string {
  const timestamp = new Date().toISOString()
  const statements =
    direction === 'up'
      ? changes.map((c) => c.upSql)
      : changes
          .slice()
          .reverse()
          .map((c) => c.downSql) // Reverse order for down migration

  const header = direction === 'up' ? `-- Migration: ${name}` : `-- Migration Rollback: ${name}`

  return `${header}
-- Created: ${timestamp}
-- Auto-generated from schema changes

${statements.join('\n\n')}
`
}

/**
 * Generate placeholder up migration content
 */
function generatePlaceholderUpMigration(name: string): string {
  const timestamp = new Date().toISOString()
  return `-- Migration: ${name}
-- Created: ${timestamp}
-- Description: Add your migration description here

-- Add your SQL statements below:

-- Example:
-- ALTER TABLE users ADD COLUMN bio TEXT;
-- ALTER TABLE users ADD COLUMN avatar_url TEXT;
`
}

/**
 * Generate placeholder down migration content
 */
function generatePlaceholderDownMigration(name: string): string {
  const timestamp = new Date().toISOString()
  return `-- Migration Rollback: ${name}
-- Created: ${timestamp}
-- Description: Rollback changes from the up migration

-- Add your rollback SQL statements below:

-- Example (reverse order of up migration):
-- ALTER TABLE users DROP COLUMN avatar_url;
-- ALTER TABLE users DROP COLUMN bio;
`
}

/**
 * Execute SQL query against D1 database and return results
 */
async function executeSqlQuery(
  cwd: string,
  databaseName: string,
  sql: string
): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', databaseName, '--command', sql, '--json', '--local']

    const wrangler = spawn('wrangler', args, {
      cwd,
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
