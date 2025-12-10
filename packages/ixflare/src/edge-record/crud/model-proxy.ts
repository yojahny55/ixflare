/**
 * @module edge-record/crud/model-proxy
 * @description Proxy that adds static CRUD methods to Model objects with storage-aware dispatch
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import type { CreateInput } from '@/edge-record/crud/crud-operations'
import type { ModelInstance } from '@/edge-record/crud/model-instance'
import type { Database } from '@/edge-record/storage/types'
import { QueryBuilder, type WhereOperator, type WhereConditions } from '@/edge-record/query-builder'
import { create, find, upsert, createMany } from '@/edge-record/crud/crud-operations'
import { KVAdapter } from '@/edge-record/storage/kv-adapter'
import { DOAdapter } from '@/edge-record/storage/do-adapter'
import { CacheLayer } from '@/edge-record/storage/cache-layer'
import { isD1Database, isKVNamespace, isDurableObjectStorage } from '@/edge-record/storage/types'
import { ModelInstance as ModelInstanceClass } from '@/edge-record/crud/model-instance'
import { NotFoundError } from '@/edge-record/crud/errors'

/**
 * CRUD methods interface added to Model
 *
 * Storage-aware: Methods accept any StorageBinding and route automatically
 * based on model.$storage tier.
 */
export interface ModelCrudMethods<T extends SchemaDefinition> {
  /**
   * Create a new record
   *
   * @param data Record data (excluding id, createdAt, updatedAt)
   * @param db Storage binding (D1Database, KVNamespace, or DurableObjectStorage)
   */
  create(data: CreateInput<T>, db: Database): Promise<ModelInstance<T>>

  /**
   * Find record by ID (returns null if not found)
   *
   * @param id Record ID (number for D1, string for KV/DO)
   * @param db Storage binding
   * @param kv Optional KV namespace for caching (if model has cache enabled)
   * @param options Optional parameters (e.g., cache bypass)
   */
  find(
    id: number | string,
    db: Database,
    kv?: KVNamespace,
    options?: { cache?: boolean }
  ): Promise<ModelInstance<T> | null>

  /**
   * Find record by ID or throw NotFoundError
   *
   * @param id Record ID
   * @param db Storage binding
   * @param kv Optional KV namespace for caching (if model has cache enabled)
   * @param options Optional parameters (e.g., cache bypass)
   */
  findOrFail(
    id: number | string,
    db: Database,
    kv?: KVNamespace,
    options?: { cache?: boolean }
  ): Promise<ModelInstance<T>>

  /**
   * Create query builder for WHERE queries
   *
   * Note: Query builder only works with D1 storage. For KV/DO,
   * use direct adapter methods or find() by key.
   *
   * @example
   * ```typescript
   * // Object notation (D1 only)
   * User.where({ role: 'admin' })
   *
   * // Two-argument notation
   * User.where('email', 'test@example.com')
   *
   * // Three-argument notation with comparison operator
   * User.where('createdAt', '>', Date.now() - 86400000)
   * ```
   */
  where(conditions: WhereConditions<T>): QueryBuilder<T>
  where<K extends keyof InferSchema<T>>(field: K, value: InferSchema<T>[K]): QueryBuilder<T>
  where<K extends keyof InferSchema<T>>(
    field: K,
    operator: WhereOperator,
    value: unknown
  ): QueryBuilder<T>

  /**
   * Eager load relationships (D1 only)
   *
   * @example
   * ```typescript
   * const users = await User.with('posts').all(db)
   * ```
   */
  with(...relations: string[]): QueryBuilder<T>

  /**
   * Include soft-deleted records in query
   *
   * @example
   * ```typescript
   * const allUsers = await User.withTrashed().all(db)
   * ```
   */
  withTrashed(): QueryBuilder<T>

  /**
   * Only return soft-deleted records
   *
   * @example
   * ```typescript
   * const deletedUsers = await User.onlyTrashed().all(db)
   * ```
   */
  onlyTrashed(): QueryBuilder<T>

  /**
   * Upsert a record (create or update based on match)
   *
   * Note: For KV/DO, this does a simple put (overwrites by key)
   */
  upsert(
    match: Partial<InferSchema<T>>,
    values: Partial<InferSchema<T>>,
    db: Database
  ): Promise<ModelInstance<T>>

  /**
   * Bulk insert records (D1 only - uses batch operations)
   *
   * For KV/DO, records are inserted sequentially
   */
  createMany(records: CreateInput<T>[], db: Database): Promise<ModelInstance<T>[]>

