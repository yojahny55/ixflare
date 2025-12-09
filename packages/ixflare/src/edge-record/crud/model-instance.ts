/**
 * @module edge-record/crud/model-instance
 * @description ModelInstance class that wraps database records with CRUD methods
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import type { FieldConfig, FieldBuilder } from '@/edge-record/schema/field'
import { toSnakeCase, toCamelCase } from '@/edge-record/crud/case-transform'

/**
 * Helper to extract FieldConfig from schema entry (handles FieldBuilder)
 */
function getFieldConfig(schemaEntry: unknown): FieldConfig | undefined {
  if (!schemaEntry) return undefined
  // Schema entries are FieldBuilder instances with a .config property
  if (typeof schemaEntry === 'object' && 'config' in schemaEntry) {
    return (schemaEntry as FieldBuilder).config
  }
  return undefined
}
import {
  isD1Database,
  isKVNamespace,
  isDurableObjectStorage,
  type StorageBinding,
  type StorageTier,
} from '@/edge-record/storage/types'
import { KVAdapter } from '@/edge-record/storage/kv-adapter'
import { DOAdapter } from '@/edge-record/storage/do-adapter'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'

function getPkField<T extends SchemaDefinition>(model: Model<T>): keyof InferSchema<T> {
  const schema = model.$schema
  for (const key in schema) {
    const config = getFieldConfig(schema[key])
    if (config?.primaryKey) {
      return key as keyof InferSchema<T>
    }
  }
  return 'id' as keyof InferSchema<T>
}

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
   * Set the record ID (used internally by transaction after batch commit)
   * @internal
   */
  setId(id: number | string): this {
    ;(this._data as Record<string, unknown>)['id'] = id
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
  /**
   * Save the instance to database (INSERT if new, UPDATE if existing)
   */
  async save(db: StorageBinding): Promise<this> {
    const storage: StorageTier = this._model.$storage || 'd1'

    // Handle KV Storage
    if (storage === 'kv') {
      if (!isKVNamespace(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${this._model.$tableName}' has $storage='kv' but received incompatible binding. Expected KVNamespace.`
        )
      }
      this.updateTimestamps()
      const pkField = getPkField(this._model)
      const id = this._data[pkField]

      if (!id) throw new Error('Cannot save to KV: Primary key is missing')

      const adapter = new KVAdapter(this._model, db)
      await adapter.put(String(id), this._data)

      this._isNew = false
      this._original = { ...this._data }
      return this
    }

    // Handle Durable Objects Storage
    if (storage === 'do') {
      if (!isDurableObjectStorage(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${this._model.$tableName}' has $storage='do' but received incompatible binding. Expected DurableObjectStorage.`
        )
      }
      this.updateTimestamps()
      const pkField = getPkField(this._model)
      const id = this._data[pkField]

      if (!id) throw new Error('Cannot save to DO: Primary key is missing')

      const adapter = new DOAdapter(this._model, db)
      await adapter.put(String(id), this._data)

      this._isNew = false
      this._original = { ...this._data }
      return this
    }

    // Default: D1 Storage
    if (!isD1Database(db)) {
      // Check if we received KV/DO but wanted D1
      if (isKVNamespace(db) || isDurableObjectStorage(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${this._model.$tableName}' has $storage='d1' but received incompatible binding. Expected D1Database.`
        )
      }
      // If it's something else (like a mock) assume it's D1-compatible or let it fail naturally
    }
    const d1 = db as D1Database

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

      const stmt = d1.prepare(sql).bind(...dbValues)
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

        const stmt = d1.prepare(sql).bind(...values, this._data.id)
        await stmt.run()

        this._original = { ...this._data }
      }
    }

    return this
  }

  private updateTimestamps() {
    const now = Date.now()
    if (this._isNew && 'createdAt' in this._model.$schema) {
      ;(this._data as Record<string, unknown>)['createdAt'] = now
    }
    if ('updatedAt' in this._model.$schema) {
      ;(this._data as Record<string, unknown>)['updatedAt'] = now
    }
  }

  /**
   * Update fields and save to database
   */
  /**
   * Update fields and save to database
   */
  async update(data: Partial<InferSchema<T>>, db: StorageBinding, kv?: KVNamespace): Promise<this> {
    // Merge data first
    Object.assign(this._data, data)
    // Save handles routing and dirty tracking
    await this.save(db)

    // Invalidate cache if configured and KV provided
    if (this._model.$cacheConfig?.enabled && kv) {
      const pkField = getPkField(this._model)
      const id = this._data[pkField]
      if (id) {
        const cacheKey = `${this._model.$tableName}:${String(id)}`
        await kv.delete(cacheKey)
      }
    }

    return this
  }

  /**
   * Delete this record from database
   */
  /**
   * Delete this record from database
   */
  async delete(db: StorageBinding, kv?: KVNamespace): Promise<boolean> {
    const storage: StorageTier = this._model.$storage || 'd1'

    if (storage === 'kv') {
      if (!isKVNamespace(db)) throw new Error('Invalid DB binding for KV model')
      const pkField = getPkField(this._model)
      const id = this._data[pkField]
      if (id) {
        await new KVAdapter(this._model, db).delete(String(id))
        return true
      }
      return false
    }

    if (storage === 'do') {
      if (!isDurableObjectStorage(db)) throw new Error('Invalid DB binding for DO model')
      const pkField = getPkField(this._model)
      const id = this._data[pkField]
      if (id) {
        await new DOAdapter(this._model, db).delete(String(id))
        return true
      }
      return false
    }

    // D1
    const d1 = db as D1Database
    const sql = `DELETE FROM ${escapeIdentifier(this._model.$tableName)} WHERE id = ?`
    const stmt = d1.prepare(sql).bind(this._data.id)
    const result = await stmt.run()

    const wasDeleted = result.meta.changes > 0

    // Invalidate cache if configured and KV provided
    if (wasDeleted && this._model.$cacheConfig?.enabled && kv) {
      const pkField = getPkField(this._model)
      const id = this._data[pkField]
      if (id) {
        const cacheKey = `${this._model.$tableName}:${String(id)}`
        await kv.delete(cacheKey)
      }
    }

    return wasDeleted
  }

  /**
   * Serialize to JSON (returns camelCase API format)
   */
  toJSON(): InferSchema<T> {
    return { ...this._data }
  }

  /**
   * Transform snake_case DB columns to camelCase API with type conversion
   */
  private transformFromDb(data: Partial<InferSchema<T>>): Partial<InferSchema<T>> {
    const transformed: Record<string, unknown> = {}

    for (const key in data) {
      const camelKey = toCamelCase(key)
      const fieldConfig = getFieldConfig(this._model.$schema[camelKey])
      const value = data[key]

      if (fieldConfig) {
        transformed[camelKey] = this.fromD1Value(value, fieldConfig)
      } else {
        transformed[camelKey] = value
      }
    }

    return transformed as Partial<InferSchema<T>>
  }

  /**
   * Transform camelCase API to snake_case DB columns with type conversion
   */
  private transformToDb(data: Partial<InferSchema<T>>): Record<string, unknown> {
    const transformed: Record<string, unknown> = {}

    for (const key in data) {
      const snakeKey = toSnakeCase(key)
      const fieldConfig = getFieldConfig(this._model.$schema[key])
      const value = data[key]

      if (fieldConfig) {
        transformed[snakeKey] = this.toD1Value(value, fieldConfig.type)
      } else {
        transformed[snakeKey] = value
      }
    }

    return transformed
  }

  /**
   * Convert JavaScript value to D1-compatible value
   */
  private toD1Value(value: unknown, fieldType: string): unknown {
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
        return value

      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value)

      default:
        return value
    }
  }

  /**
   * Convert D1 value to JavaScript value
   */
  private fromD1Value(value: unknown, fieldConfig: FieldConfig): unknown {
    if (value === null || value === undefined) {
      return fieldConfig.nullable ? null : undefined
    }

    switch (fieldConfig.type) {
      case 'boolean':
        return value === 1 || value === true

      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value

      default:
        return value
    }
  }
}
