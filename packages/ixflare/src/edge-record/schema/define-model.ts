/**
 * @module edge-record/schema/define-model
 * @description Model definition function for EdgeRecord
 */

import type { SchemaDefinition, InferSchema, ModelOptions, Model } from './types'

/**
 * Internal model registry
 * Stores all defined models for later access
 */
const modelRegistry = new Map<string, Model<SchemaDefinition>>()

/**
 * Define a new model with type-safe schema
 *
 * @template T The schema definition type
 * @param tableName The database table name (snake_case recommended)
 * @param schema The field definitions using field builders
 * @param options Optional model configuration
 * @returns Model object with $tableName, $schema, and $infer properties
 *
 * @example
 * ```typescript
 * import { defineModel, field, timestamps } from 'ixflare/orm'
 *
 * export const User = defineModel('users', {
 *   id: field.id(),
 *   email: field.string().unique(),
 *   name: field.string(),
 *   role: field.enum(['user', 'admin', 'moderator']).default('user'),
 *   bio: field.text().nullable(),
 *   ...timestamps(),
 * })
 *
 * // Type is automatically inferred
 * export type User = typeof User.$infer
 * ```
 */
export function defineModel<T extends SchemaDefinition>(
  tableName: string,
  schema: T,
  _options?: ModelOptions
): Model<T> & { $infer: InferSchema<T> } {
  // Create model object with metadata
  const model: Model<T> & { $infer: InferSchema<T> } = {
    $tableName: tableName,
    $schema: schema,
    // $infer is a type-only property, no runtime value
    // It exists for TypeScript inference: typeof Model.$infer
    $infer: undefined as unknown as InferSchema<T>,
  }

  // Register model for later access
  modelRegistry.set(tableName, model as Model<SchemaDefinition>)

  return model
}

/**
 * Get a registered model by table name
 * @param tableName The table name
 * @returns The registered model or undefined
 */
export function getModel(tableName: string): Model<SchemaDefinition> | undefined {
  return modelRegistry.get(tableName)
}

/**
 * Get all registered models
 * @returns Array of all registered models
 */
export function getAllModels(): Model<SchemaDefinition>[] {
  return Array.from(modelRegistry.values())
}

/**
 * Clear the model registry (useful for testing)
 */
export function clearModelRegistry(): void {
  modelRegistry.clear()
}
