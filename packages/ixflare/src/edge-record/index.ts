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
/**
 * D1Adapter - Optional utility class for advanced D1 operations
 * Provides type conversion helpers (toD1Value, fromD1Value) and batch utilities.
 * Most users should use the higher-level CRUD functions instead.
 */
export { D1Adapter } from './crud/d1-adapter'
export { QueryBuilder, GroupedQueryBuilder } from './query-builder'
export type {
  WhereCondition,
  WhereOperator,
  WhereValue,
  WhereConditions,
  NumericKeys,
  GroupedResult,
} from './query-builder'
export { create, find, findOrFail, upsert, upsertAtomic, createMany } from './crud/crud-operations'
export type { CreateInput, UpdateInput } from './crud/crud-operations'
export { createModelProxy, type ModelCrudMethods, type ModelWithCrud } from './crud/model-proxy'
export { EdgeRecordError, NotFoundError, ValidationError, ConflictError } from './crud/errors'
export {
  toCamelCase,
  toSnakeCase,
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from './crud/case-transform'

// Relationship exports (Story 3.4)
export { hasMany, hasOne, belongsTo, manyToMany } from './relations'
export type { RelationConfig, RelationType, RelationsConfig } from './relations'
export { EagerLoader, type ModelInstanceWithRelations } from './relations'

// Storage exports (Story 3.5)
export {
  analyzeTier,
  validateTierChoice,
  KVAdapter,
  DOAdapter,
  CacheLayer,
  isD1Database,
  isKVNamespace,
  isDurableObjectStorage,
} from './storage'
export type {
  StorageTier,
  ConsistencyLevel,
  StorageOptions,
  CacheOptions,
  ExtendedModelOptions,
  TierAnalysisResult,
  KVAdapterOptions,
  StorageBinding,
} from './storage'

// Transaction exports (Story 3.8)
export { transaction } from './transaction'
export type {
  TransactionContext,
  TransactionOptions,
  TransactionUpdateInput,
  IsolationLevel,
  UpdateOperators,
} from './transaction'
export { TransactionError, TransactionTimeoutError, TransactionRollbackError } from './crud/errors'

// Legacy exports (will be refactored in later stories)
export { Model as LegacyModel } from './model'
export type { ModelDefinition, ModelSchema, QueryOptions } from './types'