  /**
   * Delete a record by ID
   *
   * @param id Record ID
   * @param db Storage binding
   */
  delete(id: number | string, db: Database): Promise<void>

  /**
   * Permanently delete a record by ID (bypass soft deletes)
   *
   * @param id Record ID
   * @param db Storage binding
   */
  forceDelete(id: number | string, db: Database): Promise<void>

  /**
   * Manually invalidate a cache entry
   *
   * @param id Record ID
   * @param kv KV namespace for cache
   */
  invalidateCache(id: string | number, kv: KVNamespace): Promise<void>

  /**
   * Warm cache for multiple IDs
   *
   * @param ids Array of IDs to warm
   * @param db D1 database for source data
   * @param kv KV namespace for cache
   */
  warmCache(ids: (string | number)[], db: D1Database, kv: KVNamespace): Promise<void>
}

/**
 * Model with CRUD methods attached
 */
export type ModelWithCrud<T extends SchemaDefinition> = Model<T> & ModelCrudMethods<T>

/**
 * Get the primary key field name from schema
 */
function getPrimaryKeyField<T extends SchemaDefinition>(model: Model<T>): string {
  for (const [fieldName, field] of Object.entries(model.$schema)) {
    if (field.config?.primaryKey) {
      return fieldName
    }
  }
  return 'id' // Default
}

/**
 * Create a proxy that adds CRUD methods to a Model with storage-aware dispatch
 */
