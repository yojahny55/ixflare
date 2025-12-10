/**
 * @module edge-record/schema/define-model
 * @description Model definition function for EdgeRecord
 */

import { generateZodSchema } from './zod-generator'
import type { SchemaDefinition, ModelOptions, Model } from './types'
import { createModelProxy, type ModelWithCrud } from '@/edge-record/crud/model-proxy'
import { analyzeTier } from '@/edge-record/storage/tier-analyzer'

/**
 * Internal model registry
 * Uses WeakRef to avoid memory leaks in long-running workers.
 * Models are stored by table name for lookup.
 */
const modelRegistry = new Map<string, WeakRef<Model<SchemaDefinition>>>()

/**
 * Symbol used to mark $infer as a type-only property
 * Accessing it at runtime throws a helpful error
 */
const INFER_SYMBOL = Symbol.for('ixflare.model.$infer')

/**
 * Define a new model with type-safe schema
 *
 * @template T The schema definition type
 * @param tableName The database table name (snake_case recommended)
 * @param schema The field definitions using field builders
 * @param options Optional model configuration
 * @returns Model object with $tableName, $schema, $infer, and $zodSchema properties
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
 *
 * // Validate data at runtime
 * const result = User.$zodSchema.safeParse(input)
 * ```
 */
export function defineModel<T extends SchemaDefinition>(
  tableName: string,
  schema: T,
  options?: ModelOptions
): ModelWithCrud<T> {
  // Generate Zod schema for runtime validation
  // We create a temporary object just for the zod generator
  const zodSchema = generateZodSchema({
    $tableName: tableName,
    $schema: schema,
  } as unknown as Model<SchemaDefinition>)

  // Create intermediate model for tier analysis
  const intermediateModel = {
    $tableName: tableName,
    $schema: schema,
    $relations: options?.relations,
  } as unknown as Model<T>

  // Analyze and set storage tier
  const tierResult = analyzeTier(intermediateModel, options)

  // Log warnings in development
  if (tierResult.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[EdgeRecord] Model '${tableName}' storage warnings:`, tierResult.warnings)
  }

  // Validate soft deletes configuration
  if (options?.softDeletes) {
    if (!('deletedAt' in schema)) {
      throw new Error(
        `[EdgeRecord] Model '${tableName}' has softDeletes: true but is missing 'deletedAt' field in schema. ` +
          `Add deletedAt: field.datetime().nullable() to your schema.`
      )
    }

    // Log index recommendation in development (but not during tests)
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
    if (process.env.NODE_ENV !== 'production' && !isTest) {
      console.info(
        `[EdgeRecord] Model '${tableName}' has soft deletes enabled. ` +
          `For optimal query performance, create a partial index:\n` +
          `  CREATE INDEX idx_${tableName}_not_deleted ON ${tableName}(id) WHERE deleted_at IS NULL;`
      )
    }
  }

  // Create final model with all properties
  const model = Object.defineProperties(intermediateModel, {
    $zodSchema: {
      value: zodSchema,
      enumerable: true,
      writable: false,
    },
    $infer: {
      // $infer is a type-only property for TypeScript: `typeof Model.$infer`
      // Accessing at runtime returns a symbol to indicate misuse
      get() {
        return INFER_SYMBOL
      },
      enumerable: true,
    },
    $storage: {
      value: tierResult.tier,
      enumerable: true,
      writable: false,
    },
    $cacheConfig: {
      value: options?.cache,
      enumerable: true,
      writable: false,
    },
    $softDeletes: {
      value: options?.softDeletes ?? false,
      enumerable: true,
      writable: false,
    },
    $consistency: {
      value: options?.consistency,
      enumerable: true,
      writable: false,
    },
  }) as Model<T>

  // Register model with WeakRef to prevent memory leaks
  modelRegistry.set(tableName, new WeakRef(model as Model<SchemaDefinition>))

  // Add CRUD methods to model via proxy
  return createModelProxy(model)
}

/**
 * Get a registered model by table name
 * @param tableName The table name
 * @returns The registered model or undefined (if garbage collected)
 */
export function getModel(tableName: string): Model<SchemaDefinition> | undefined {
  const weakRef = modelRegistry.get(tableName)
  if (!weakRef) return undefined

  const model = weakRef.deref()
  if (!model) {
    // Model was garbage collected, clean up the registry entry
    modelRegistry.delete(tableName)
    return undefined
  }

  return model
}

/**
 * Get all registered models that are still alive
 * @returns Array of all registered models
 */
export function getAllModels(): Model<SchemaDefinition>[] {
  const models: Model<SchemaDefinition>[] = []

  for (const [tableName, weakRef] of modelRegistry.entries()) {
    const model = weakRef.deref()
    if (model) {
      models.push(model)
    } else {
      // Clean up garbage collected entries
      modelRegistry.delete(tableName)
    }
  }

  return models
}

/**
 * Clear the model registry (useful for testing)
 */
export function clearModelRegistry(): void {
  modelRegistry.clear()
}
