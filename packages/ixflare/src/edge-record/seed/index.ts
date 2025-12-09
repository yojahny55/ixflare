/**
 * @module edge-record/seed
 * @description Public API for database seeding
 */

export { seed, isSeedFunction } from './seed'
export type { SeedDefinitionOptions } from './seed'
export type {
  SeedFunction,
  SeedEnvironment,
  SeedConfig,
  FixtureData,
  SeedOptions,
  SeedResult,
} from './types'

// Seed context for tracking results and idempotent operations
export {
  SeedContext,
  getSeedContext,
  setSeedContext,
  trackCreated,
  trackSkipped,
  idempotentCreate,
} from './context'
