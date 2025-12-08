/**
 * @module edge-record/schema/type-mapping
 * @description D1/SQLite type mapping and SQL generation
 */

import type { FieldBuilder } from './field'
import type { Model, SchemaDefinition } from './types'

/**
 * Map EdgeRecord field type to SQLite column type
 * Reference: https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/
 *
 * Type mappings:
 * - id → INTEGER PRIMARY KEY AUTOINCREMENT
 * - string → TEXT
 * - text → TEXT
 * - integer → INTEGER
 * - decimal → REAL
 * - boolean → INTEGER (0/1)
 * - datetime → INTEGER (Unix timestamp ms)
 * - json → TEXT (JSON string)
 * - enum → TEXT
 */
export function toSQLType(fieldName: string, builder: FieldBuilder<unknown>): string {
  const { config } = builder
  const parts: string[] = []

  // Base type mapping
  switch (config.type) {
    case 'id':
      return 'INTEGER PRIMARY KEY AUTOINCREMENT'
    case 'string':
    case 'text':
    case 'enum':
    case 'json':
      parts.push('TEXT')
      break
    case 'integer':
    case 'boolean':
    case 'datetime':
      parts.push('INTEGER')
      break
    case 'decimal':
      parts.push('REAL')
      break
    default:
      parts.push('TEXT') // Fallback
  }

  // Add NOT NULL (unless nullable or primary key)
  // Note: 'id' type returns early above, so config.type is never 'id' here
  if (!config.nullable) {
    parts.push('NOT NULL')
  }

  // Add UNIQUE constraint
  if (config.unique) {
    parts.push('UNIQUE')
  }

  // Add DEFAULT value (only for static values, not functions)
  if (config.default !== undefined && typeof config.default !== 'function') {
    const defaultValue = config.default
    if (typeof defaultValue === 'string') {
      parts.push(`DEFAULT '${defaultValue}'`)
    } else if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
      parts.push(`DEFAULT ${defaultValue}`)
    }
  }

  return parts.join(' ')
}

/**
 * Generate CREATE TABLE SQL statement from model definition
 *
 * @param model The model to generate SQL for
 * @returns CREATE TABLE SQL statement
 *
 * @example
 * ```typescript
 * const User = defineModel('users', {
 *   id: field.id(),
 *   email: field.string().unique(),
 *   name: field.string(),
 * })
 *
 * const sql = toSQLSchema(User)
 * // CREATE TABLE users (
 * //   id INTEGER PRIMARY KEY AUTOINCREMENT,
 * //   email TEXT NOT NULL UNIQUE,
 * //   name TEXT NOT NULL
 * // )
 * ```
 */
export function toSQLSchema(model: Model<SchemaDefinition>): string {
  const { $tableName, $schema } = model
  const columns: string[] = []

  // Generate column definitions
  for (const [fieldName, builder] of Object.entries($schema)) {
    const sqlType = toSQLType(fieldName, builder)
    columns.push(`  ${fieldName} ${sqlType}`)
  }

  // Build CREATE TABLE statement
  const sql = `CREATE TABLE ${$tableName} (\n${columns.join(',\n')}\n)`

  return sql
}

/**
 * Get column type metadata for a field
 * Useful for migration generation and schema introspection
 */
export function getColumnMetadata(fieldName: string, builder: FieldBuilder<unknown>) {
  const { config } = builder

  return {
    fieldName,
    sqlType: toSQLType(fieldName, builder),
    baseType: config.type,
    nullable: config.nullable,
    unique: config.unique ?? false,
    primaryKey: config.primaryKey ?? false,
    autoIncrement: config.autoIncrement ?? false,
    hasDefault: config.default !== undefined,
    defaultValue: typeof config.default !== 'function' ? config.default : undefined,
  }
}
