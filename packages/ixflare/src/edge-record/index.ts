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

// Legacy exports (will be refactored in later stories)
export { Model as LegacyModel } from './model'
export { QueryBuilder } from './query-builder'
export type { ModelDefinition, ModelSchema, QueryOptions } from './types'
