/**
 * @module commands/migrate
 * @description Database migration commands
 */

import { generateMigration } from './migrate/generate'
import { applyMigrations } from './migrate/apply'
import { rollbackMigration } from './migrate/rollback'
import { migrationStatus } from './migrate/status'
import type { MigrateOptions } from './migrate/types'

/**
 * Main migrate command handler
 * Routes to appropriate subcommand
 *
 * Usage:
 *  - ix migrate                      -> Apply pending migrations
 *  - ix migrate:generate <name>      -> Generate new migration
 *  - ix migrate:rollback             -> Rollback last migration
 *  - ix migrate:status               -> Show migration status
 */
export async function migrate(
  subcommand?: string,
  name?: string,
  _options: MigrateOptions = {}
): Promise<void> {
  // Parse arguments to extract subcommand and options
  const args = process.argv.slice(3) // Skip node, script, and command

  // Check for subcommands
  if (subcommand === 'generate' || args[0] === 'generate') {
    const migrationName = name || args[1]
    await generateMigration(migrationName)
    return
  }

  if (subcommand === 'rollback' || args[0] === 'rollback') {
    // Parse options
    const rollbackOptions: MigrateOptions = {
      yes: args.includes('--yes'),
      env: args.includes('--remote') ? 'remote' : 'local',
    }
    await rollbackMigration(rollbackOptions)
    return
  }

  if (subcommand === 'status' || args[0] === 'status') {
    await migrationStatus()
    return
  }

  // No subcommand = apply migrations
  const applyOptions: MigrateOptions = {
    yes: args.includes('--yes'),
    env: args.includes('--remote') ? 'remote' : 'local',
  }
  await applyMigrations(applyOptions)
}
