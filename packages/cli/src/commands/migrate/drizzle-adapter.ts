/**
 * @module commands/migrate/drizzle-adapter
 * @description Convert EdgeRecord models to Drizzle schema and generate migrations using Drizzle Kit
 *
 * AC11: Migrations use Drizzle Kit internally for generation
 */

import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import type { ExtractedModel, ExtractedColumn } from './model-loader'


/**
 * Drizzle schema snapshot structure (simplified)
 */
interface DrizzleSnapshot {
  version: string
  dialect: 'sqlite'
  tables: Record<string, DrizzleTable>
  enums: Record<string, never>
  _meta: {
    tables: Record<string, never>
    columns: Record<string, never>
  }
}

interface DrizzleTable {
  name: string
  columns: Record<string, DrizzleColumn>
  indexes: Record<string, never>
  foreignKeys: Record<string, DrizzleForeignKey>
  compositePrimaryKeys: Record<string, never>
  uniqueConstraints: Record<string, DrizzleUniqueConstraint>
}

interface DrizzleColumn {
  name: string
  type: string
  primaryKey: boolean
  notNull: boolean
  autoincrement: boolean
  default?: string
}

interface DrizzleForeignKey {
  name: string
  tableFrom: string
  tableTo: string
  columnsFrom: string[]
  columnsTo: string[]
  onDelete?: string
  onUpdate?: string
}

interface DrizzleUniqueConstraint {
  name: string
  columns: string[]
}

/**
 * Convert extracted EdgeRecord models to Drizzle-compatible snapshot
 * This is used internally by Drizzle Kit for migration generation
 */
export function modelsToDrizzleSnapshot(
  models: ExtractedModel[],
  _snapshotId?: string
): DrizzleSnapshot {
  const tables: Record<string, DrizzleTable> = {}

  for (const model of models) {
    const columns: Record<string, DrizzleColumn> = {}
    const foreignKeys: Record<string, DrizzleForeignKey> = {}
    const uniqueConstraints: Record<string, DrizzleUniqueConstraint> = {}

    for (const col of model.columns) {
      columns[col.name] = {
        name: col.name,
        type: mapToDrizzleType(col),
        primaryKey: col.primaryKey,
        notNull: !col.nullable && !col.primaryKey,
        autoincrement: col.autoIncrement,
        default: col.defaultValue,
      }

      // Add unique constraint
      if (col.unique && !col.primaryKey) {
        const constraintName = `${model.tableName}_${col.name}_unique`
        uniqueConstraints[constraintName] = {
          name: constraintName,
          columns: [col.name],
        }
      }

      // Add foreign key
      if (col.references) {
        const fkName = `${model.tableName}_${col.name}_fk`
        foreignKeys[fkName] = {
          name: fkName,
          tableFrom: model.tableName,
          tableTo: col.references.table,
          columnsFrom: [col.name],
          columnsTo: [col.references.column],
          onDelete: 'no action',
          onUpdate: 'no action',
        }
      }
    }

    tables[model.tableName] = {
      name: model.tableName,
      columns,
      indexes: {},
      foreignKeys,
      compositePrimaryKeys: {},
      uniqueConstraints,
    }
  }

  return {
    version: '6',
    dialect: 'sqlite',
    tables,
    enums: {},
    _meta: {
      tables: {},
      columns: {},
    },
  }
}

/**
 * Map EdgeRecord column to Drizzle type string
 */
function mapToDrizzleType(col: ExtractedColumn): string {
  // Drizzle uses specific type strings
  switch (col.baseType) {
    case 'id':
      return 'integer'
    case 'string':
    case 'text':
    case 'json':
    case 'enum':
      return 'text'
    case 'integer':
    case 'boolean':
    case 'datetime':
      return 'integer'
    case 'decimal':
      return 'real'
    default:
      return 'text'
  }
}

/**
 * Generate Drizzle schema TypeScript file from extracted models
 * This creates a temporary schema file that Drizzle Kit can process
 */
export function generateDrizzleSchemaFile(models: ExtractedModel[]): string {
  const imports = `import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';\n\n`

  const tableDefinitions = models.map((model) => {
    const columns = model.columns.map((col) => {
      const def = `  ${col.name}: ${getDrizzleColumnDef(col)}`
      return def
    })

    return `export const ${toCamelCase(model.tableName)} = sqliteTable('${model.tableName}', {\n${columns.join(',\n')}\n});`
  })

  return imports + tableDefinitions.join('\n\n')
}

/**
 * Get Drizzle column definition string
 */
