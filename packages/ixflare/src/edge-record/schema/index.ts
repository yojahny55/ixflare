/**
 * @module edge-record/schema
 * @description EdgeRecord schema exports
 */

export { field, FieldBuilder } from './field'
export type { FieldConfig } from './field'
export { timestamps } from './timestamps'
export { defineModel, getModel, getAllModels, clearModelRegistry } from './define-model'
export type { SchemaDefinition, InferSchema, InferFieldType, ModelOptions, Model } from './types'
export {
  toSQLType,
  toSQLSchema,
  getColumnMetadata,
  escapeIdentifier,
  escapeStringValue,
} from './type-mapping'
export { generateZodSchema, toZodField } from './zod-generator'
