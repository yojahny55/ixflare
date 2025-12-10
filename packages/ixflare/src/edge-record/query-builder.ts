/**
 * @module edge-record/query-builder
 * @description Type-safe query builder with CRUD operations for D1/SQLite
 *
 * @example
 * ```typescript
 * // Simple equality
 * const admins = await User.where({ role: 'admin' }).all(db)
 *
 * // Comparison operators
 * const recent = await User.where('createdAt', '>', Date.now() - 86400000).all(db)
 *
 * // IN operator
 * const users = await User.where({ role: { in: ['admin', 'moderator'] } }).all(db)
 *
 * // LIKE pattern
 * const companyUsers = await User.where({ email: { like: '%@company.com' } }).all(db)
 *
 * // OR conditions
 * const results = await User.where({ role: 'admin' }).orWhere({ role: 'moderator' }).all(db)
 *
 * // Select specific fields
 * const emails = await User.select('id', 'email').all(db)
 *
 * // Aggregates
 * const count = await User.where({ role: 'admin' }).count(db)
 * const total = await Order.sum('amount', db)
 * ```
 */

import type { SchemaDefinition, InferSchema, Model } from './schema/types'
import { ModelInstance } from './crud/model-instance'
import { toSnakeCase } from './crud/case-transform'
import { escapeIdentifier } from './schema/type-mapping'
import { EagerLoader, type ModelInstanceWithRelations } from './relations/eager-loader'
import { NotFoundError } from './crud/errors'

/**
 * D1 parameter limit - maximum bound parameters per query
 * @see https://developers.cloudflare.com/d1/platform/limits/
 */
const D1_PARAM_LIMIT = 100

/**
 * D1 LIKE pattern byte limit
 * @see https://developers.cloudflare.com/d1/platform/limits/
 */
const D1_LIKE_BYTE_LIMIT = 50

/**
 * Comparison operators supported by SQLite
 */
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

/**
 * Grouped aggregation result type with typed group field
 * @template K - The type of the grouping field value
 */
export interface GroupedResult<K = unknown> {
  /** The grouped field value - type matches the schema field type */
  [key: string]: K | number | null | undefined
  /** Count of records in this group (present when using count()) */
  count?: number
  /** Sum of values in this group (present when using sum()) */
  sum?: number
  /** Average of values in this group (present when using avg()) */
  avg?: number | null
}

/**
 * Build WHERE clause from AND groups with OR logic
 * Shared utility function to avoid code duplication between QueryBuilder and GroupedQueryBuilder
 * @internal
 */
