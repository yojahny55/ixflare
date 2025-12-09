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
