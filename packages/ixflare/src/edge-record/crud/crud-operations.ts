/**
 * @module edge-record/crud/crud-operations
 * @description Static CRUD operations for EdgeRecord models
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import { NotFoundError } from '@/edge-record/crud/errors'
import { toSnakeCase } from '@/edge-record/crud/case-transform'

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
  db: D1Database
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
 * @template T The schema definition type
 * @param model The model definition
 * @param id The record ID to find
 * @param db The D1Database instance
 * @returns ModelInstance or null if not found
 *
 * @example
 * ```typescript
 * const user = await find(User, 1, env.DB)
 * if (user) {
 *   console.log(user.get('email'))
 * }
 * ```
 */
export async function find<T extends SchemaDefinition>(
  model: Model<T>,
  id: number,
  db: D1Database
): Promise<ModelInstance<T> | null> {
  const sql = `SELECT * FROM ${model.$tableName} WHERE id = ?`
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
 * @template T The schema definition type
 * @param model The model definition
 * @param id The record ID to find
 * @param db The D1Database instance
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
  id: number,
  db: D1Database
): Promise<ModelInstance<T>> {
  const result = await find(model, id, db)

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
 * @template T The schema definition type
 * @param model The model definition
 * @param match Fields to match on to find existing record
 * @param values Values to set (create or update)
 * @param db The D1Database instance
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
  db: D1Database
): Promise<ModelInstance<T>> {
  // Try to find existing record
  const matchFields = Object.keys(match)
  const matchValues = matchFields.map((k) => match[k as keyof InferSchema<T>])

  const whereClause = matchFields.map((f) => `${toSnakeCase(f)} = ?`).join(' AND ')
  const sql = `SELECT * FROM ${model.$tableName} WHERE ${whereClause}`
  const stmt = db.prepare(sql).bind(...matchValues)
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
 * Bulk insert multiple records
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
  db: D1Database
): Promise<ModelInstance<T>[]> {
  const now = Date.now()
  const statements: D1PreparedStatement[] = []

  for (const record of records) {
    // Add timestamps
    const dataWithTimestamps: Partial<InferSchema<T>> = { ...record } as Partial<InferSchema<T>>
    if ('createdAt' in model.$schema) {
      ;(dataWithTimestamps as Record<string, unknown>)['createdAt'] = now
    }
    if ('updatedAt' in model.$schema) {
      ;(dataWithTimestamps as Record<string, unknown>)['updatedAt'] = now
    }

    // Transform to snake_case for DB
    const dbData: Record<string, unknown> = {}
    for (const key in dataWithTimestamps) {
      dbData[toSnakeCase(key)] = dataWithTimestamps[key]
    }

    const dbFields = Object.keys(dbData)
    const dbValues = dbFields.map((f) => dbData[f])

    const placeholders = dbFields.map(() => '?').join(', ')
    const sql = `INSERT INTO ${model.$tableName} (${dbFields.join(', ')}) VALUES (${placeholders})`

    statements.push(db.prepare(sql).bind(...dbValues))
  }

  // Execute batch
  const results = await db.batch(statements)

  // Create ModelInstances with returned IDs
  return records.map((record, index) => {
    const id = results[index].meta.last_row_id
    const dataWithId = { ...record, id, createdAt: now, updatedAt: now } as Partial<InferSchema<T>>
    return new ModelInstance(model, dataWithId, false)
  })
}
