/**
 * @module commands/migrate/model-loader
 * @description Load EdgeRecord models from user's project for migration generation
 *
 * LIMITATIONS:
 * This module uses regex-based parsing for simplicity (no AST dependency).
 * It handles common EdgeRecord patterns but may fail on:
 * - Complex TypeScript syntax (conditional types, generics in field definitions)
 * - Multi-line field definitions with unusual formatting
 * - Comments embedded within model definitions
 * - Dynamic/computed property names
 *
 * For complex models that fail to parse, the CLI will fall back to
 * generating placeholder migrations that users can manually edit.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Common paths where models might be defined
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
 * Model schema extracted from EdgeRecord model
 */
export interface ExtractedModel {
  tableName: string
  columns: ExtractedColumn[]
}

/**
 * Column information extracted from EdgeRecord field
 */
export interface ExtractedColumn {
  name: string
  type: string // SQLite type
  baseType: string // EdgeRecord type (id, string, integer, etc.)
  nullable: boolean
  unique: boolean
  primaryKey: boolean
  autoIncrement: boolean
  defaultValue?: string
  references?: {
    table: string
    column: string
  }
}

/**
 * Find model files in the user's project
 * @param cwd Current working directory
 * @returns Array of model file paths
 */
export function findModelFiles(cwd: string): string[] {
  const modelFiles: string[] = []

  for (const searchPath of MODEL_SEARCH_PATHS) {
    const fullPath = join(cwd, searchPath)
    if (existsSync(fullPath)) {
      const files = findTypeScriptFiles(fullPath)
      modelFiles.push(...files)
    }
  }

  // Also check for a models index file
  const indexPaths = [
    join(cwd, 'src/models/index.ts'),
    join(cwd, 'src/db/models/index.ts'),
    join(cwd, 'models/index.ts'),
  ]

  for (const indexPath of indexPaths) {
    if (existsSync(indexPath) && !modelFiles.includes(indexPath)) {
      modelFiles.push(indexPath)
    }
  }

  return modelFiles
}

/**
 * Recursively find TypeScript files
 */
function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        files.push(...findTypeScriptFiles(fullPath))
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        // Skip test files and type definition files
        if (
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.') &&
          !entry.name.endsWith('.d.ts')
        ) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // Directory not readable
  }

  return files
}

/**
 * Result of model extraction including any warnings
 */
export interface ModelExtractionResult {
  models: ExtractedModel[]
  warnings: string[]
}

/**
 * Extract model definitions from source files using static analysis
 * This parses the TypeScript source code without executing it
 * @param files Array of file paths to analyze
 * @returns Array of extracted models
 */
export function extractModelsFromFiles(files: string[]): ExtractedModel[] {
  const result = extractModelsFromFilesWithWarnings(files)

  // Log warnings to help users understand parsing limitations
  for (const warning of result.warnings) {
    console.warn(`  ⚠ ${warning}`)
  }

  return result.models
}

/**
 * Extract models with detailed warnings for troubleshooting
 * @param files Array of file paths to analyze
 * @returns Models and any parsing warnings
 */
export function extractModelsFromFilesWithWarnings(files: string[]): ModelExtractionResult {
  const models: ExtractedModel[] = []
  const warnings: string[] = []

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')

      // Check if file likely contains models but we couldn't parse them
      const hasDefineModel = content.includes('defineModel')
      const fileModels = parseDefineModelCalls(content)

      if (hasDefineModel && fileModels.length === 0) {
        warnings.push(
          `Found defineModel in ${file} but couldn't parse it. Complex syntax may require manual migration.`
        )
      }

      models.push(...fileModels)
    } catch (error) {
      warnings.push(
        `Could not read ${file}: ${error instanceof Error ? error.message : 'unknown error'}`
      )
    }
  }

  return { models, warnings }
}

/**
 * Parse defineModel calls from TypeScript source code
 * Uses regex-based parsing for simplicity (no AST dependency)
 */
function parseDefineModelCalls(content: string): ExtractedModel[] {
  const models: ExtractedModel[] = []

  // Match defineModel('tableName', { ... })
  // This regex captures the table name and schema object
  const defineModelRegex =
    /defineModel\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs

  let match
  while ((match = defineModelRegex.exec(content)) !== null) {
    const tableName = match[1]
    const schemaContent = match[2]

    const columns = parseSchemaFields(schemaContent)
    if (columns.length > 0) {
      models.push({ tableName, columns })
    }
  }

  return models
}

/**
 * Parse field definitions from schema object content
 */
