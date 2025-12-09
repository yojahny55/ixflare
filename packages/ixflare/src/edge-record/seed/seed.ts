/**
 * @module edge-record/seed
 * @description Seed function wrapper for marking seed callbacks
 */

import type { SeedFunction, SeedEnvironment } from './types'

/**
 * Options for creating a seed function
 */
export interface SeedDefinitionOptions {
  /**
   * Environment(s) where this seed should run
   * @default ['development', 'test']
   */
  environment?: SeedEnvironment | SeedEnvironment[]

  /**
   * Dependencies (other seed names) that must run before this seed
   */
  dependencies?: string[]

  /**
   * Custom name for the seed (defaults to filename)
   */
  name?: string
}

/**
 * Wraps a seed callback function with metadata for CLI discovery
 *
 * @example
 * ```typescript
 * import { seed } from 'ixflare/orm'
 * import { User } from '@/models'
 * import { faker } from '@faker-js/faker/locale/en'
 *
 * export default seed(async () => {
 *   await User.create({
 *     email: faker.internet.email(),
 *     name: faker.person.fullName(),
 *   })
 * })
 * ```
 *
 * @param fn - Async function that performs seeding
 * @param options - Optional configuration for seed execution
 * @returns Marked seed function with metadata
 */
export function seed(fn: () => Promise<void>, options?: SeedDefinitionOptions): SeedFunction {
  const seedFn = fn as SeedFunction

  // Mark as seed function
  Object.defineProperty(seedFn, '__isSeed', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  // Set optional metadata
  if (options?.name !== undefined) {
    Object.defineProperty(seedFn, 'name', {
      value: options.name,
      writable: false,
      enumerable: false,
      configurable: true,
    })
  }

  if (options?.environment !== undefined) {
    seedFn.environment = options.environment
  }

  if (options?.dependencies !== undefined) {
    seedFn.dependencies = options.dependencies
  }

  return seedFn
}

/**
 * Type guard to check if a function is a seed function
 */
export function isSeedFunction(fn: unknown): fn is SeedFunction {
  return typeof fn === 'function' && '__isSeed' in fn && fn.__isSeed === true
}

/**
 * Model interface for fixture loading
 * Models must have either createMany or create method
 */
export interface FixtureModel {
  createMany?: (records: Record<string, unknown>[]) => Promise<unknown[]>
  create?: (record: Record<string, unknown>) => Promise<unknown>
}

/**
 * Model registry type for fixture execution
 */
export type FixtureModelRegistry = Record<string, FixtureModel>

/**
 * Options for fixture seed
 */
export interface FixtureOptions extends SeedDefinitionOptions {
  /**
   * Transform table name to model name
   * Default: PascalCase singular (users -> User)
   */
  tableToModel?: (tableName: string) => string
}

/**
 * Default transformation from table name to model name
 * Converts plural camelCase/snake_case to singular PascalCase
 */
function defaultTableToModel(tableName: string): string {
  // Handle snake_case
  const camelCase = tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1)

  // Handle common plural patterns
  if (pascalCase.endsWith('sses')) return pascalCase.slice(0, -2) // classes -> Class
  if (pascalCase.endsWith('xes')) return pascalCase.slice(0, -2) // boxes -> Box
  if (pascalCase.endsWith('ches')) return pascalCase.slice(0, -2) // matches -> Match
  if (pascalCase.endsWith('shes')) return pascalCase.slice(0, -2) // dishes -> Dish
  if (pascalCase.endsWith('ies')) return pascalCase.slice(0, -3) + 'y' // categories -> Category
  if (pascalCase.endsWith('ves')) return pascalCase.slice(0, -3) + 'fe' // lives -> Life, wives -> Wife
  if (pascalCase.endsWith('s') && !pascalCase.endsWith('ss')) return pascalCase.slice(0, -1)

  return pascalCase
}

/**
 * Creates a seed function from a JSON fixture file
 *
 * This is the recommended way to load JSON fixtures as it gives you control
 * over which models to use and allows proper type checking.
 *
 * @example
 * ```typescript
 * // seeds/sample-data.ts
 * import { fixture } from 'ixflare'
 * import { User, Post, Comment } from '@/models'
 * import sampleData from './fixtures/sample-data.json'
 *
 * export default fixture(sampleData, {
 *   User,
 *   Post,
 *   Comment,
 * })
 * ```
 *
 * @example With dependencies
 * ```typescript
 * import { fixture } from 'ixflare'
 * import { Post } from '@/models'
 * import posts from './fixtures/posts.json'
 *
 * export default fixture(posts, { Post }, {
 *   dependencies: ['users'], // Run after users seed
 * })
 * ```
 *
 * @param data - JSON fixture data object with table names as keys
 * @param models - Registry of model classes keyed by PascalCase name
 * @param options - Optional seed configuration
 * @returns Seed function that loads the fixture
 */
export function fixture(
  data: Record<string, unknown>,
  models: FixtureModelRegistry,
  options?: FixtureOptions
): SeedFunction {
  const tableToModel = options?.tableToModel ?? defaultTableToModel

  const seedFn = async () => {
    // Get tables in definition order (respects FK dependencies by JSON key order)
    const tables = Object.keys(data).filter((key) => key !== '_meta' && Array.isArray(data[key]))

    for (const tableName of tables) {
      const modelName = tableToModel(tableName)
      const model = models[modelName]

      if (!model) {
        throw new Error(
          `Model "${modelName}" not found for table "${tableName}". ` +
            `Available models: ${Object.keys(models).join(', ')}`
        )
      }

      const records = data[tableName] as Record<string, unknown>[]
      if (records.length === 0) continue

      // Use createMany if available (more efficient)
      if (model.createMany) {
        await model.createMany(records)
      } else if (model.create) {
        for (const record of records) {
          await model.create(record)
        }
      } else {
        throw new Error(`Model "${modelName}" must have createMany or create method`)
      }
    }
  }

  // Wrap with seed() to get proper metadata
  return seed(seedFn, options)
}
