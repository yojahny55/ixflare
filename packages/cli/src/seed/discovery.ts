/**
 * @module seed/discovery
 * @description Seed file discovery and loading
 */

import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import type { SeedEnvironment } from 'ixflare'

export interface SeedFileInfo {
  /**
   * Absolute path to the seed file
   */
  path: string

  /**
   * Seed name (filename without extension)
   */
  name: string

  /**
   * Environment(s) where this seed should run
   */
  environment?: SeedEnvironment | SeedEnvironment[]

  /**
   * Dependencies that must run before this seed
   */
  dependencies?: string[]
}

/**
 * Get the seeds directory path
 * @param cwd Current working directory (defaults to process.cwd())
 * @returns Absolute path to seeds directory
 */
export function getSeedsDir(cwd?: string): string {
  const baseDir = cwd || process.cwd()
  return join(baseDir, 'seeds')
}

/**
 * Check if seeds directory exists
 * @param cwd Current working directory
 * @returns True if seeds directory exists
 */
export function seedsDirExists(cwd?: string): boolean {
  return existsSync(getSeedsDir(cwd))
}

/**
 * Discover all seed files from the seeds/ directory
 * @param cwd Current working directory
 * @returns Array of seed file paths and metadata
 */
export function discoverSeedFiles(cwd?: string): SeedFileInfo[] {
  const seedsDir = getSeedsDir(cwd)

  if (!existsSync(seedsDir)) {
    return []
  }

  const files = readdirSync(seedsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .filter((f) => f !== 'index.ts' && f !== 'index.js') // Exclude index files
    .sort() // Alphabetical order

  return files.map((filename) => {
    const name = filename.replace(/\.(ts|js)$/, '')
    const path = join(seedsDir, filename)

    return {
      path,
      name,
      // Metadata will be populated when seed is loaded
      environment: undefined,
      dependencies: undefined,
    }
  })
}

/**
 * Discover JSON fixture files from the seeds/fixtures directory
 * @param cwd Current working directory
 * @returns Array of fixture file paths
 */
export function discoverFixtureFiles(cwd?: string): string[] {
  const seedsDir = getSeedsDir(cwd)
  const fixturesDir = join(seedsDir, 'fixtures')

  if (!existsSync(fixturesDir)) {
    return []
  }

  return readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((filename) => join(fixturesDir, filename))
}

/**
 * Check if a path is a JSON fixture file
 * @param path File path to check
 * @returns True if path is a JSON file
 */
export function isFixturePath(path: string): boolean {
  return path.endsWith('.json')
}

/**
 * Load seed configuration from seeds/index.ts (if exists)
 * @param cwd Current working directory
 * @returns Seed configuration or null if not found
 */
export async function loadSeedConfig(
  cwd?: string
): Promise<Record<SeedEnvironment, string[]> | null> {
  const seedsDir = getSeedsDir(cwd)
  const configPath = join(seedsDir, 'index.ts')

  if (!existsSync(configPath)) {
    return null
  }

  try {
    // Dynamic import to load the config
    const module = await import(configPath)
    return module.default || null
  } catch {
    return null
  }
}

/**
 * Filter seeds by environment
 * @param seeds All discovered seeds
 * @param environment Target environment
 * @param config Optional seed configuration from seeds/index.ts
 * @returns Filtered seed file infos
 */
export function filterSeedsByEnvironment(
  seeds: SeedFileInfo[],
  environment: SeedEnvironment,
  config?: Record<SeedEnvironment, string[]> | null
): SeedFileInfo[] {
  // If config exists, use it for filtering
  if (config) {
    const allowedSeeds = new Set(config[environment] || [])
    return seeds.filter((seed) => {
      // Match by filename with or without extension
      return (
        allowedSeeds.has(seed.name) ||
        allowedSeeds.has(`./${seed.name}.ts`) ||
        allowedSeeds.has(`./${seed.name}.js`) ||
        allowedSeeds.has(`./seeds/${seed.name}.ts`) ||
        allowedSeeds.has(`./seeds/${seed.name}.js`)
      )
    })
  }

  // No config - run all seeds for development and test, none for production
  if (environment === 'production') {
    return []
  }

  return seeds
}

/**
 * Resolve seed dependencies to determine execution order
 * @param seeds Seed files with dependency metadata
 * @returns Ordered array of seeds (dependencies first)
 * @throws Error if circular dependency detected or dependency not found
 */
export function resolveSeedOrder(seeds: SeedFileInfo[]): SeedFileInfo[] {
  const seedMap = new Map(seeds.map((s) => [s.name, s]))
  const visited = new Set<string>()
  const inStack = new Set<string>() // Track current traversal path for cycle detection
  const ordered: SeedFileInfo[] = []

  function visit(seedName: string, path: string[] = []) {
    // Already processed - skip
    if (visited.has(seedName)) {
      return
    }

    // Circular dependency detected
    if (inStack.has(seedName)) {
      const cycle = [...path, seedName].join(' → ')
      throw new Error(`Circular dependency detected: ${cycle}`)
    }

    const seed = seedMap.get(seedName)
    if (!seed) {
      throw new Error(`Seed dependency not found: ${seedName}`)
    }

    // Mark as in current traversal
    inStack.add(seedName)

    // Visit dependencies first
    if (seed.dependencies) {
      for (const dep of seed.dependencies) {
        visit(dep, [...path, seedName])
      }
    }

    // Done with this node
    inStack.delete(seedName)
    visited.add(seedName)
    ordered.push(seed)
  }

  // Visit all seeds
  for (const seed of seeds) {
    visit(seed.name)
  }

  return ordered
}