export function createModelProxy<T extends SchemaDefinition>(model: Model<T>): ModelWithCrud<T> {
  const crudMethods: ModelCrudMethods<T> = {
    async create(data: CreateInput<T>, db: Database): Promise<ModelInstance<T>> {
      const tier = model.$storage

      if (tier === 'kv' && isKVNamespace(db)) {
        const adapter = new KVAdapter(model, db)
        const pkField = getPrimaryKeyField(model)
        const id = (data as Record<string, unknown>)[pkField] as string

        if (!id) {
          throw new Error(
            `KV storage requires a primary key value in data. Missing field: ${pkField}`
          )
        }

        await adapter.put(id, data as Partial<InferSchema<T>>)
        return new ModelInstanceClass(
          model,
          { ...data, [pkField]: id } as Partial<InferSchema<T>>,
          false
        )
      }

      if (tier === 'do' && isDurableObjectStorage(db)) {
        const adapter = new DOAdapter(model, db)
        const pkField = getPrimaryKeyField(model)
        const id = (data as Record<string, unknown>)[pkField] as string

        if (!id) {
          throw new Error(
            `DO storage requires a primary key value in data. Missing field: ${pkField}`
          )
        }

        await adapter.put(id, data as Partial<InferSchema<T>>)
        return new ModelInstanceClass(
          model,
          { ...data, [pkField]: id } as Partial<InferSchema<T>>,
          false
        )
      }

      // Default to D1
      if (!isD1Database(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${model.$tableName}' has $storage='${tier}' but received incompatible binding. ` +
            `Expected ${tier === 'kv' ? 'KVNamespace' : tier === 'do' ? 'DurableObjectStorage' : 'D1Database'}.`
        )
      }
      return create(model, data, db)
    },

    async find(
      id: number | string,
      db: Database,
      kv?: KVNamespace,
      options?: { cache?: boolean }
    ): Promise<ModelInstance<T> | null> {
      const tier = model.$storage
      const cacheConfig = model.$cacheConfig
      const shouldCache = options?.cache !== false && cacheConfig?.enabled && kv

      // For D1 storage with caching enabled
      if (tier === 'd1' && isD1Database(db) && shouldCache) {
        const cacheLayer = new CacheLayer(model, kv!, db, cacheConfig!)
        const result = await cacheLayer.get(id)
        if (!result) return null
        return new ModelInstanceClass(model, result as Partial<InferSchema<T>>, false)
      }

      // KV storage (native KV adapter, no caching layer)
      if (tier === 'kv' && isKVNamespace(db)) {
        const adapter = new KVAdapter(model, db)
        const result = await adapter.get(String(id))
        if (!result) return null
        return new ModelInstanceClass(model, result as Partial<InferSchema<T>>, false)
      }

      // Durable Objects storage
      if (tier === 'do' && isDurableObjectStorage(db)) {
        const adapter = new DOAdapter(model, db)
        const result = await adapter.get(String(id))
        if (!result) return null
        return new ModelInstanceClass(model, result as Partial<InferSchema<T>>, false)
      }

      // Default to D1 without cache
      if (!isD1Database(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${model.$tableName}' has $storage='${tier}' but received incompatible binding.`
        )
      }
      return find(model, id as number, db)
    },

    async findOrFail(
      id: number | string,
      db: Database,
      kv?: KVNamespace,
      options?: { cache?: boolean }
    ): Promise<ModelInstance<T>> {
      const result = await this.find(id, db, kv, options)

      if (!result) {
        throw new NotFoundError(
          `${model.$tableName.toUpperCase()}.NOT_FOUND`,
          `${model.$tableName} with id ${id} not found`
        )
      }

      return result
    },

    where(
      fieldOrConditions: keyof InferSchema<T> | WhereConditions<T>,
      operatorOrValue?: WhereOperator | unknown,
      value?: unknown
    ): QueryBuilder<T> {
      // QueryBuilder only works with D1
      if (model.$storage !== 'd1') {
        console.warn(
          `[EdgeRecord] QueryBuilder.where() is designed for D1 storage. ` +
            `Model '${model.$tableName}' uses '${model.$storage}' storage. ` +
            `Consider using find() with key lookup instead.`
        )
      }

      const qb = new QueryBuilder(model)

      if (typeof fieldOrConditions === 'object') {
        return qb.where(fieldOrConditions)
      } else if (value !== undefined) {
        return qb.where(fieldOrConditions, operatorOrValue as WhereOperator, value)
      } else if (operatorOrValue !== undefined) {
        return qb.where(fieldOrConditions, operatorOrValue as InferSchema<T>[keyof InferSchema<T>])
      } else {
        return qb
      }
    },

    with(...relations: string[]): QueryBuilder<T> {
      if (model.$storage !== 'd1') {
        console.warn(
          `[EdgeRecord] Eager loading with() only works with D1 storage. ` +
            `Model '${model.$tableName}' uses '${model.$storage}' storage.`
        )
      }
      const qb = new QueryBuilder(model)
      return qb.with(...relations)
    },

    withTrashed(): QueryBuilder<T> {
      if (model.$storage !== 'd1') {
        console.warn(
          `[EdgeRecord] withTrashed() only works with D1 storage. ` +
            `Model '${model.$tableName}' uses '${model.$storage}' storage.`
        )
      }
      const qb = new QueryBuilder(model)
      return qb.withTrashed()
    },

    onlyTrashed(): QueryBuilder<T> {
      if (model.$storage !== 'd1') {
        console.warn(
          `[EdgeRecord] onlyTrashed() only works with D1 storage. ` +
            `Model '${model.$tableName}' uses '${model.$storage}' storage.`
        )
      }
      const qb = new QueryBuilder(model)
      return qb.onlyTrashed()
    },

    async upsert(
      match: Partial<InferSchema<T>>,
      values: Partial<InferSchema<T>>,
      db: Database
    ): Promise<ModelInstance<T>> {
      const tier = model.$storage

      if (tier === 'kv' && isKVNamespace(db)) {
        const adapter = new KVAdapter(model, db)
        const pkField = getPrimaryKeyField(model)
        const id = (match as Record<string, unknown>)[pkField] as string

        if (!id) {
          throw new Error(
            `KV upsert requires primary key in match criteria. Missing field: ${pkField}`
          )
        }

        const merged = { ...match, ...values }
        await adapter.put(id, merged as Partial<InferSchema<T>>)
        return new ModelInstanceClass(model, merged as Partial<InferSchema<T>>, false)
      }

      if (tier === 'do' && isDurableObjectStorage(db)) {
        const adapter = new DOAdapter(model, db)
        const pkField = getPrimaryKeyField(model)
        const id = (match as Record<string, unknown>)[pkField] as string

        if (!id) {
          throw new Error(
            `DO upsert requires primary key in match criteria. Missing field: ${pkField}`
          )
        }

        const merged = { ...match, ...values }
        await adapter.put(id, merged as Partial<InferSchema<T>>)
        return new ModelInstanceClass(model, merged as Partial<InferSchema<T>>, false)
      }

      // Default to D1
      if (!isD1Database(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${model.$tableName}' has $storage='${tier}' but received incompatible binding.`
        )
      }
      return upsert(model, match, values, db)
    },

    async createMany(records: CreateInput<T>[], db: Database): Promise<ModelInstance<T>[]> {
      const tier = model.$storage

      if (tier === 'kv' && isKVNamespace(db)) {
        const adapter = new KVAdapter(model, db)
        const pkField = getPrimaryKeyField(model)
        const instances: ModelInstance<T>[] = []

        for (const record of records) {
          const id = (record as Record<string, unknown>)[pkField] as string
          if (!id) {
            throw new Error(
              `KV createMany requires primary key in each record. Missing field: ${pkField}`
            )
          }
          await adapter.put(id, record as Partial<InferSchema<T>>)
          instances.push(new ModelInstanceClass(model, record as Partial<InferSchema<T>>, false))
        }
        return instances
      }

      if (tier === 'do' && isDurableObjectStorage(db)) {
        const adapter = new DOAdapter(model, db)
        const pkField = getPrimaryKeyField(model)
        const instances: ModelInstance<T>[] = []

        for (const record of records) {
          const id = (record as Record<string, unknown>)[pkField] as string
          if (!id) {
            throw new Error(
              `DO createMany requires primary key in each record. Missing field: ${pkField}`
            )
          }
          await adapter.put(id, record as Partial<InferSchema<T>>)
          instances.push(new ModelInstanceClass(model, record as Partial<InferSchema<T>>, false))
        }
        return instances
      }

      // Default to D1
      if (!isD1Database(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${model.$tableName}' has $storage='${tier}' but received incompatible binding.`
        )
      }
      return createMany(model, records, db)
    },

    async delete(id: number | string, db: Database): Promise<void> {
      const tier = model.$storage

      // Soft delete for D1 with soft deletes enabled
      if (tier === 'd1' && model.$softDeletes && isD1Database(db)) {
        const now = Date.now()
        const { escapeIdentifier } = await import('@/edge-record/schema/type-mapping')

        const updates: string[] = ['deleted_at = ?']
        const params: unknown[] = [now]

        if ('updatedAt' in model.$schema) {
          updates.push('updated_at = ?')
          params.push(now)
        }

        const sql = `UPDATE ${escapeIdentifier(model.$tableName)} SET ${updates.join(', ')} WHERE id = ?`
        await db
          .prepare(sql)
          .bind(...params, id)
          .run()
        return
      }

      if (tier === 'kv' && isKVNamespace(db)) {
        const adapter = new KVAdapter(model, db)
        await adapter.delete(String(id))
        return
      }

      if (tier === 'do' && isDurableObjectStorage(db)) {
        const adapter = new DOAdapter(model, db)
        await adapter.delete(String(id))
        return
      }

      // Default to D1 hard delete (soft deletes not enabled)
      if (!isD1Database(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${model.$tableName}' has $storage='${tier}' but received incompatible binding.`
        )
      }

      const { escapeIdentifier } = await import('@/edge-record/schema/type-mapping')
      const sql = `DELETE FROM ${escapeIdentifier(model.$tableName)} WHERE id = ?`
      await db.prepare(sql).bind(id).run()
    },

    async forceDelete(id: number | string, db: Database): Promise<void> {
      const tier = model.$storage

      if (tier === 'kv' && isKVNamespace(db)) {
        const adapter = new KVAdapter(model, db)
        await adapter.delete(String(id))
        return
      }

      if (tier === 'do' && isDurableObjectStorage(db)) {
        const adapter = new DOAdapter(model, db)
        await adapter.delete(String(id))
        return
      }

      // Default to D1 - always hard delete regardless of soft deletes setting
      if (!isD1Database(db)) {
        throw new Error(
          `Storage tier mismatch: Model '${model.$tableName}' has $storage='${tier}' but received incompatible binding.`
        )
      }

      const { escapeIdentifier } = await import('@/edge-record/schema/type-mapping')
      const sql = `DELETE FROM ${escapeIdentifier(model.$tableName)} WHERE id = ?`
      await db.prepare(sql).bind(id).run()
    },

    async invalidateCache(id: string | number, kv: KVNamespace): Promise<void> {
      const cacheKey = `${model.$tableName}:${String(id)}`
      await kv.delete(cacheKey)
    },

    async warmCache(ids: (string | number)[], db: D1Database, kv: KVNamespace): Promise<void> {
      if (!model.$cacheConfig?.enabled) {
        console.warn(
          `[EdgeRecord] warmCache called on model '${model.$tableName}' but caching is not enabled`
        )
        return
      }

      const cacheLayer = new CacheLayer(model, kv, db, model.$cacheConfig)
      await cacheLayer.warm(ids)
    },
  }

  // Merge model with CRUD methods
  return Object.assign({}, model, crudMethods) as ModelWithCrud<T>
}
