/**
 * @module edge-record/crud/d1-adapter
 * @description D1Database adapter for CRUD operations with type conversion
 */

import type { FieldConfig } from '@/edge-record/schema/field'

/**
 * D1Adapter provides a clean interface to D1Database operations
 * Handles type conversions, parameterized queries, and batch operations
 */
export class D1Adapter {
  constructor(private db: D1Database) {}

  /**
   * Execute a write query (INSERT, UPDATE, DELETE)
   * @returns D1Result with changes and last_row_id
   */
  async run(sql: string, params: unknown[] = []): Promise<D1Result<unknown>> {
    const stmt = this.db.prepare(sql).bind(...params)
    return await stmt.run()
  }

  /**
   * Execute a SELECT query and return all rows
   * @returns Array of rows with type conversions applied
   */
  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql).bind(...params)
    const result = await stmt.all<T>()
    return result.results
  }

  /**
   * Execute a SELECT query and return first row
   * @returns Single row or null
   */
  async first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql).bind(...params)
    return await stmt.first<T>()
  }

  /**
   * Execute multiple statements in a single batch
   * @returns Array of results (one per statement)
   */
  async batch(statements: D1PreparedStatement[]): Promise<D1Result<unknown>[]> {
    return await this.db.batch(statements)
  }

  /**
   * Convert JavaScript value to D1-compatible value
   * @param value The JavaScript value
   * @param fieldType The field type from schema
   * @returns D1-compatible value
   */
  toD1Value(value: unknown, fieldType: string): unknown {
    if (value === null || value === undefined) {
      return null
    }

    switch (fieldType) {
      case 'boolean':
        return value ? 1 : 0

      case 'datetime':
        if (value instanceof Date) {
          return value.getTime()
        }
        // Already a timestamp
        return value

      case 'json':
        return JSON.stringify(value)

      case 'decimal':
      case 'integer':
      case 'string':
      case 'text':
      case 'enum':
      case 'id':
      default:
        return value
    }
  }

  /**
   * Convert D1 value to JavaScript value
   * @param value The D1 value
   * @param fieldConfig The field configuration
   * @returns JavaScript value
   */
  fromD1Value(value: unknown, fieldConfig: FieldConfig): unknown {
    if (value === null || value === undefined) {
      return fieldConfig.nullable ? null : undefined
    }

    switch (fieldConfig.type) {
      case 'boolean':
        return value === 1

      case 'datetime':
        // D1 stores as Unix ms, keep as number
        return value

      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value

      case 'decimal':
      case 'integer':
      case 'string':
      case 'text':
      case 'enum':
      case 'id':
      default:
        return value
    }
  }

  /**
   * Prepare multiple values for a batch operation
   * @param sql The SQL template
   * @param valuesList Array of value arrays
   * @returns Array of prepared statements
   */
  prepareBatch(sql: string, valuesList: unknown[][]): D1PreparedStatement[] {
    return valuesList.map((values) => this.db.prepare(sql).bind(...values))
  }
}
