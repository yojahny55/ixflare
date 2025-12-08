/**
 * @module edge-record/query-builder
 * @description Type-safe query builder with CRUD operations
 */

import type { SchemaDefinition, InferSchema, Model } from './schema/types'
import { ModelInstance } from './crud/model-instance'
import { toSnakeCase } from './crud/case-transform'
import { escapeIdentifier } from './schema/type-mapping'

// Comparison operators supported by SQLite
export type WhereOperator =
  | '='
  | '!='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'IN'
  | 'NOT IN'
  | 'LIKE'
  | 'NOT LIKE'
  | 'IS NULL'
  | 'IS NOT NULL'

// Value types for advanced where conditions
export type WhereValue<T = unknown> =
  | T // Simple equality
  | { in: T[] } // IN operator
  | { notIn: T[] } // NOT IN operator
  | { like: string } // LIKE pattern
  | { notLike: string } // NOT LIKE pattern
  | { isNull: true } // IS NULL
  | { isNotNull: true } // IS NOT NULL
  | { gt: T } // Greater than
  | { gte: T } // Greater than or equal
  | { lt: T } // Less than
  | { lte: T } // Less than or equal
  | { gt?: T; lt?: T; gte?: T; lte?: T } // Range conditions

// Type for complex where conditions
export type WhereConditions<T extends SchemaDefinition> = {
  [K in keyof InferSchema<T>]?: WhereValue<InferSchema<T>[K]>
}

export type WhereCondition = { field: string; operator: string; value: unknown }

// Utility type to extract numeric keys from schema
export type NumericKeys<T extends SchemaDefinition> = {
  [K in keyof InferSchema<T>]: InferSchema<T>[K] extends number ? K : never
}[keyof InferSchema<T>]

// Grouped result type
export interface GroupedResult {
  [key: string]: unknown
  count?: number
  sum?: number
  avg?: number | null
}

export class QueryBuilder<T extends SchemaDefinition, Selected = InferSchema<T>> {
  // OR groups: Each array represents AND conditions, arrays are combined with OR
  private andGroups: WhereCondition[][] = [[]]
  private orderByField?: string
  private orderDirection: 'asc' | 'desc' = 'asc'
  private limitValue?: number
  private offsetValue?: number
  private selectedFields?: string[]

  constructor(private model: Model<T>) {}

  /**
   * Get current AND group (last group in andGroups array)
   */
  private get currentGroup(): WhereCondition[] {
    return this.andGroups[this.andGroups.length - 1]
  }

  /**
   * Get all conditions flattened (for backward compatibility)
   */
  private get conditions(): WhereCondition[] {
    return this.andGroups.flat()
  }

  /**
   * Add WHERE conditions with support for advanced operators
   */
  where(conditions: WhereConditions<T>): this
  where<K extends keyof InferSchema<T>>(field: K, operator: WhereOperator, value: unknown): this
  where<K extends keyof InferSchema<T>>(field: K, value: InferSchema<T>[K]): this
  where(
    fieldOrConditions: keyof InferSchema<T> | WhereConditions<T>,
    operatorOrValue?: WhereOperator | unknown,
    value?: unknown
  ): this {
    if (typeof fieldOrConditions === 'object' && !Array.isArray(fieldOrConditions)) {
      // Object notation: { email: 'test@example.com', role: 'admin' }
      for (const [field, val] of Object.entries(fieldOrConditions)) {
        this.addWhereCondition(field, val)
      }
    } else if (value !== undefined) {
      // Three-argument notation: where('createdAt', '>', 1000000)
      const field = String(fieldOrConditions)
      const operator = operatorOrValue as WhereOperator
      this.currentGroup.push({ field, operator, value })
    } else {
      // Two-argument notation: where('email', 'test@example.com')
      const field = String(fieldOrConditions)
      this.currentGroup.push({ field, operator: '=', value: operatorOrValue })
    }
    return this
  }

  /**
   * Add OR WHERE conditions
   */
  orWhere(conditions: WhereConditions<T>): this {
    // Start a new AND group for OR logic
    this.andGroups.push([])

    for (const [field, val] of Object.entries(conditions)) {
      this.addWhereCondition(field, val)
    }

    return this
  }

