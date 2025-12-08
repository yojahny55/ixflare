/**
 * @module edge-record/schema/types
 * @description Type definitions for EdgeRecord schema system
 */

import type { z } from 'zod'
import type { FieldBuilder } from './field'

/**
 * Schema definition - a record of field names to FieldBuilder instances
 */
export type SchemaDefinition = Record<string, FieldBuilder<unknown>>

/**
 * Infer TypeScript type from a FieldBuilder
 */
export type InferFieldType<T> = T extends FieldBuilder<infer U> ? U : never

/**
 * Infer TypeScript type from entire schema definition
 * Maps each field to its inferred type
 */
export type InferSchema<T extends SchemaDefinition> = {
  [K in keyof T]: InferFieldType<T[K]>
}

/**
 * Model options for configuration
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ModelOptions {
  // Future options can be added here:
  // - timestamps?: boolean
  // - tableName?: string (override)
  // - indexes?: IndexDefinition[]
  // - constraints?: ConstraintDefinition[]
}

/**
 * Model interface with schema metadata
 */
export interface Model<TSchema extends SchemaDefinition> {
  /** The database table name */
  $tableName: string
  /** The schema definition with field builders */
  $schema: TSchema
  /** Type-only property for TypeScript inference: `typeof Model.$infer` */
  readonly $infer: InferSchema<TSchema>
  /** Generated Zod schema for runtime validation */
  $zodSchema: z.ZodObject<Record<string, z.ZodTypeAny>>
}
