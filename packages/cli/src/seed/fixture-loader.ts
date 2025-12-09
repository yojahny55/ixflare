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

  // Simple pluralization removal (users → User, posts → Post)
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
