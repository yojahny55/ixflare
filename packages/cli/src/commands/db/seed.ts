/**
 * @module commands/db/seed
 * @description Seed the database with test/development data
 */

import prompts from 'prompts'
import { getDatabaseNameFromWrangler } from '@/commands/migrate/utils'
import {
  seedsDirExists,
  discoverSeedFiles,
  loadSeedConfig,
  filterSeedsByEnvironment,
  resolveSeedOrder,
  executeSeedFiles,
  formatSeedResults,
  truncateAllTables,
} from '@/seed'
import type { SeedEnvironment } from 'ixflare'

/**
 * Seed command options
 */
export interface SeedOptions {
  /**
   * Truncate all tables before seeding
   */
  fresh?: boolean

  /**
   * Environment to use for seed selection
   */
  env?: SeedEnvironment

  /**
   * Skip confirmation prompts
   */
  force?: boolean

  /**
   * Database name (overrides wrangler.toml)
   */
  database?: string

  /**
   * Use local or remote database
   */
  remote?: boolean
}

/**
 * Get current environment
 * Priority: --env flag > NODE_ENV > WRANGLER_ENV > 'development'
 */
function getEnvironment(options: SeedOptions): SeedEnvironment {
  if (options.env) {
    return options.env
  }

  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'production' || nodeEnv === 'test') {
    return nodeEnv
  }

  const wranglerEnv = process.env.WRANGLER_ENV
  if (wranglerEnv === 'production' || wranglerEnv === 'test') {
    return wranglerEnv as SeedEnvironment
  }

  return 'development'
}

/**
 * Seed the database with test/development data
 *
 * Usage:
 *  - ix db:seed                           -> Run seeds for current environment
 *  - ix db:seed --fresh                   -> Truncate and reseed
 *  - ix db:seed --env test                -> Run test seeds
 *  - ix db:seed --fresh --force           -> Skip confirmation
 *  - ix db:seed --remote                  -> Seed remote database
 */
export async function seed(options: SeedOptions = {}): Promise<void> {
  const cwd = process.cwd()
  const environment = getEnvironment(options)
  const dbEnv = options.remote ? 'remote' : 'local'

  // Get database name from wrangler.toml
  const databaseName = options.database || getDatabaseNameFromWrangler()

  if (!databaseName) {
    console.error('Error: No database configured')
    console.error('')
    console.error('Please configure a D1 database in wrangler.toml:')
    console.error('')
    console.error('[[d1_databases]]')
    console.error('binding = "DB"')
    console.error('database_name = "my-database"')
    console.error('database_id = "..."')
    console.error('')
    process.exit(1)
    return
  }

  // Check if seeds directory exists
  if (!seedsDirExists(cwd)) {
    console.log('')
    console.log('⚠️  No seed files found in seeds/')
    console.log('')
    console.log('Create seed files in the seeds/ directory:')
    console.log('  seeds/users.ts')
    console.log('  seeds/products.ts')
    console.log('')
    console.log('Example:')
    console.log("  import { seed } from 'ixflare/orm'")
    console.log("  import { User } from '@/models'")
    console.log('')
    console.log('  export default seed(async () => {')
    console.log("    await User.create({ email: 'admin@example.com', name: 'Admin' })")
    console.log('  })')
    console.log('')
    return
  }

  // Warn about D1 free tier limits when using remote
  if (options.remote) {
    console.log('')
    console.log('⚠️  Warning: D1 free tier allows only 50 queries per Worker invocation')
    console.log('    Large seeds may fail on the free tier. Use --local for development.')
    console.log('')
  }

  // SECURITY: Require explicit --force for production seeding
  if (environment === 'production' && !options.force) {
    console.log('')
    console.log('🚨 PRODUCTION SEEDING BLOCKED')
    console.log('')
    console.log('Seeding production databases requires explicit confirmation.')
    console.log('This is a safety measure to prevent accidental data modification.')
    console.log('')
    console.log('To seed production, use:')
    console.log('  ix db:seed --env production --force')
    console.log('')
    return
  }

  // Discover seed files
  const allSeeds = discoverSeedFiles(cwd)

  if (allSeeds.length === 0) {
    console.log('')
    console.log('No seed files found in seeds/')
    console.log('')
    return
  }

  // Load seed configuration (if exists)
  const config = await loadSeedConfig(cwd)

  // Filter seeds by environment
  const filteredSeeds = filterSeedsByEnvironment(allSeeds, environment, config)

  if (filteredSeeds.length === 0) {
    console.log('')
    console.log(`No seeds configured for ${environment} environment`)
    console.log('')
    if (config) {
      console.log('Check seeds/index.ts configuration:')
      console.log(`  ${environment}: [...]`)
    }
    console.log('')
    return
  }

  // Resolve dependency order
  const orderedSeeds = resolveSeedOrder(filteredSeeds)

  // Fresh seed - truncate tables first
  if (options.fresh) {
    if (!options.force) {
      const response = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: '⚠️  This will delete all data and reseed. Continue?',
        initial: false,
      })

      if (!response.confirmed) {
        console.log('Seeding cancelled.')
        return
      }
    }

    console.log('')
    console.log('Truncating tables...')

    try {
      const deletedCounts = await truncateAllTables(databaseName, dbEnv)
      for (const [table, count] of deletedCounts.entries()) {
        if (count > 0) {
          console.log(`  • ${table} (${count} rows)`)
        }
      }
      console.log('✓ Truncation complete')
      console.log('')
    } catch (error) {
      console.error('Failed to truncate tables:')
      console.error(error instanceof Error ? error.message : String(error))
      console.error('')
      process.exit(1)
      return
    }
  }

  // Display seed info
  console.log('')
  if (config) {
    console.log(`✓ Loaded seed config (${environment})`)
  }
  console.log(`✓ Running seeds...`)

  // Execute seeds
  try {
    const results = await executeSeedFiles(orderedSeeds, environment, (_current, _total, _name) => {
      // Progress callback could be used for spinners in future
    })

    console.log(formatSeedResults(results))
    console.log('')

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
    console.log(`✓ Seeding complete! (${(totalDuration / 1000).toFixed(1)}s)`)
    console.log('')
  } catch (error) {
    console.error('')
    console.error('Seeding failed:')
    console.error(error instanceof Error ? error.message : String(error))
    console.error('')
    process.exit(1)
  }
}
