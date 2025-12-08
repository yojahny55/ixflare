/**
 * @module edge-record/query-builder
 * @description Type-safe query builder with CRUD operations
 */

import type { SchemaDefinition, InferSchema, Model } from './schema/types'
import { ModelInstance } from './crud/model-instance'
import { toSnakeCase } from './crud/case-transform'
import { escapeIdentifier } from './schema/type-mapping'

export type WhereCondition = { field: string; operator: string; value: unknown }

export class QueryBuilder<T extends SchemaDefinition> {
  private conditions: WhereCondition[] = []
  private orderByField?: string
  private orderDirection: 'asc' | 'desc' = 'asc'
  private limitValue?: number
  private offsetValue?: number

  constructor(private model: Model<T>) {}

  /**
   * Add WHERE conditions
   * Supports both object notation and field/value pairs
   */
  where(conditions: Partial<InferSchema<T>>): this
  where(field: keyof InferSchema<T>, value: unknown): this
  where(fieldOrConditions: keyof InferSchema<T> | Partial<InferSchema<T>>, value?: unknown): this {
    if (typeof fieldOrConditions === 'object') {
      // Object notation: { email: 'test@example.com', role: 'admin' }
      for (const [field, val] of Object.entries(fieldOrConditions)) {
        this.conditions.push({ field, operator: '=', value: val })
      }
    } else {
      // Field/value notation: where('email', 'test@example.com')
      this.conditions.push({ field: String(fieldOrConditions), operator: '=', value })
    }
    return this
  }

  orderBy(field: keyof InferSchema<T>, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByField = String(field)
    this.orderDirection = direction
    return this
  }

  limit(value: number): this {
    this.limitValue = value
    return this
  }

  offset(value: number): this {
    this.offsetValue = value
    return this
  }

  /**
   * Execute query and return all matching records as ModelInstances
   */
  async all(db: D1Database): Promise<ModelInstance<T>[]> {
    const { query, params } = this.toSQL()
    const stmt = db.prepare(query).bind(...params)
    const result = await stmt.all<Record<string, unknown>>()

    return result.results.map(
      (row) => new ModelInstance(this.model, row as Partial<InferSchema<T>>, false)
    )
  }

  /**
   * Execute query and return first matching record or null
   */
  async first(db: D1Database): Promise<ModelInstance<T> | null> {
    this.limitValue = 1
    const { query, params } = this.toSQL()
    const stmt = db.prepare(query).bind(...params)
    const row = await stmt.first<Record<string, unknown>>()

    if (!row) {
      return null
    }

    return new ModelInstance(this.model, row as Partial<InferSchema<T>>, false)
  }

  /**
   * Bulk update matching records
   * @returns Number of updated rows
   */
  async update(data: Partial<InferSchema<T>>, db: D1Database): Promise<number> {
    // Add updatedAt if exists
    if ('updatedAt' in this.model.$schema) {
      ;(data as Record<string, unknown>)['updatedAt'] = Date.now()
    }

    // Transform to snake_case for DB
    const dbData: Record<string, unknown> = {}
    for (const key in data) {
      dbData[toSnakeCase(key)] = data[key]
    }

    const fields = Object.keys(dbData)
    const values = fields.map((f) => dbData[f])

    const setClause = fields.map((f) => `${escapeIdentifier(f)} = ?`).join(', ')
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions.map((c) => c.value)

    const sql = `UPDATE ${escapeIdentifier(this.model.$tableName)} SET ${setClause}${whereClause}`
    const stmt = db.prepare(sql).bind(...values, ...whereParams)
    const result = await stmt.run()

    return result.meta.changes
  }

  /**
   * Bulk delete matching records
   * @returns Number of deleted rows
   */
  async delete(db: D1Database): Promise<number> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions.map((c) => c.value)

    const sql = `DELETE FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.run()

    return result.meta.changes
  }

  /**
   * Count matching records
   */
  async count(db: D1Database): Promise<number> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions.map((c) => c.value)

    const sql = `SELECT COUNT(*) as count FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.first<{ count: number }>()

    return result?.count ?? 0
  }

  /**
   * Build WHERE clause from conditions
   */
  private buildWhereClause(): string {
    if (this.conditions.length === 0) {
      return ''
    }

    // Transform camelCase field names to snake_case for DB and escape
    const clauses = this.conditions.map((c) => {
      const dbField = escapeIdentifier(toSnakeCase(c.field))
      return `${dbField} ${c.operator} ?`
    })

    return ' WHERE ' + clauses.join(' AND ')
  }

  /**
   * Generate SQL query with parameters
   */
  toSQL(): { query: string; params: unknown[] } {
    let sql = `SELECT * FROM ${escapeIdentifier(this.model.$tableName)}`

    const whereClause = this.buildWhereClause()
    sql += whereClause

    if (this.orderByField) {
      const dbField = escapeIdentifier(toSnakeCase(this.orderByField))
      sql += ` ORDER BY ${dbField} ${this.orderDirection.toUpperCase()}`
    }

    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`
    }

    if (this.offsetValue) {
      sql += ` OFFSET ${this.offsetValue}`
    }

    const params = this.conditions.map((c) => c.value)

    return { query: sql, params }
  }
}
