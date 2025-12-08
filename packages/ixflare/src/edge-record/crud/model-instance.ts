/**
 * @module edge-record/crud/model-instance
 * @description ModelInstance class that wraps database records with CRUD methods
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import { toSnakeCase, toCamelCase } from '@/edge-record/crud/case-transform'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'

/**
 * ModelInstance wraps a database record with instance methods
 * Provides automatic case transformation and dirty tracking
 *
 * @template T The schema definition type
 */
export class ModelInstance<T extends SchemaDefinition> {
  private _data: InferSchema<T>
  private _original: InferSchema<T>
  private _model: Model<T>
  private _isNew: boolean

  constructor(model: Model<T>, data: Partial<InferSchema<T>>, isNew: boolean = false) {
    this._model = model
    this._isNew = isNew

    // Transform snake_case DB columns to camelCase for API
    this._data = this.transformFromDb(data) as InferSchema<T>
    this._original = { ...this._data }
  }

  /**
   * Get field value by name
   */
  get<K extends keyof InferSchema<T>>(field: K): InferSchema<T>[K] {
    return this._data[field]
  }

  /**
   * Set field value by name
   */
  set<K extends keyof InferSchema<T>>(field: K, value: InferSchema<T>[K]): this {
    this._data[field] = value
    return this
  }

  /**
   * Check if any fields have been modified
   */
  isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0
  }

  /**
   * Get only the fields that have been modified
   */
  getDirty(): Partial<InferSchema<T>> {
    const dirty: Partial<InferSchema<T>> = {}

    for (const key in this._data) {
      if (this._data[key] !== this._original[key]) {
        dirty[key] = this._data[key]
      }
    }

    return dirty
  }

  /**
   * Save the instance to database (INSERT if new, UPDATE if existing)
   */
  async save(db: D1Database): Promise<this> {
    if (this._isNew) {
      // Set timestamps before building SQL
      const now = Date.now()
      if ('createdAt' in this._model.$schema) {
        ;(this._data as Record<string, unknown>)['createdAt'] = now
      }
      if ('updatedAt' in this._model.$schema) {
        ;(this._data as Record<string, unknown>)['updatedAt'] = now
      }

      // Transform to snake_case for DB
      const dbData = this.transformToDb(this._data)
      const dbFields = Object.keys(dbData).filter((k) => k !== 'id')
      const dbValues = dbFields.map((k) => dbData[k])

      const placeholders = dbFields.map(() => '?').join(', ')
      const escapedFields = dbFields.map((f) => escapeIdentifier(f)).join(', ')
      const sql = `INSERT INTO ${escapeIdentifier(this._model.$tableName)} (${escapedFields}) VALUES (${placeholders})`

      const stmt = db.prepare(sql).bind(...dbValues)
      const result = await stmt.run()

      if (result.meta.last_row_id) {
        ;(this._data as Record<string, unknown>)['id'] = result.meta.last_row_id
      }

      this._isNew = false
      this._original = { ...this._data }
    } else {
      // UPDATE existing record
      const dirty = this.getDirty()

      if (Object.keys(dirty).length > 0) {
        // Update updatedAt timestamp
        if ('updatedAt' in this._model.$schema) {
          const now = Date.now()
          ;(this._data as Record<string, unknown>)['updatedAt'] = now
          ;(dirty as Record<string, unknown>)['updatedAt'] = now
        }

        // Transform to snake_case for DB
        const dbDirty = this.transformToDb(dirty)
        const fields = Object.keys(dbDirty).filter((k) => k !== 'id')
        const values = fields.map((k) => dbDirty[k])

        const setClause = fields.map((f) => `${escapeIdentifier(f)} = ?`).join(', ')
        const sql = `UPDATE ${escapeIdentifier(this._model.$tableName)} SET ${setClause} WHERE id = ?`

        const stmt = db.prepare(sql).bind(...values, this._data.id)
        await stmt.run()

        this._original = { ...this._data }
      }
    }

    return this
  }

  /**
   * Update fields and save to database
   */
  async update(data: Partial<InferSchema<T>>, db: D1Database): Promise<this> {
    // Update updatedAt timestamp
    const now = Date.now()
    if ('updatedAt' in this._model.$schema) {
      ;(data as Record<string, unknown>)['updatedAt'] = now
    }

    // Merge data into instance
    Object.assign(this._data, data)

    // Transform to snake_case for DB
    const dbData = this.transformToDb(data)
    const fields = Object.keys(dbData).filter((k) => k !== 'id')
    const values = fields.map((k) => dbData[k])

    const setClause = fields.map((f) => `${escapeIdentifier(f)} = ?`).join(', ')
    const sql = `UPDATE ${escapeIdentifier(this._model.$tableName)} SET ${setClause} WHERE id = ?`

    const stmt = db.prepare(sql).bind(...values, this._data.id)
    await stmt.run()

    this._original = { ...this._data }

    return this
  }

  /**
   * Delete this record from database
   */
  async delete(db: D1Database): Promise<boolean> {
    const sql = `DELETE FROM ${escapeIdentifier(this._model.$tableName)} WHERE id = ?`
    const stmt = db.prepare(sql).bind(this._data.id)
    const result = await stmt.run()

    return result.meta.changes > 0
  }

  /**
   * Serialize to JSON (returns camelCase API format)
   */
  toJSON(): InferSchema<T> {
    return { ...this._data }
  }

  /**
   * Transform snake_case DB columns to camelCase API
   */
  private transformFromDb(data: Partial<InferSchema<T>>): Partial<InferSchema<T>> {
    const transformed: Record<string, unknown> = {}

    for (const key in data) {
      const camelKey = toCamelCase(key)
      transformed[camelKey] = data[key]
    }

    return transformed as Partial<InferSchema<T>>
  }

  /**
   * Transform camelCase API to snake_case DB columns
   */
  private transformToDb(data: Partial<InferSchema<T>>): Record<string, unknown> {
    const transformed: Record<string, unknown> = {}

    for (const key in data) {
      const snakeKey = toSnakeCase(key)
      transformed[snakeKey] = data[key]
    }

    return transformed
  }
}