function parseSchemaFields(schemaContent: string): ExtractedColumn[] {
  const columns: ExtractedColumn[] = []

  // Match field definitions like: fieldName: field.type().modifiers()
  const fieldRegex = /(\w+)\s*:\s*field\.(\w+)\s*\(([^)]*)\)([^,\n]*)/g

  let match
  while ((match = fieldRegex.exec(schemaContent)) !== null) {
    const fieldName = match[1]
    const fieldType = match[2]
    const fieldArgs = match[3]
    const modifiers = match[4]

    // Skip spread operators (like ...timestamps())
    if (fieldName === '...') continue

    const column = parseFieldDefinition(fieldName, fieldType, fieldArgs, modifiers)
    columns.push(column)
  }

  // Also check for spread timestamps()
  if (schemaContent.includes('...timestamps()')) {
    columns.push({
      name: 'createdAt',
      type: 'INTEGER',
      baseType: 'datetime',
      nullable: false,
      unique: false,
      primaryKey: false,
      autoIncrement: false,
    })
    columns.push({
      name: 'updatedAt',
      type: 'INTEGER',
      baseType: 'datetime',
      nullable: false,
      unique: false,
      primaryKey: false,
      autoIncrement: false,
    })
  }

  return columns
}

/**
 * Parse a single field definition into ExtractedColumn
 */
function parseFieldDefinition(
  name: string,
  type: string,
  args: string,
  modifiers: string
): ExtractedColumn {
  // Map EdgeRecord types to SQLite types
  const typeMapping: Record<
    string,
    { sqlType: string; primaryKey: boolean; autoIncrement: boolean }
  > = {
    id: { sqlType: 'INTEGER PRIMARY KEY AUTOINCREMENT', primaryKey: true, autoIncrement: true },
    string: { sqlType: 'TEXT', primaryKey: false, autoIncrement: false },
    text: { sqlType: 'TEXT', primaryKey: false, autoIncrement: false },
    integer: { sqlType: 'INTEGER', primaryKey: false, autoIncrement: false },
    decimal: { sqlType: 'REAL', primaryKey: false, autoIncrement: false },
    boolean: { sqlType: 'INTEGER', primaryKey: false, autoIncrement: false },
    datetime: { sqlType: 'INTEGER', primaryKey: false, autoIncrement: false },
    json: { sqlType: 'TEXT', primaryKey: false, autoIncrement: false },
    enum: { sqlType: 'TEXT', primaryKey: false, autoIncrement: false },
  }

  const typeInfo = typeMapping[type] || { sqlType: 'TEXT', primaryKey: false, autoIncrement: false }

  const column: ExtractedColumn = {
    name,
    type: typeInfo.sqlType,
    baseType: type,
    nullable: modifiers.includes('.nullable()'),
    unique: modifiers.includes('.unique()'),
    primaryKey: typeInfo.primaryKey || modifiers.includes('.primaryKey()'),
    autoIncrement: typeInfo.autoIncrement,
  }

  // Parse default value
  const defaultMatch = modifiers.match(/\.default\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/)
  if (defaultMatch) {
    column.defaultValue = defaultMatch[2]
  }

  // Parse references
  const refMatch = modifiers.match(/\.references\s*\(\s*(\w+)/)
  if (refMatch) {
    column.references = {
      table: refMatch[1].toLowerCase(), // Model name, will need mapping
      column: 'id',
    }
  }

  return column
}

/**
 * Convert extracted models to SQL CREATE TABLE statements
 */
export function modelsToSQL(models: ExtractedModel[]): Map<string, string> {
  const sqlStatements = new Map<string, string>()

  for (const model of models) {
    const columns = model.columns.map((col) => {
      let def = `"${col.name}" ${col.type}`

      // For non-id fields, add NOT NULL if not nullable
      if (!col.primaryKey && !col.nullable) {
        def += ' NOT NULL'
      }

      // Add UNIQUE constraint
      if (col.unique && !col.primaryKey) {
        def += ' UNIQUE'
      }

      // Add DEFAULT value
      if (col.defaultValue !== undefined) {
        if (typeof col.defaultValue === 'string' && !col.defaultValue.match(/^\d+$/)) {
          def += ` DEFAULT '${col.defaultValue}'`
        } else {
          def += ` DEFAULT ${col.defaultValue}`
        }
      }

      return def
    })

    // Add foreign key constraints
    const foreignKeys = model.columns
      .filter((col) => col.references)
      .map(
        (col) =>
          `FOREIGN KEY ("${col.name}") REFERENCES "${col.references!.table}"("${col.references!.column}")`
      )

    const allDefs = [...columns, ...foreignKeys]

    const sql = `CREATE TABLE "${model.tableName}" (\n  ${allDefs.join(',\n  ')}\n)`
    sqlStatements.set(model.tableName, sql)
  }

  return sqlStatements
}