  /**
   * Process WHERE condition value and extract operator
   */
  private addWhereCondition(field: string, val: unknown): void {
    // Check if value is an operator object
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const operatorObj = val as Record<string, unknown>

      // IN operator
      if ('in' in operatorObj && Array.isArray(operatorObj.in)) {
        for (const item of operatorObj.in) {
          this.currentGroup.push({ field, operator: 'IN', value: item })
        }
        return
      }

      // NOT IN operator
      if ('notIn' in operatorObj && Array.isArray(operatorObj.notIn)) {
        for (const item of operatorObj.notIn) {
          this.currentGroup.push({ field, operator: 'NOT IN', value: item })
        }
        return
      }

      // LIKE operator
      if ('like' in operatorObj && typeof operatorObj.like === 'string') {
        this.validateLikePattern(operatorObj.like)
        this.currentGroup.push({ field, operator: 'LIKE', value: operatorObj.like })
        return
      }

      // NOT LIKE operator
      if ('notLike' in operatorObj && typeof operatorObj.notLike === 'string') {
        this.validateLikePattern(operatorObj.notLike)
        this.currentGroup.push({ field, operator: 'NOT LIKE', value: operatorObj.notLike })
        return
      }

      // IS NULL
      if ('isNull' in operatorObj && operatorObj.isNull === true) {
        this.currentGroup.push({ field, operator: 'IS NULL', value: null })
        return
      }

      // IS NOT NULL
      if ('isNotNull' in operatorObj && operatorObj.isNotNull === true) {
        this.currentGroup.push({ field, operator: 'IS NOT NULL', value: null })
        return
      }

      // Range operators (gt, gte, lt, lte)
      if ('gt' in operatorObj) {
        this.currentGroup.push({ field, operator: '>', value: operatorObj.gt })
      }
      if ('gte' in operatorObj) {
        this.currentGroup.push({ field, operator: '>=', value: operatorObj.gte })
      }
      if ('lt' in operatorObj) {
        this.currentGroup.push({ field, operator: '<', value: operatorObj.lt })
      }
      if ('lte' in operatorObj) {
        this.currentGroup.push({ field, operator: '<=', value: operatorObj.lte })
      }

      // If we added any range operators, return
      if (
        'gt' in operatorObj ||
        'gte' in operatorObj ||
        'lt' in operatorObj ||
        'lte' in operatorObj
      ) {
        return
      }
    }

