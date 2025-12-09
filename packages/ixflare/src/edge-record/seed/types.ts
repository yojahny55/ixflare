/**
 * @module edge-record/seed
 * @description Type definitions for database seeding
 */

/**
 * Seed function that populates the database with test/development data
 * @returns Promise that resolves when seeding is complete
 */
export type SeedFunction = (() => Promise<void>) & {
  __isSeed: true
  name?: string
  environment?: SeedEnvironment | SeedEnvironment[]
  dependencies?: string[]
}

/**
 * Environment where seeds can run
 */
export type SeedEnvironment = 'development' | 'test' | 'production'

/**
 * Configuration for environment-specific seeds
 */
export interface SeedConfig {
  development?: string[]
  test?: string[]
  production?: string[]
}

/**
 * JSON fixture data format
 */
export interface FixtureData {
  _meta?: {
    version?: string
    description?: string
  }
  [tableName: string]: unknown[] | Record<string, unknown> | undefined
}

/**
 * Options for seed execution
 */
export interface SeedOptions {
  /**
   * Environment to run seeds for
   */
  environment?: SeedEnvironment

  /**
   * Whether to truncate all tables before seeding
   */
  fresh?: boolean

  /**
   * Skip confirmation prompts
   */
  force?: boolean

  /**
   * Use upsert for idempotent seeding
   */
  idempotent?: boolean
}

/**
 * Seed execution result
 */
export interface SeedResult {
  /**
   * Name of the seed file
   */
  name: string

  /**
   * Records created per table
   */
  created: Record<string, number>

  /**
   * Records skipped (for idempotent seeds)
   */
  skipped?: Record<string, number>

  /**
   * Execution time in milliseconds
   */
  duration: number

  /**
   * Error if seed failed
   */
  error?: Error
}
