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
 * Generate options interface
 */
interface GenerateOptions {
  schema?: string
  empty?: boolean
  help?: boolean
}

/**
 * Main migrate command handler
 * Routes to appropriate subcommand
 *
 * Usage:
 *  - ix migrate                      -> Apply pending migrations
 *  - ix migrate --force              -> Apply migrations including destructive ones
 *  - ix migrate:generate <name>      -> Generate new migration
 *  - ix migrate:generate <name> --schema <path> -> Generate from schema diff
 *  - ix migrate:rollback             -> Rollback last migration
 *  - ix migrate:rollback --force     -> Rollback even with destructive operations
 *  - ix migrate:status               -> Show migration status
 */
export async function migrate(
  subcommand?: string,
  name?: string,
  options: MigrateOptions | GenerateOptions = {}
): Promise<void> {
  // Parse arguments to extract subcommand and options
  const args = process.argv.slice(3) // Skip node, script, and command

  // Check for subcommands
  if (subcommand === 'generate' || args[0] === 'generate') {
    const migrationName = name || args[1]
    const genOptions = options as GenerateOptions
    await generateMigration(migrationName, {
      schema: genOptions.schema,
      empty: genOptions.empty,
    })
    return
  }

  if (subcommand === 'rollback' || args[0] === 'rollback') {
    // Parse options - merge passed options with args
    const migrateOpts = options as MigrateOptions
    const rollbackOptions: MigrateOptions = {
      yes: migrateOpts.yes ?? args.includes('--yes'),
      force: migrateOpts.force ?? args.includes('--force'),
      env: migrateOpts.env ?? (args.includes('--remote') ? 'remote' : 'local'),
    }
    await rollbackMigration(rollbackOptions)
    return
  }

  if (subcommand === 'status' || args[0] === 'status') {
    const migrateOpts = options as MigrateOptions
    await migrationStatus({
      help: migrateOpts.help,
      env: migrateOpts.env ?? (args.includes('--remote') ? 'remote' : 'local'),
    })
    return
  }

  // No subcommand = apply migrations
  const migrateOpts = options as MigrateOptions
  const applyOptions: MigrateOptions = {
    yes: migrateOpts.yes ?? args.includes('--yes'),
    force: migrateOpts.force ?? args.includes('--force'),
    env: migrateOpts.env ?? (args.includes('--remote') ? 'remote' : 'local'),
  }
  await applyMigrations(applyOptions)
}