    // Default: simple equality
    this.currentGroup.push({ field, operator: '=', value: val })
  }

  /**
   * Validate LIKE pattern length (D1 limit: 50 bytes)
   */
  private validateLikePattern(pattern: string): void {
    const byteLength = new TextEncoder().encode(pattern).length
    if (byteLength > 50) {
      throw new Error(`LIKE pattern exceeds 50-byte limit (${byteLength} bytes)`)
    }
  }

  /**
   * Select specific fields (returns plain objects, not ModelInstances)
   */
  select<K extends keyof InferSchema<T>>(...fields: K[]): QueryBuilder<T, Pick<InferSchema<T>, K>> {
    this.selectedFields = fields.map((f) => String(f))
    return this as unknown as QueryBuilder<T, Pick<InferSchema<T>, K>>
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
   * Execute query and return all matching records
   * Returns ModelInstances when selecting all fields, plain objects when specific fields selected
   */
  async all(
    db: D1Database
  ): Promise<Selected extends InferSchema<T> ? ModelInstance<T>[] : Selected[]> {
    const { query, params } = this.toSQL()
    const stmt = db.prepare(query).bind(...params)
    const result = await stmt.all<Record<string, unknown>>()

    // If specific fields selected, return plain objects
    if (this.selectedFields && this.selectedFields.length > 0) {
      return result.results as Selected extends InferSchema<T> ? ModelInstance<T>[] : Selected[]
    }

    // Otherwise return ModelInstances
    return result.results.map(
      (row) => new ModelInstance(this.model, row as Partial<InferSchema<T>>, false)
    ) as Selected extends InferSchema<T> ? ModelInstance<T>[] : Selected[]
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
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const sql = `SELECT COUNT(*) as count FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.first<{ count: number }>()

    return result?.count ?? 0
  }

  /**
   * Sum numeric field values
   */
  async sum<K extends NumericKeys<T>>(field: K, db: D1Database): Promise<number> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const dbField = escapeIdentifier(toSnakeCase(String(field)))
    const sql = `SELECT COALESCE(SUM(${dbField}), 0) as sum FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.first<{ sum: number }>()

    return result?.sum ?? 0
  }

  /**
   * Calculate average of numeric field
   */
  async avg<K extends NumericKeys<T>>(field: K, db: D1Database): Promise<number | null> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const dbField = escapeIdentifier(toSnakeCase(String(field)))
    const sql = `SELECT AVG(${dbField}) as avg FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.first<{ avg: number | null }>()

    return result?.avg ?? null
  }

  /**
   * Find minimum value
   */
  async min<K extends keyof InferSchema<T>>(
    field: K,
    db: D1Database
  ): Promise<InferSchema<T>[K] | null> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const dbField = escapeIdentifier(toSnakeCase(String(field)))
    const sql = `SELECT MIN(${dbField}) as min FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.first<{ min: InferSchema<T>[K] | null }>()

    return result?.min ?? null
  }

  /**
   * Find maximum value
   */
  async max<K extends keyof InferSchema<T>>(
    field: K,
    db: D1Database
  ): Promise<InferSchema<T>[K] | null> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const dbField = escapeIdentifier(toSnakeCase(String(field)))
    const sql = `SELECT MAX(${dbField}) as max FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.first<{ max: InferSchema<T>[K] | null }>()

    return result?.max ?? null
  }

  /**
   * Group by field for aggregation
   */
  groupBy<K extends keyof InferSchema<T>>(field: K): GroupedQueryBuilder<T> {
    return new GroupedQueryBuilder(this.model, this.andGroups, String(field))
  }

  /**
   * Build WHERE clause from AND groups with OR logic
   */
  private buildWhereClause(): string {
    // Filter out empty groups
    const nonEmptyGroups = this.andGroups.filter((group) => group.length > 0)

    if (nonEmptyGroups.length === 0) {
      return ''
    }

    // Build each AND group
    const groupClauses = nonEmptyGroups.map((group) => {
      // Group IN/NOT IN conditions by field
      const inGroups = new Map<string, WhereCondition[]>()
      const otherConditions: WhereCondition[] = []

      for (const cond of group) {
        if (cond.operator === 'IN' || cond.operator === 'NOT IN') {
          const key = `${cond.field}:${cond.operator}`
          if (!inGroups.has(key)) {
            inGroups.set(key, [])
          }
          inGroups.get(key)!.push(cond)
        } else {
          otherConditions.push(cond)
        }
      }

      // Build clauses for this group
      const clauses: string[] = []

      // Add IN/NOT IN clauses
      for (const conditions of inGroups.values()) {
        const field = conditions[0].field
        const operator = conditions[0].operator
        const dbField = escapeIdentifier(toSnakeCase(field))
        const placeholders = conditions.map(() => '?').join(', ')
        clauses.push(`${dbField} ${operator} (${placeholders})`)
      }

      // Add other conditions
      for (const cond of otherConditions) {
        const dbField = escapeIdentifier(toSnakeCase(cond.field))

        if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
          clauses.push(`${dbField} ${cond.operator}`)
        } else {
          clauses.push(`${dbField} ${cond.operator} ?`)
        }
      }

      // Return group with parentheses if needed
      return clauses.length > 1 ? `(${clauses.join(' AND ')})` : clauses[0]
    })

    // Join groups with OR
    const whereClause = groupClauses.join(' OR ')
    return ' WHERE ' + whereClause
  }

  /**
   * Generate SQL query with parameters
   */
  toSQL(): { query: string; params: unknown[] } {
    // Build SELECT clause
    let selectClause: string
    if (this.selectedFields && this.selectedFields.length > 0) {
      const fields = this.selectedFields.map((f) => escapeIdentifier(toSnakeCase(f))).join(', ')
      selectClause = `SELECT ${fields}`
    } else {
      selectClause = 'SELECT *'
    }

    let sql = `${selectClause} FROM ${escapeIdentifier(this.model.$tableName)}`

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

    // Collect parameters, excluding NULL checks which don't need parameters
    const params = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    return { query: sql, params }
  }
}

/**
 * Query builder for grouped aggregations
 */
export class GroupedQueryBuilder<T extends SchemaDefinition> {
  constructor(
    private model: Model<T>,
    private andGroups: WhereCondition[][],
    private groupField: string
  ) {}

  /**
   * Get flattened conditions
   */
  private get conditions(): WhereCondition[] {
    return this.andGroups.flat()
  }

  /**
   * Build WHERE clause
   */
  private buildWhereClause(): string {
    const nonEmptyGroups = this.andGroups.filter((group) => group.length > 0)

    if (nonEmptyGroups.length === 0) {
      return ''
    }

    const groupClauses = nonEmptyGroups.map((group) => {
      const inGroups = new Map<string, WhereCondition[]>()
      const otherConditions: WhereCondition[] = []

      for (const cond of group) {
        if (cond.operator === 'IN' || cond.operator === 'NOT IN') {
          const key = `${cond.field}:${cond.operator}`
          if (!inGroups.has(key)) {
            inGroups.set(key, [])
          }
          inGroups.get(key)!.push(cond)
        } else {
          otherConditions.push(cond)
        }
      }

      const clauses: string[] = []

      for (const conditions of inGroups.values()) {
        const field = conditions[0].field
        const operator = conditions[0].operator
        const dbField = escapeIdentifier(toSnakeCase(field))
        const placeholders = conditions.map(() => '?').join(', ')
        clauses.push(`${dbField} ${operator} (${placeholders})`)
      }

      for (const cond of otherConditions) {
        const dbField = escapeIdentifier(toSnakeCase(cond.field))

        if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
          clauses.push(`${dbField} ${cond.operator}`)
        } else {
          clauses.push(`${dbField} ${cond.operator} ?`)
        }
      }

      return clauses.length > 1 ? `(${clauses.join(' AND ')})` : clauses[0]
    })

    const whereClause = groupClauses.join(' OR ')
    return ' WHERE ' + whereClause
  }

  /**
   * Count records in each group
   */
  async count(db: D1Database): Promise<GroupedResult[]> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const dbField = escapeIdentifier(toSnakeCase(this.groupField))
    const sql = `SELECT ${dbField} as ${this.groupField}, COUNT(*) as count FROM ${escapeIdentifier(this.model.$tableName)}${whereClause} GROUP BY ${dbField}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.all<GroupedResult>()

    return result.results
  }

  /**
   * Sum field values in each group
   */
  async sum<F extends NumericKeys<T>>(field: F, db: D1Database): Promise<GroupedResult[]> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const groupDbField = escapeIdentifier(toSnakeCase(this.groupField))
    const sumDbField = escapeIdentifier(toSnakeCase(String(field)))
    const sql = `SELECT ${groupDbField} as ${this.groupField}, COALESCE(SUM(${sumDbField}), 0) as sum FROM ${escapeIdentifier(this.model.$tableName)}${whereClause} GROUP BY ${groupDbField}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.all<GroupedResult>()

    return result.results
  }

  /**
   * Average field values in each group
   */
  async avg<F extends NumericKeys<T>>(field: F, db: D1Database): Promise<GroupedResult[]> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const groupDbField = escapeIdentifier(toSnakeCase(this.groupField))
    const avgDbField = escapeIdentifier(toSnakeCase(String(field)))
    const sql = `SELECT ${groupDbField} as ${this.groupField}, AVG(${avgDbField}) as avg FROM ${escapeIdentifier(this.model.$tableName)}${whereClause} GROUP BY ${groupDbField}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.all<GroupedResult>()

    return result.results
  }
}
