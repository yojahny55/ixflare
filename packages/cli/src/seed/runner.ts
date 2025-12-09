/**
 * @module seed/runner
 * @description Seed execution engine
 */

import type { SeedFunction, SeedResult, SeedEnvironment } from 'ixflare'
import { isSeedFunction } from 'ixflare'
import type { SeedFileInfo } from './discovery'

/**
 * Load and execute a seed file
 * @param seedFile Seed file information
 * @param environment Current environment
 * @returns Seed execution result
 */
export async function executeSeedFile(
  seedFile: SeedFileInfo,
  environment: SeedEnvironment
): Promise<SeedResult> {
  const startTime = Date.now()
  const result: SeedResult = {
    name: seedFile.name,
    created: {},
    skipped: {},
    duration: 0,
  }

  try {
    // Dynamic import of the seed file
    const module = await import(seedFile.path)
    const seedFn: unknown = module.default || module[seedFile.name]

    if (!seedFn) {
      throw new Error(`No default export found in seed file: ${seedFile.name}`)
    }

    if (!isSeedFunction(seedFn)) {
      throw new Error(`Seed file must export a function wrapped with seed(): ${seedFile.name}`)
    }

    // TypeScript type assertion - seedFn is now SeedFunction
    const typedSeedFn = seedFn as SeedFunction

    // Check environment compatibility
    if (typedSeedFn.environment) {
      const allowedEnvs = Array.isArray(typedSeedFn.environment)
        ? typedSeedFn.environment
        : [typedSeedFn.environment]

      if (!allowedEnvs.includes(environment)) {
        throw new Error(`Seed ${seedFile.name} is not allowed in ${environment} environment`)
      }
    }

    // Execute the seed function
    await typedSeedFn()

    result.duration = Date.now() - startTime
    return result
  } catch (error) {
    result.duration = Date.now() - startTime
    result.error = error instanceof Error ? error : new Error(String(error))
    return result
  }
}

/**
 * Execute multiple seed files in order
 * @param seedFiles Ordered array of seed files to execute
 * @param environment Current environment
 * @param onProgress Optional callback for progress updates
 * @returns Array of seed execution results
 */
export async function executeSeedFiles(
  seedFiles: SeedFileInfo[],
  environment: SeedEnvironment,
  onProgress?: (current: number, total: number, seedName: string) => void
): Promise<SeedResult[]> {
  const results: SeedResult[] = []

  for (let i = 0; i < seedFiles.length; i++) {
    const seedFile = seedFiles[i]

    if (onProgress) {
      onProgress(i + 1, seedFiles.length, seedFile.name)
    }

    const result = await executeSeedFile(seedFile, environment)
    results.push(result)

    // Stop on first error
    if (result.error) {
      throw result.error
    }
  }

  return results
}

/**
 * Format seed execution results for display
 * @param results Seed execution results
 * @returns Formatted summary string
 */
export function formatSeedResults(results: SeedResult[]): string {
  const lines: string[] = []

  for (const result of results) {
    const createdCount = Object.values(result.created).reduce(
      (sum: number, count) => sum + (count as number),
      0
    )
    const skippedCount = result.skipped
      ? Object.values(result.skipped).reduce((sum: number, count) => sum + (count as number), 0)
      : 0

    let summary = `  • ${result.name}`

    if (createdCount > 0) {
      summary += ` (created ${createdCount} records`
      if (skippedCount > 0) {
        summary += `, skipped ${skippedCount}`
      }
      summary += ')'
    }

    lines.push(summary)
  }

  return lines.join('\n')
}