function buildWhereClauseFromGroups(andGroups: WhereCondition[][]): string {
  // Filter out empty groups
  const nonEmptyGroups = andGroups.filter((group) => group.length > 0)

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

export class QueryBuilder<T extends SchemaDefinition, Selected = InferSchema<T>> {
  // OR groups: Each array represents AND conditions, arrays are combined with OR
  private andGroups: WhereCondition[][] = [[]]
  private orderByField?: string
  private orderDirection: 'asc' | 'desc' = 'asc'
  private limitValue?: number
  private offsetValue?: number
  private selectedFields?: string[]
  private eagerRelations: string[] = []
  /** Flag to include soft-deleted records in query results (bypasses global scope filter) */
  private _includeTrashed = false
  /** Flag to only return soft-deleted records (inverts global scope filter) */
  private _onlyTrashed = false

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
   *
   * @remarks
   * When using object notation with multiple fields, parameters are bound in
   * Object.entries() iteration order. Per ECMAScript spec, this is insertion order
   * for string keys, which is deterministic for object literals.
   *
   * @example
   * ```typescript
   * // Object notation for simple equality
   * User.where({ email: 'test@example.com', role: 'admin' })
   *
   * // Two-argument notation
   * User.where('email', 'test@example.com')
   *
   * // Three-argument notation with comparison operator
   * User.where('createdAt', '>', Date.now() - 86400000)
   * User.where('age', '>=', 18)
   * User.where('role', '!=', 'banned')
   *
   * // Advanced operators via object notation
   * User.where({ role: { in: ['admin', 'moderator'] } })
   * User.where({ email: { like: '%@company.com' } })
   * User.where({ deletedAt: { isNull: true } })
   * User.where({ age: { gte: 18, lte: 65 } })
   * ```
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
   * @internal
   */
  private addWhereCondition(field: string, val: unknown): void {
    // Check if value is an operator object
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const operatorObj = val as Record<string, unknown>

      // IN operator
      if ('in' in operatorObj && Array.isArray(operatorObj.in)) {
        const items = operatorObj.in as unknown[]
        if (items.length === 0) {
          throw new Error(`IN clause cannot have empty array for field "${field}"`)
        }
        if (items.length > D1_PARAM_LIMIT) {
          throw new Error(
            `IN clause for field "${field}" has ${items.length} values, exceeding D1 limit of ${D1_PARAM_LIMIT}. ` +
              `Split into multiple queries.`
          )
        }
        for (const item of items) {
          this.currentGroup.push({ field, operator: 'IN', value: item })
        }
        return
      }

      // NOT IN operator
      if ('notIn' in operatorObj && Array.isArray(operatorObj.notIn)) {
        const items = operatorObj.notIn as unknown[]
        if (items.length === 0) {
          throw new Error(`NOT IN clause cannot have empty array for field "${field}"`)
        }
        if (items.length > D1_PARAM_LIMIT) {
          throw new Error(
            `NOT IN clause for field "${field}" has ${items.length} values, exceeding D1 limit of ${D1_PARAM_LIMIT}. ` +
              `Split into multiple queries.`
          )
        }
        for (const item of items) {
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
   * @throws Error if pattern exceeds D1_LIKE_BYTE_LIMIT
   * @internal
   */
  private validateLikePattern(pattern: string): void {
    const byteLength = new TextEncoder().encode(pattern).length
    if (byteLength > D1_LIKE_BYTE_LIMIT) {
      throw new Error(`LIKE pattern exceeds ${D1_LIKE_BYTE_LIMIT}-byte limit (${byteLength} bytes)`)
    }
  }

  /**
   * Select specific fields (returns plain objects, not ModelInstances)
   *
   * When using select(), the return type is narrowed to only the selected fields,
   * and results are returned as plain objects instead of ModelInstance wrappers.
   *
   * @example
   * ```typescript
   * // Returns { id: number, email: string }[]
   * const users = await User.select('id', 'email').all(db)
   *
   * // Type-safe field access
   * users[0].id    // OK
   * users[0].email // OK
   * users[0].name  // TypeScript error - not selected
   * ```
   */
  select<K extends keyof InferSchema<T>>(...fields: K[]): QueryBuilder<T, Pick<InferSchema<T>, K>> {
    this.selectedFields = fields.map((f) => String(f))
    return this as unknown as QueryBuilder<T, Pick<InferSchema<T>, K>>
  }

  /**
   * Order results by a field
   *
   * @example
   * ```typescript
   * // Order by createdAt descending (newest first)
   * const users = await User.where({ role: 'admin' }).orderBy('createdAt', 'desc').all(db)
   *
   * // Default is ascending
   * const users = await User.orderBy('name').all(db)
   * ```
   */
  orderBy(field: keyof InferSchema<T>, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByField = String(field)
    this.orderDirection = direction
    return this
  }

  /**
   * Limit the number of results
   * @example User.where({ role: 'admin' }).limit(10).all(db)
   */
  limit(value: number): this {
    this.limitValue = value
    return this
  }

  /**
   * Skip the first N results (for pagination)
   * @example User.where({ role: 'admin' }).limit(10).offset(20).all(db) // Page 3
   */
  offset(value: number): this {
    this.offsetValue = value
    return this
  }

  /**
   * Eager load relationships to prevent N+1 queries
   * Supports dot notation for nested relations
   *
   * @param relations Relation names to load
   * @returns this
   *
   * @example
   * ```typescript
   * // Load single relation
   * const users = await User.with('posts').all(db)
   *
   * // Load multiple relations
   * const users = await User.with('posts', 'profile').all(db)
   *
   * // Nested eager loading
   * const posts = await Post.with('author', 'author.profile', 'tags').all(db)
   * ```
   */
  with(...relations: string[]): this {
    this.eagerRelations.push(...relations)
    return this
  }

  /**
   * Include soft-deleted records in query results
   *
   * By default, models with soft deletes enabled automatically filter out deleted records.
   * Use this method to include soft-deleted records in the query.
   *
   * @example
   * ```typescript
   * // Include soft-deleted users
   * const allUsers = await User.withTrashed().all(db)
   *
   * // Find user even if soft-deleted
   * const user = await User.withTrashed().find(1, db)
   * ```
   */
  withTrashed(): this {
    this._includeTrashed = true
    this._onlyTrashed = false
    return this
  }

  /**
   * Only return soft-deleted records
   *
   * Use this method to query only records that have been soft-deleted.
   *
   * @example
   * ```typescript
   * // Get only deleted users
   * const deletedUsers = await User.onlyTrashed().all(db)
   *
   * // Count deleted records
   * const deletedCount = await User.onlyTrashed().count(db)
   * ```
   */
  onlyTrashed(): this {
    this._onlyTrashed = true
    this._includeTrashed = false
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
    const instances = result.results.map(
      (row) => new ModelInstance(this.model, row as Partial<InferSchema<T>>, false)
    ) as ModelInstanceWithRelations<T>[]

    // Load eager relations if any
    if (this.eagerRelations.length > 0) {
      const loader = new EagerLoader(this.model, this.eagerRelations)
      await loader.load(instances, db)
    }

    return instances as Selected extends InferSchema<T> ? ModelInstance<T>[] : Selected[]
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

    const instance = new ModelInstance(
      this.model,
      row as Partial<InferSchema<T>>,
      false
    ) as ModelInstanceWithRelations<T>

    // Load eager relations if any
    if (this.eagerRelations.length > 0) {
      const loader = new EagerLoader(this.model, this.eagerRelations)
      await loader.load([instance], db)
    }

    return instance
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
   * If model has soft deletes enabled, performs UPDATE to set deletedAt instead of DELETE
   * @returns Number of deleted rows
   */
  async delete(db: D1Database): Promise<number> {
    // Check if soft deletes enabled
    if (this.model.$softDeletes) {
      // Soft delete: UPDATE deletedAt = Date.now()
      const now = Date.now()
      const updates: Record<string, unknown> = { deletedAt: now }

      // Also update updatedAt if exists
      if ('updatedAt' in this.model.$schema) {
        updates.updatedAt = now
      }

      return this.update(updates as Partial<InferSchema<T>>, db)
    }

    // Hard delete
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const sql = `DELETE FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.run()

    return result.meta.changes
  }

  /**
   * Permanently delete matching records (bypass soft deletes)
   * Always performs hard DELETE even if soft deletes are enabled
   * @returns Number of deleted rows
   */
  async forceDelete(db: D1Database): Promise<number> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const sql = `DELETE FROM ${escapeIdentifier(this.model.$tableName)}${whereClause}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.run()

    return result.meta.changes
  }

  /**
   * Count matching records
   *
   * @example
   * ```typescript
   * const totalAdmins = await User.where({ role: 'admin' }).count(db)
   * const allUsers = await User.count(db) // Count all
   * ```
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
   *
   * Only accepts numeric fields (integer, real) for type safety.
   *
   * @example
   * ```typescript
   * const totalRevenue = await Order.where({ status: 'completed' }).sum('amount', db)
   * ```
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
   *
   * Returns null if no matching records found.
   *
   * @example
   * ```typescript
   * const avgOrderValue = await Order.where({ status: 'completed' }).avg('amount', db)
   * ```
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
   * Find minimum value in a field
   *
   * Works on any comparable field type. Returns null if no records match.
   *
   * @example
   * ```typescript
   * const lowestPrice = await Product.min('price', db)
   * const oldestDate = await User.min('createdAt', db)
   * ```
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
   * Find maximum value in a field
   *
   * Works on any comparable field type. Returns null if no records match.
   *
   * @example
   * ```typescript
   * const highestPrice = await Product.max('price', db)
   * const newestDate = await User.max('createdAt', db)
   * ```
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
   * Find a record by ID
   *
   * Respects soft delete scopes: `withTrashed()` includes deleted records,
   * `onlyTrashed()` returns only deleted records.
   *
   * @param id The record ID to find
   * @param db The D1Database instance
   * @returns ModelInstance or null if not found
   *
   * @example
   * ```typescript
   * // Normal find (excludes soft-deleted)
   * const user = await User.where({}).find(1, db)
   *
   * // Include soft-deleted records
   * const deletedUser = await User.withTrashed().find(1, db)
   *
   * // Find only in soft-deleted records
   * const trashedUser = await User.onlyTrashed().find(1, db)
   * ```
   */
  async find(id: number | string, db: D1Database): Promise<ModelInstance<T> | null> {
    // Build WHERE clause with soft delete filter
    let sql = `SELECT * FROM ${escapeIdentifier(this.model.$tableName)} WHERE id = ?`

    // Apply soft delete filter based on scope
    if (this.model.$softDeletes && !this._includeTrashed) {
      if (this._onlyTrashed) {
        sql += ' AND "deleted_at" IS NOT NULL'
      } else {
        sql += ' AND "deleted_at" IS NULL'
      }
    }

    const stmt = db.prepare(sql).bind(id)
    const row = await stmt.first<Record<string, unknown>>()

    if (!row) {
      return null
    }

    return new ModelInstance(this.model, row as Partial<InferSchema<T>>, false)
  }

  /**
   * Find a record by ID or throw NotFoundError
   *
   * Respects soft delete scopes: `withTrashed()` includes deleted records,
   * `onlyTrashed()` returns only deleted records.
   *
   * @param id The record ID to find
   * @param db The D1Database instance
   * @returns ModelInstance (never null)
   * @throws NotFoundError if record not found
   *
   * @example
   * ```typescript
   * // Normal findOrFail (excludes soft-deleted)
   * const user = await User.where({}).findOrFail(1, db)
   *
   * // Include soft-deleted records
   * const deletedUser = await User.withTrashed().findOrFail(1, db)
   * ```
   */
  async findOrFail(id: number | string, db: D1Database): Promise<ModelInstance<T>> {
    const result = await this.find(id, db)

    if (!result) {
      throw new NotFoundError(
        `${this.model.$tableName.toUpperCase()}.NOT_FOUND`,
        `${this.model.$tableName} with id ${id} not found`
      )
    }

    return result
  }

  /**
   * Group by field for aggregation
   *
   * Returns a GroupedQueryBuilder that supports count(), sum(), and avg() aggregations.
   * Results are typed to include the grouped field with its correct type.
   * Soft delete filter is automatically applied if model has soft deletes enabled.
   *
   * @example
   * ```typescript
   * // Count orders by status
   * const stats = await Order.groupBy('status').count(db)
   * // Returns: [{ status: 'pending', count: 5 }, { status: 'completed', count: 10 }]
   *
   * // Sum amounts by status, ordered by sum descending
   * const totals = await Order.groupBy('status').orderBy('sum', 'desc').sum('amount', db)
   * // Returns: [{ status: 'completed', sum: 1500 }, ...]
   * ```
   */
  groupBy<K extends keyof InferSchema<T> & string>(field: K): GroupedQueryBuilder<T, K> {
    return new GroupedQueryBuilder<T, K>(
      this.model,
      this.andGroups,
      field,
      this._includeTrashed,
      this._onlyTrashed
    )
  }

  /**
   * Build WHERE clause from AND groups with OR logic
   * Applies global soft delete filter if model has soft deletes enabled
   * @internal
   */
  private buildWhereClause(): string {
    // Apply soft delete global scope filter
    if (this.model.$softDeletes && !this._includeTrashed) {
      // Clone andGroups to avoid mutating original
      const filteredGroups = this.andGroups.map((group) => [...group])

      // Add soft delete condition to the first group (main WHERE clause)
      if (this._onlyTrashed) {
        // Only show deleted records
        filteredGroups[0].unshift({ field: 'deletedAt', operator: 'IS NOT NULL', value: null })
      } else {
        // Default: exclude deleted records
        filteredGroups[0].unshift({ field: 'deletedAt', operator: 'IS NULL', value: null })
      }

      return buildWhereClauseFromGroups(filteredGroups)
    }

    return buildWhereClauseFromGroups(this.andGroups)
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

    // Validate total parameter count against D1 limit
    if (params.length > D1_PARAM_LIMIT) {
      throw new Error(
        `Query exceeds D1 parameter limit: ${params.length} total parameters (max: ${D1_PARAM_LIMIT}). ` +
          `Reduce the number of conditions or split into multiple queries.`
      )
    }

    return { query: sql, params }
  }
}

/**
 * Query builder for grouped aggregations
 *
 * Created by calling `QueryBuilder.groupBy(field)`. Supports count(), sum(), and avg() aggregations.
 * Automatically applies soft delete filter if the model has soft deletes enabled.
 *
 * @example
 * ```typescript
 * // Count orders by status
 * const stats = await Order.groupBy('status').count(db)
 *
 * // Sum amounts by category with ordering
 * const topCategories = await Product.groupBy('category').orderBy('sum', 'desc').limit(5).sum('price', db)
 * ```
 *
 * @template T - The schema definition type
 * @template K - The key of the field being grouped by
 */
export class GroupedQueryBuilder<
  T extends SchemaDefinition,
  K extends keyof InferSchema<T> = keyof InferSchema<T>,
> {
  private orderByField?: string
  private orderDirection: 'asc' | 'desc' = 'asc'
  private limitValue?: number
  private offsetValue?: number
  /** Flag to include soft-deleted records in query results */
  private _includeTrashed: boolean
  /** Flag to only return soft-deleted records */
  private _onlyTrashed: boolean

  constructor(
    private model: Model<T>,
    private andGroups: WhereCondition[][],
    private groupField: K & string,
    includeTrashed = false,
    onlyTrashed = false
  ) {
    this._includeTrashed = includeTrashed
    this._onlyTrashed = onlyTrashed
  }

  /**
   * Get flattened conditions
   * @internal
   */
  private get conditions(): WhereCondition[] {
    return this.andGroups.flat()
  }

  /**
   * Build WHERE clause using shared utility
   * Applies global soft delete filter if model has soft deletes enabled
   * @internal
   */
  private buildWhereClause(): string {
    // Apply soft delete global scope filter
    if (this.model.$softDeletes && !this._includeTrashed) {
      // Clone andGroups to avoid mutating original
      const filteredGroups = this.andGroups.map((group) => [...group])

      // Add soft delete condition to the first group (main WHERE clause)
      if (this._onlyTrashed) {
        // Only show deleted records
        filteredGroups[0].unshift({ field: 'deletedAt', operator: 'IS NOT NULL', value: null })
      } else {
        // Default: exclude deleted records
        filteredGroups[0].unshift({ field: 'deletedAt', operator: 'IS NULL', value: null })
      }

      return buildWhereClauseFromGroups(filteredGroups)
    }

    return buildWhereClauseFromGroups(this.andGroups)
  }

  /**
   * Build ORDER BY, LIMIT, OFFSET clauses
   * @internal
   */
  private buildTailClauses(): string {
    let tail = ''
    if (this.orderByField) {
      // Order by can be the group field or an aggregate (count, sum, avg)
      const isAggregate = ['count', 'sum', 'avg'].includes(this.orderByField)
      const orderField = isAggregate
        ? this.orderByField
        : escapeIdentifier(toSnakeCase(this.orderByField))
      tail += ` ORDER BY ${orderField} ${this.orderDirection.toUpperCase()}`
    }
    if (this.limitValue !== undefined) {
      tail += ` LIMIT ${this.limitValue}`
    }
    if (this.offsetValue !== undefined) {
      tail += ` OFFSET ${this.offsetValue}`
    }
    return tail
  }

  /**
   * Order grouped results by a field or aggregate
   *
   * @example
   * ```typescript
   * // Order by count descending (most frequent first)
   * Order.groupBy('status').orderBy('count', 'desc').count(db)
   *
   * // Order by the grouped field
   * Order.groupBy('status').orderBy('status', 'asc').count(db)
   * ```
   */
  orderBy(field: K | 'count' | 'sum' | 'avg', direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByField = String(field)
    this.orderDirection = direction
    return this
  }

  /**
   * Limit the number of grouped results
   * @example Order.groupBy('status').limit(5).count(db) // Top 5 statuses
   */
  limit(value: number): this {
    this.limitValue = value
    return this
  }

  /**
   * Skip the first N grouped results (for pagination)
   * @example Order.groupBy('status').limit(5).offset(5).count(db) // Page 2
   */
  offset(value: number): this {
    this.offsetValue = value
    return this
  }

  /**
   * Count records in each group
   *
   * @example
   * ```typescript
   * const stats = await Order.groupBy('status').count(db)
   * // Returns: [{ status: 'pending', count: 5 }, { status: 'completed', count: 10 }]
   * ```
   */
  async count(db: D1Database): Promise<Array<Pick<InferSchema<T>, K> & { count: number }>> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const dbField = escapeIdentifier(toSnakeCase(this.groupField))
    const tailClauses = this.buildTailClauses()
    const sql = `SELECT ${dbField} as ${this.groupField}, COUNT(*) as count FROM ${escapeIdentifier(this.model.$tableName)}${whereClause} GROUP BY ${dbField}${tailClauses}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.all<Pick<InferSchema<T>, K> & { count: number }>()

    return result.results
  }

  /**
   * Sum field values in each group
   */
  async sum<F extends NumericKeys<T>>(
    field: F,
    db: D1Database
  ): Promise<Array<Pick<InferSchema<T>, K> & { sum: number }>> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const groupDbField = escapeIdentifier(toSnakeCase(this.groupField))
    const sumDbField = escapeIdentifier(toSnakeCase(String(field)))
    const tailClauses = this.buildTailClauses()
    const sql = `SELECT ${groupDbField} as ${this.groupField}, COALESCE(SUM(${sumDbField}), 0) as sum FROM ${escapeIdentifier(this.model.$tableName)}${whereClause} GROUP BY ${groupDbField}${tailClauses}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.all<Pick<InferSchema<T>, K> & { sum: number }>()

    return result.results
  }

  /**
   * Average field values in each group
   */
  async avg<F extends NumericKeys<T>>(
    field: F,
    db: D1Database
  ): Promise<Array<Pick<InferSchema<T>, K> & { avg: number | null }>> {
    const whereClause = this.buildWhereClause()
    const whereParams = this.conditions
      .filter((c) => c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL')
      .map((c) => c.value)

    const groupDbField = escapeIdentifier(toSnakeCase(this.groupField))
    const avgDbField = escapeIdentifier(toSnakeCase(String(field)))
    const tailClauses = this.buildTailClauses()
    const sql = `SELECT ${groupDbField} as ${this.groupField}, AVG(${avgDbField}) as avg FROM ${escapeIdentifier(this.model.$tableName)}${whereClause} GROUP BY ${groupDbField}${tailClauses}`
    const stmt = db.prepare(sql).bind(...whereParams)
    const result = await stmt.all<Pick<InferSchema<T>, K> & { avg: number | null }>()

    return result.results
  }
}
