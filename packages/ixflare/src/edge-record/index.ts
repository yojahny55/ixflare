/**
 * @module edge-record
 * @description EdgeRecord ORM for Cloudflare D1
 * @packageDocumentation
 */

// Schema exports (Story 3.1)
export {
  field,
  FieldBuilder,
  timestamps,
  defineModel,
  getModel,
  getAllModels,
  clearModelRegistry,
  toSQLType,
  toSQLSchema,
  getColumnMetadata,
  escapeIdentifier,
  escapeStringValue,
  generateZodSchema,
  toZodField,
} from './schema'
export type {
  FieldConfig,
  SchemaDefinition,
  InferSchema,
  InferFieldType,
  ModelOptions,
  Model,
} from './schema'

// CRUD exports (Story 3.2)
export { ModelInstance } from './crud/model-instance'
export { D1Adapter } from './crud/d1-adapter'
export { QueryBuilder } from './query-builder'
export type { WhereCondition } from './query-builder'
export { create, find, findOrFail, upsert, createMany } from './crud/crud-operations'
export type { CreateInput, UpdateInput } from './crud/crud-operations'
export { createModelProxy, type ModelCrudMethods, type ModelWithCrud } from './crud/model-proxy'
export { EdgeRecordError, NotFoundError, ValidationError, ConflictError } from './crud/errors'
export {
  toCamelCase,
  toSnakeCase,
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from './crud/case-transform'

// Legacy exports (will be refactored in later stories)
export { Model as LegacyModel } from './model'
export type { ModelDefinition, ModelSchema, QueryOptions } from './types'
