/**
 * @module edge-record/crud/model-proxy
 * @description Proxy that adds static CRUD methods to Model objects
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import type { CreateInput } from '@/edge-record/crud/crud-operations'
import type { ModelInstance } from '@/edge-record/crud/model-instance'
import { QueryBuilder } from '@/edge-record/query-builder'
import { create, find, findOrFail, upsert, createMany } from '@/edge-record/crud/crud-operations'

/**
 * CRUD methods interface added to Model
 */
export interface ModelCrudMethods<T extends SchemaDefinition> {
  /**
   * Create a new record
   */
  create(data: CreateInput<T>, db: D1Database): Promise<ModelInstance<T>>

  /**
   * Find record by ID (returns null if not found)
   */
  find(id: number, db: D1Database): Promise<ModelInstance<T> | null>

  /**
   * Find record by ID or throw NotFoundError
   */
  findOrFail(id: number, db: D1Database): Promise<ModelInstance<T>>

  /**
   * Create query builder for WHERE queries
   */
  where(conditions: Partial<InferSchema<T>>): QueryBuilder<T>
  where(field: keyof InferSchema<T>, value: unknown): QueryBuilder<T>

  /**
   * Upsert a record (create or update based on match)
   */
  upsert(
    match: Partial<InferSchema<T>>,
    values: Partial<InferSchema<T>>,
    db: D1Database
  ): Promise<ModelInstance<T>>

  /**
   * Bulk insert records
   */
  createMany(records: CreateInput<T>[], db: D1Database): Promise<ModelInstance<T>[]>
}

/**
 * Model with CRUD methods attached
 */
export type ModelWithCrud<T extends SchemaDefinition> = Model<T> & ModelCrudMethods<T>

/**
 * Create a proxy that adds CRUD methods to a Model
 */
export function createModelProxy<T extends SchemaDefinition>(model: Model<T>): ModelWithCrud<T> {
  const crudMethods: ModelCrudMethods<T> = {
    create(data: CreateInput<T>, db: D1Database): Promise<ModelInstance<T>> {
      return create(model, data, db)
    },

    find(id: number, db: D1Database): Promise<ModelInstance<T> | null> {
      return find(model, id, db)
    },

    findOrFail(id: number, db: D1Database): Promise<ModelInstance<T>> {
      return findOrFail(model, id, db)
    },

    where(
      fieldOrConditions: keyof InferSchema<T> | Partial<InferSchema<T>>,
      value?: unknown
    ): QueryBuilder<T> {
      const qb = new QueryBuilder(model)

      if (typeof fieldOrConditions === 'object') {
        return qb.where(fieldOrConditions)
      } else if (value !== undefined) {
        // Two-argument form: where(field, value)
        return qb.where(fieldOrConditions, value as InferSchema<T>[keyof InferSchema<T>])
      } else {
        // Should not happen, but return empty query builder
        return qb
      }
    },

    upsert(
      match: Partial<InferSchema<T>>,
      values: Partial<InferSchema<T>>,
      db: D1Database
    ): Promise<ModelInstance<T>> {
      return upsert(model, match, values, db)
    },

    createMany(records: CreateInput<T>[], db: D1Database): Promise<ModelInstance<T>[]> {
      return createMany(model, records, db)
    },
  }

  // Merge model with CRUD methods
  return Object.assign({}, model, crudMethods) as ModelWithCrud<T>
}
