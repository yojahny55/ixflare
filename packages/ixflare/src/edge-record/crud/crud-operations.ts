/**
 * @module edge-record/crud/crud-operations
 * @description Static CRUD operations for EdgeRecord models
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import type { FieldConfig, FieldBuilder } from '@/edge-record/schema/field'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import { NotFoundError } from '@/edge-record/crud/errors'
import { toSnakeCase } from '@/edge-record/crud/case-transform'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'
import {
  isD1Database,
  isKVNamespace,
  isDurableObjectStorage,
  type Database,
} from '@/edge-record/storage/types'
import { KVAdapter } from '@/edge-record/storage/kv-adapter'
import { DOAdapter } from '@/edge-record/storage/do-adapter'

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

/**
 * Convert JavaScript value to D1-compatible value
 */
function toD1Value(value: unknown, fieldType: string): unknown {
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
 * Input type for create operations (excludes auto-generated fields)
 */
export type CreateInput<T extends SchemaDefinition> = Omit<
  InferSchema<T>,
  'id' | 'createdAt' | 'updatedAt'
>

/**
 * Input type for update operations
 */
export type UpdateInput<T extends SchemaDefinition> = Partial<Omit<InferSchema<T>, 'id'>>

/**
 * Create a new record in the database
 *
 * @template T The schema definition type
 * @param model The model definition
 * @param data The data to insert (excluding id, createdAt, updatedAt)
 * @param db The D1Database instance
 * @returns ModelInstance with the created record
 *
 * @example
 * ```typescript
 * const user = await create(User, {
 *   email: 'alex@example.com',
 *   name: 'Alex Rivera'
 * }, env.DB)
 * ```
 */
export async function create<T extends SchemaDefinition>(
  model: Model<T>,
  data: CreateInput<T>,
  db: Database
): Promise<ModelInstance<T>> {
  // Create instance marked as new
  const instance = new ModelInstance(model, data as Partial<InferSchema<T>>, true)

  // Save will handle INSERT, timestamps, and case transformation
  await instance.save(db)

  return instance
}

/**
 * Find a record by ID
 *
 * Respects soft delete filter: if model has soft deletes enabled,
 * soft-deleted records are excluded by default. Use QueryBuilder.withTrashed()
 * to include soft-deleted records.
 *
 * @template T The schema definition type
 * @param model The model definition
 * @param id The record ID to find
 * @param db The D1Database instance
 * @param options Optional parameters
 * @param options.withTrashed Include soft-deleted records (default: false)
 * @returns ModelInstance or null if not found
 *
 * @example
 * ```typescript
 * const user = await find(User, 1, env.DB)
 * if (user) {
 *   console.log(user.get('email'))
 * }
 *
 * // Include soft-deleted records
 * const deletedUser = await find(User, 1, env.DB, { withTrashed: true })
 * ```
 */
export async function find<T extends SchemaDefinition>(
  model: Model<T>,
  id: number | string,
  db: Database,
  options?: { withTrashed?: boolean }
): Promise<ModelInstance<T> | null> {
  const storage = model.$storage || 'd1'

  // KV
  if (storage === 'kv') {
    if (!isKVNamespace(db)) throw new Error('Invalid DB binding for KV model')
    const adapter = new KVAdapter(model, db)
    const result = await adapter.get(String(id))
    if (!result) return null
    return new ModelInstance(model, result as Partial<InferSchema<T>>, false)
  }

  // DO
  if (storage === 'do') {
    if (!isDurableObjectStorage(db)) throw new Error('Invalid DB binding for DO model')
    const adapter = new DOAdapter(model, db)
    const result = await adapter.get(String(id))
    if (!result) return null
    return new ModelInstance(model, result as Partial<InferSchema<T>>, false)
  }

  // D1
  if (!isD1Database(db)) {
    // Fallback safety
    throw new Error(`Model ${model.$tableName} expects D1Database`)
  }

  // Build SQL with soft delete filter if applicable
  let sql = `SELECT * FROM ${escapeIdentifier(model.$tableName)} WHERE id = ?`

  // Apply soft delete filter if model has soft deletes enabled and not bypassed
  const softDeletes = model.$softDeletes
  if (softDeletes && !options?.withTrashed) {
    sql += ' AND "deleted_at" IS NULL'
  }

  const stmt = db.prepare(sql).bind(id)
  const row = await stmt.first<Record<string, unknown>>()

  if (!row) {
    return null
  }

  // Create instance from existing record
  return new ModelInstance(model, row as Partial<InferSchema<T>>, false)
}

/**
 * Find a record by ID or throw NotFoundError
 *
 * Respects soft delete filter: if model has soft deletes enabled,
 * soft-deleted records are excluded by default.
 *
 * @template T The schema definition type
 * @param model The model definition
 * @param id The record ID to find
 * @param db The D1Database instance
 * @param options Optional parameters
 * @param options.withTrashed Include soft-deleted records (default: false)
 * @returns ModelInstance (never null)
 * @throws NotFoundError if record not found
 *
 * @example
 * ```typescript
 * try {
 *   const user = await findOrFail(User, 1, env.DB)
 *   console.log(user.get('email'))
 * } catch (err) {
 *   if (err instanceof NotFoundError) {
 *     // Handle not found
 *   }
 * }
 * ```
 */
export async function findOrFail<T extends SchemaDefinition>(
  model: Model<T>,
  id: number | string,
  db: Database,
  options?: { withTrashed?: boolean }
): Promise<ModelInstance<T>> {
  const result = await find(model, id, db, options)

  if (!result) {
    throw new NotFoundError(
      `${model.$tableName.toUpperCase()}.NOT_FOUND`,
      `${model.$tableName} with id ${id} not found`
    )
  }

  return result
}

/**
 * Create or update a record based on match criteria (upsert)
 *
 * **WARNING: Race Condition**
 * This function uses SELECT-then-INSERT/UPDATE which is NOT atomic.
 * Concurrent calls with the same match criteria may create duplicates.
 *
 * For atomic upserts on unique columns, use {@link upsertAtomic} instead,
 * which uses SQLite's `INSERT ... ON CONFLICT` syntax.
 *
 * Respects soft delete filter: soft-deleted records are excluded from matching
 * by default, so upserting will create a new record if the only match is soft-deleted.
 *
 * @template T The schema definition type
 * @param model The model definition
 * @param match Fields to match on to find existing record
 * @param values Values to set (create or update)
 * @param db The D1Database instance
 * @param options Optional parameters
 * @param options.withTrashed Include soft-deleted records in match (default: false)
 * @returns ModelInstance (created or updated)
 *
 * @example
 * ```typescript
 * const user = await upsert(
 *   User,
 *   { email: 'alex@example.com' },  // Match on email
 *   { name: 'Alex Rivera', role: 'user' },  // Set these values
 *   env.DB
 * )
 * ```
 */
export async function upsert<T extends SchemaDefinition>(
  model: Model<T>,
  match: Partial<InferSchema<T>>,
  values: Partial<InferSchema<T>>,
  db: Database,
  options?: { withTrashed?: boolean }
): Promise<ModelInstance<T>> {
  const storage = model.$storage || 'd1'

  if (storage !== 'd1') {
    // For KV/DO, assuming match contains ID.
    // This simplified logic mirrors update() or create().
    // Since upsert() implies logic based on match criteria...
    if (!isD1Database(db)) {
      // If we are here, we should probably check if ID is in match
      // But for now let's just create() which handles upsert-like behavior on KV
      // Assuming values combined with match has ID.
      const merged = { ...match, ...values } as CreateInput<T>
      return create(model, merged, db)
    }
  }

  // D1 Logic
  const d1 = db as D1Database

  // Try to find existing record
  const matchFields = Object.keys(match)
  const matchValues = matchFields.map((k) => match[k as keyof InferSchema<T>])

  let whereClause = matchFields.map((f) => `${escapeIdentifier(toSnakeCase(f))} = ?`).join(' AND ')

  // Apply soft delete filter if model has soft deletes enabled and not bypassed
  if (model.$softDeletes && !options?.withTrashed) {
    whereClause += ` AND ${escapeIdentifier('deleted_at')} IS NULL`
  }

  const sql = `SELECT * FROM ${escapeIdentifier(model.$tableName)} WHERE ${whereClause}`
  const stmt = d1.prepare(sql).bind(...matchValues)
  const existing = await stmt.first<Record<string, unknown>>()

  if (existing) {
    // UPDATE existing record
    const instance = new ModelInstance(model, existing as Partial<InferSchema<T>>, false)
    await instance.update(values, db)
    return instance
  } else {
    // INSERT new record
    const mergedData = { ...match, ...values } as CreateInput<T>
    return await create(model, mergedData, db)
  }
}

/**
 * Atomic upsert using SQLite's INSERT ... ON CONFLICT syntax
 *
 * This is the preferred method for upserts when the conflict column(s) have
 * a UNIQUE constraint. It's atomic and safe for concurrent operations.
 *
 * @template T The schema definition type
 * @param model The model definition
 * @param conflictColumns Column(s) with UNIQUE constraint to detect conflicts
 * @param data All data to insert (or update on conflict)
 * @param db The D1Database instance
 * @returns ModelInstance (created or updated)
 *
 * @example
 * ```typescript
 * // Table must have UNIQUE constraint on email column
 * const user = await upsertAtomic(
 *   User,
 *   ['email'],  // Conflict detection column(s)
 *   { email: 'alex@example.com', name: 'Alex Rivera', role: 'user' },
 *   env.DB
 * )
 * ```
 */
export async function upsertAtomic<T extends SchemaDefinition>(
  model: Model<T>,
  conflictColumns: Array<keyof InferSchema<T>>,
  data: CreateInput<T>,
  db: Database
): Promise<ModelInstance<T>> {
  if (!isD1Database(db)) {
    throw new Error('upsertAtomic only supports D1Database')
  }
  const d1 = db as D1Database
  const now = Date.now()

  // Prepare data with timestamps
  const dataWithTimestamps: Partial<InferSchema<T>> = { ...data } as Partial<InferSchema<T>>
  if ('createdAt' in model.$schema) {
    ;(dataWithTimestamps as Record<string, unknown>)['createdAt'] = now
  }
  if ('updatedAt' in model.$schema) {
    ;(dataWithTimestamps as Record<string, unknown>)['updatedAt'] = now
  }

  // Transform to snake_case for DB with type conversion
  const dbData: Record<string, unknown> = {}
  for (const key in dataWithTimestamps) {
    const snakeKey = toSnakeCase(key)
    const fieldConfig = getFieldConfig(model.$schema[key])
    const value = dataWithTimestamps[key]
    dbData[snakeKey] = fieldConfig ? toD1Value(value, fieldConfig.type) : value
  }

  const dbFields = Object.keys(dbData)
  const dbValues = dbFields.map((f) => dbData[f])

  // Build INSERT ... ON CONFLICT ... DO UPDATE SQL
  const placeholders = dbFields.map(() => '?').join(', ')
  const escapedFields = dbFields.map((f) => escapeIdentifier(f)).join(', ')
  const conflictCols = conflictColumns
    .map((c) => escapeIdentifier(toSnakeCase(c as string)))
    .join(', ')

  // Build SET clause for update (exclude conflict columns and id)
  const updateFields = dbFields.filter((f) => {
    const camelKey = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    return (
      !conflictColumns.includes(camelKey as keyof InferSchema<T>) &&
      f !== 'id' &&
      f !== 'created_at'
    )
  })
  const setClause = updateFields
    .map((f) => `${escapeIdentifier(f)} = excluded.${escapeIdentifier(f)}`)
    .join(', ')

  const sql = `INSERT INTO ${escapeIdentifier(model.$tableName)} (${escapedFields}) VALUES (${placeholders}) ON CONFLICT(${conflictCols}) DO UPDATE SET ${setClause}`

  const stmt = d1.prepare(sql).bind(...dbValues)
  await stmt.run()

  // Fetch the created/updated record to get the ID
  const conflictWhere = conflictColumns
    .map((c) => `${escapeIdentifier(toSnakeCase(c as string))} = ?`)
    .join(' AND ')
  const conflictValues = conflictColumns.map((c) => dbData[toSnakeCase(c as string)])

  const fetchSql = `SELECT * FROM ${escapeIdentifier(model.$tableName)} WHERE ${conflictWhere}`
  const fetchStmt = d1.prepare(fetchSql).bind(...conflictValues)
  const row = await fetchStmt.first<Record<string, unknown>>()

  if (!row) {
    throw new Error(`Failed to fetch upserted record from ${model.$tableName}`)
  }

  return new ModelInstance(model, row as Partial<InferSchema<T>>, false)
}

/**
 * D1 batch limit - maximum statements per batch call
 * D1 enforces a limit of 100 statements per batch operation
 */
const D1_BATCH_LIMIT = 100

/**
 * Bulk insert multiple records
 *
 * Automatically handles D1's 100 statement batch limit by splitting
 * large inserts into multiple batch calls.
 *
 * @template T The schema definition type
 * @param model The model definition
 * @param records Array of records to insert
 * @param db The D1Database instance
 * @returns Array of ModelInstances
 *
 * @example
 * ```typescript
 * const users = await createMany(User, [
 *   { email: 'user1@example.com', name: 'User 1' },
 *   { email: 'user2@example.com', name: 'User 2' },
 *   { email: 'user3@example.com', name: 'User 3' },
 * ], env.DB)
 * ```
 */
export async function createMany<T extends SchemaDefinition>(
  model: Model<T>,
  records: Array<CreateInput<T>>,
  db: Database
): Promise<ModelInstance<T>[]> {
  if (records.length === 0) {
    return []
  }

  const storage = model.$storage || 'd1'
  if (storage !== 'd1') {
    // Sequential create for KV/DO
    const instances: ModelInstance<T>[] = []
    for (const record of records) {
      instances.push(await create(model, record, db))
    }
    return instances
  }

  const d1 = db as D1Database

  const now = Date.now()
  const allStatements: D1PreparedStatement[] = []
  const recordsWithTimestamps: Array<Partial<InferSchema<T>>> = []

  for (const record of records) {
    // Add timestamps
    const dataWithTimestamps: Partial<InferSchema<T>> = { ...record } as Partial<InferSchema<T>>
    if ('createdAt' in model.$schema) {
      ;(dataWithTimestamps as Record<string, unknown>)['createdAt'] = now
    }
    if ('updatedAt' in model.$schema) {
      ;(dataWithTimestamps as Record<string, unknown>)['updatedAt'] = now
    }
    recordsWithTimestamps.push(dataWithTimestamps)

    // Transform to snake_case for DB with type conversion
    const dbData: Record<string, unknown> = {}
    for (const key in dataWithTimestamps) {
      const snakeKey = toSnakeCase(key)
      const fieldConfig = getFieldConfig(model.$schema[key])
      const value = dataWithTimestamps[key]
      dbData[snakeKey] = fieldConfig ? toD1Value(value, fieldConfig.type) : value
    }

    const dbFields = Object.keys(dbData)
    const dbValues = dbFields.map((f) => dbData[f])

    const placeholders = dbFields.map(() => '?').join(', ')
    const escapedFields = dbFields.map((f) => escapeIdentifier(f)).join(', ')
    const sql = `INSERT INTO ${escapeIdentifier(model.$tableName)} (${escapedFields}) VALUES (${placeholders})`

    allStatements.push(d1.prepare(sql).bind(...dbValues))
  }

  // Execute in batches to respect D1's 100 statement limit
  const allResults: D1Result<unknown>[] = []
  for (let i = 0; i < allStatements.length; i += D1_BATCH_LIMIT) {
    const batch = allStatements.slice(i, i + D1_BATCH_LIMIT)
    const batchResults = await d1.batch(batch)
    allResults.push(...batchResults)
  }

  // Create ModelInstances with returned IDs
  return records.map((record, index) => {
    const id = allResults[index].meta.last_row_id
    const dataWithId = { ...record, id, createdAt: now, updatedAt: now } as Partial<InferSchema<T>>
    return new ModelInstance(model, dataWithId, false)
  })
}
