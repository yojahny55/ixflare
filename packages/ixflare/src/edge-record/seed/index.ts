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
