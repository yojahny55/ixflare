/**
 * @module seed/fixture-loader
 * @description JSON fixture loading for seeding
 */

import { readFileSync } from 'fs'
import type { FixtureData } from 'ixflare'

/**
 * Load and parse JSON fixture file
 * @param filePath Path to JSON fixture file
 * @returns Parsed fixture data
 */
export function loadFixture(filePath: string): FixtureData {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('Fixture must be a JSON object')
    }

    return data as FixtureData
  } catch (error) {
    throw new Error(
      `Failed to load fixture ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Get table names from fixture in insertion order
 * Respects foreign key dependencies by returning tables in definition order
 * @param fixture Parsed fixture data
 * @returns Array of table names (excludes _meta)
 */
export function getFixtureTables(fixture: FixtureData): string[] {
  return Object.keys(fixture).filter((key) => key !== '_meta' && Array.isArray(fixture[key]))
}

/**
 * Get records for a specific table from fixture
 * @param fixture Parsed fixture data
 * @param tableName Table name (camelCase)
 * @returns Array of records
 */
export function getFixtureRecords(
  fixture: FixtureData,
  tableName: string
): Record<string, unknown>[] {
  const records = fixture[tableName]

  if (!Array.isArray(records)) {
    throw new Error(`Fixture table "${tableName}" must be an array`)
  }

  return records as Record<string, unknown>[]
}

/**
 * Transform fixture table name to model name
 * Convention: fixture keys are camelCase, model names are PascalCase
 * @param tableName Fixture table name (e.g., "users", "blogPosts")
 * @returns Model name (e.g., "User", "BlogPost")
 */
export function fixtureTableToModelName(tableName: string): string {
  // Handle both camelCase and snake_case
  const camelCase = tableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

  // Convert to PascalCase and make singular if plural
  const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1)

  // Simple pluralization removal with common irregular handling
  // Handle "es" suffix for words ending in consonant+es (addresses → Address)
  if (pascalCase.endsWith('sses')) {
    // classes → Class (remove 'es')
    return pascalCase.slice(0, -2)
  }
  if (pascalCase.endsWith('xes') || pascalCase.endsWith('ches') || pascalCase.endsWith('shes')) {
    // boxes → Box, matches → Match, dishes → Dish
    return pascalCase.slice(0, -2)
  }
  if (pascalCase.endsWith('ies')) {
    // categories → Category
    return pascalCase.slice(0, -3) + 'y'
  }
  if (pascalCase.endsWith('ves')) {
    // lives → Life, wives → Wife, leaves → Leaf
    return pascalCase.slice(0, -3) + 'fe'
  }
  // Standard plural (users → User, posts → Post)
  if (pascalCase.endsWith('s') && !pascalCase.endsWith('ss')) {
    return pascalCase.slice(0, -1)
  }

  return pascalCase
}

/**
 * Validate fixture structure
 * @param fixture Parsed fixture data
 * @throws Error if fixture has invalid structure
 */
export function validateFixture(fixture: FixtureData): void {
  if (typeof fixture !== 'object' || fixture === null || Array.isArray(fixture)) {
    throw new Error('Fixture must be a JSON object')
  }

  for (const [tableName, records] of Object.entries(fixture)) {
    if (tableName === '_meta') {
      continue
    }

    if (!Array.isArray(records)) {
      throw new Error(`Fixture table "${tableName}" must be an array`)
    }

    for (const record of records) {
      if (typeof record !== 'object' || record === null) {
        throw new Error(`All records in "${tableName}" must be objects`)
      }
    }
  }
}

/**
 * Result of executing a fixture
 */
export interface FixtureExecutionResult {
  /**
   * Fixture file path
   */
  path: string

  /**
   * Records inserted per table
   */
  inserted: Record<string, number>

  /**
   * Execution time in milliseconds
   */
  duration: number

  /**
   * Error if execution failed
   */
  error?: Error
}

/**
 * Model registry interface for fixture execution
 * Maps model names to their create functions
 */
export type ModelRegistry = Record<
  string,
  {
    createMany?: (records: Record<string, unknown>[]) => Promise<unknown[]>
    create?: (record: Record<string, unknown>) => Promise<unknown>
  }
>

/**
 * Execute a fixture file, inserting all records into the database
 * Records are inserted in the order tables are defined in the JSON file
 *
 * @example
 * ```typescript
 * import { executeFixture } from '@ixflare/cli/seed'
 * import { User, Post } from '@/models'
 *
 * const result = await executeFixture(
 *   '/path/to/fixture.json',
 *   { User, Post }
 * )
 * console.log(result.inserted) // { users: 10, posts: 25 }
 * ```
 *
 * @param fixturePath Path to the JSON fixture file
 * @param models Registry of model classes with create/createMany methods
 * @returns Execution result with inserted counts per table
 */
export async function executeFixture(
  fixturePath: string,
  models: ModelRegistry
): Promise<FixtureExecutionResult> {
  const startTime = Date.now()
  const result: FixtureExecutionResult = {
    path: fixturePath,
    inserted: {},
    duration: 0,
  }

  try {
    // Load and validate fixture
    const fixture = loadFixture(fixturePath)
    validateFixture(fixture)

    // Get tables in definition order (respects FK dependencies)
    const tables = getFixtureTables(fixture)

    // Insert records for each table
    for (const tableName of tables) {
      const modelName = fixtureTableToModelName(tableName)
      const model = models[modelName]

      if (!model) {
        throw new Error(
          `Model "${modelName}" not found in registry for fixture table "${tableName}". ` +
            `Available models: ${Object.keys(models).join(', ')}`
        )
      }

      const records = getFixtureRecords(fixture, tableName)

      if (records.length === 0) {
        result.inserted[tableName] = 0
        continue
      }

      // Use createMany if available (more efficient), otherwise create one by one
      if (model.createMany) {
        await model.createMany(records)
      } else if (model.create) {
        for (const record of records) {
          await model.create(record)
        }
      } else {
        throw new Error(`Model "${modelName}" must have either createMany or create method`)
      }

      result.inserted[tableName] = records.length
    }

    result.duration = Date.now() - startTime
    return result
  } catch (error) {
    result.duration = Date.now() - startTime
    result.error = error instanceof Error ? error : new Error(String(error))
    return result
  }
}