function getDrizzleColumnDef(col: ExtractedColumn): string {
  let def = ''

  // Base type
  switch (col.baseType) {
    case 'id':
      def = `integer('${col.name}').primaryKey({ autoIncrement: true })`
      break
    case 'string':
    case 'text':
    case 'json':
    case 'enum':
      def = `text('${col.name}')`
      break
    case 'integer':
    case 'boolean':
    case 'datetime':
      def = `integer('${col.name}')`
      break
    case 'decimal':
      def = `real('${col.name}')`
      break
    default:
      def = `text('${col.name}')`
  }

  // Modifiers (skip for id which already has primaryKey)
  if (col.baseType !== 'id') {
    if (!col.nullable) {
      def += '.notNull()'
    }
    if (col.unique) {
      def += '.unique()'
    }
    if (col.defaultValue !== undefined) {
      if (typeof col.defaultValue === 'string' && !col.defaultValue.match(/^\d+$/)) {
        def += `.default('${col.defaultValue}')`
      } else {
        def += `.default(${col.defaultValue})`
      }
    }
  }

  return def
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Generate migration using Drizzle Kit CLI
 * This is the AC11 requirement - using Drizzle Kit internally
 *
 * @param models The extracted EdgeRecord models
 * @param migrationName The migration name
 * @param cwd Current working directory
 * @returns Generated SQL statements { up: string, down: string }
 */
export async function generateMigrationWithDrizzle(
  models: ExtractedModel[],
  migrationName: string,
  cwd: string
): Promise<{ up: string; down: string } | null> {
  // Create temporary directory for drizzle config and schema
  const tempDir = join(cwd, '.ixflare-migrate-temp')

  try {
    // Clean and create temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir, { recursive: true })
    mkdirSync(join(tempDir, 'drizzle'), { recursive: true })

    // Generate and write schema file
    const schemaContent = generateDrizzleSchemaFile(models)
    const schemaPath = join(tempDir, 'schema.ts')
    writeFileSync(schemaPath, schemaContent, 'utf-8')

    // Generate drizzle config
    const configContent = `
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
`
    writeFileSync(join(tempDir, 'drizzle.config.ts'), configContent, 'utf-8')

    // Run drizzle-kit generate
    const result = await runDrizzleKitGenerate(tempDir)

    if (!result.success) {
      console.warn('Drizzle Kit generation failed, falling back to direct schema comparison')
      return null
    }

    // Read generated migration files
    const migrationFiles = readdirSync(join(tempDir, 'drizzle'))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    if (migrationFiles.length === 0) {
      return null
    }

    // Read the latest migration
    const latestMigration = migrationFiles[migrationFiles.length - 1]
    const upSql = readFileSync(join(tempDir, 'drizzle', latestMigration), 'utf-8')

    // Generate down migration (reverse the statements)
    const downSql = generateDownMigration(upSql)

    return { up: upSql, down: downSql }
  } finally {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

/**
 * Run drizzle-kit generate command
 */
async function runDrizzleKitGenerate(cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['drizzle-kit', 'generate'], {
      cwd,
      stdio: 'pipe',
      shell: true,
    })

    let output = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', () => {
      resolve({ success: false, output: stderr })
    })

    proc.on('close', (code) => {
      resolve({ success: code === 0, output: output || stderr })
    })
  })
}

/**
 * Generate down migration from up migration SQL
 * Parses CREATE TABLE and ALTER TABLE statements and generates reverse operations
 */
function generateDownMigration(upSql: string): string {
  const lines = upSql.split('\n')
  const downStatements: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // CREATE TABLE -> DROP TABLE
    const createTableMatch = trimmed.match(/^CREATE TABLE\s+["`]?(\w+)["`]?/i)
    if (createTableMatch) {
      downStatements.unshift(`DROP TABLE "${createTableMatch[1]}";`)
      continue
    }

    // ALTER TABLE ... ADD COLUMN -> ALTER TABLE ... DROP COLUMN
    const addColumnMatch = trimmed.match(
      /^ALTER TABLE\s+["`]?(\w+)["`]?\s+ADD\s+COLUMN\s+["`]?(\w+)["`]?/i
    )
    if (addColumnMatch) {
      downStatements.unshift(
        `ALTER TABLE "${addColumnMatch[1]}" DROP COLUMN "${addColumnMatch[2]}";`
      )
      continue
    }

    // CREATE INDEX -> DROP INDEX
    const createIndexMatch = trimmed.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+["`]?(\w+)["`]?/i)
    if (createIndexMatch) {
      downStatements.unshift(`DROP INDEX "${createIndexMatch[1]}";`)
      continue
    }
  }

  if (downStatements.length === 0) {
    return '-- No reversible statements detected\n-- Add manual rollback SQL here'
  }

  return downStatements.join('\n')
}

/**
 * Import function for readdirSync (was missing)
 */
import { readdirSync } from 'fs'
