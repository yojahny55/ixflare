/**
 * @module commands/rescue/restore
 * @description Restore from rescue checkpoint
 * @node-only
 */

import { copyFileSync, existsSync, readdirSync, type Dirent } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import pc from 'picocolors'
import prompts from 'prompts'
import {
  loadCheckpointMetadata,
  getCheckpointDir,
  formatTimestamp,
  isValidCheckpointId,
} from './utils'

const execAsync = promisify(exec)

/**
 * Find local D1 database path from .wrangler directory
 *
 * @param cwd Current working directory
 * @returns D1 database path or null
 */
function findLocalD1DatabasePath(cwd: string): string | null {
  const wranglerStateDir = join(cwd, '.wrangler', 'state', 'v3', 'd1')

  if (!existsSync(wranglerStateDir)) {
    return null
  }

  const bindings = readdirSync(wranglerStateDir, { withFileTypes: true }).filter((entry: Dirent) =>
    entry.isDirectory()
  )

  // Use first D1 database found
  for (const binding of bindings) {
    const dbPath = join(wranglerStateDir, binding.name, 'db.sqlite')
    if (existsSync(dbPath)) {
      return dbPath
    }
  }

  return null
}

/**
 * Restore D1 database from checkpoint
 *
 * @param cwd Current working directory
 * @param checkpointId Checkpoint identifier
 * @param d1Component D1 component metadata
 * @returns True if successful
 */
function restoreD1Database(
  cwd: string,
  checkpointId: string,
  d1Component: { binding: string; file: string; tables: number }
): boolean {
  const backupPath = join(getCheckpointDir(cwd, checkpointId), d1Component.file)
  const currentDbPath = findLocalD1DatabasePath(cwd)

  if (!currentDbPath) {
    console.log(pc.red('✗'), 'No local D1 database found to restore to')
    return false
  }

  if (!existsSync(backupPath)) {
    console.log(pc.red('✗'), 'Database backup file not found')
    return false
  }

  try {
    // Replace current database with backup
    copyFileSync(backupPath, currentDbPath)
    console.log(pc.green('✓'), 'Database restored')
    console.log(pc.dim(`  Tables: ${d1Component.tables}`))
    return true
  } catch (error) {
    console.log(pc.red('✗'), 'Failed to restore database')
    console.error(error instanceof Error ? error.message : String(error))
    return false
  }
}

/**
 * Restore git stash
 *
 * @param cwd Current working directory
 * @param gitComponent Git component metadata
 * @returns True if successful
 */
async function restoreGitState(
  cwd: string,
  gitComponent: { stashRef: string; branch: string; commitHash: string }
): Promise<boolean> {
  try {
    // Apply the stash (doesn't remove it from stash list)
    await execAsync(`git stash apply ${gitComponent.stashRef}`, { cwd })
    console.log(pc.green('✓'), 'Code state restored from git stash')
    console.log(pc.dim(`  Branch: ${gitComponent.branch}`))
    console.log(pc.dim(`  Commit: ${gitComponent.commitHash.substring(0, 8)}`))
    return true
  } catch (error) {
    console.log(pc.red('✗'), 'Failed to restore git stash')
    if (error instanceof Error) {
      console.log(pc.dim(`  ${error.message}`))
    }
    return false
  }
}

/**
 * Show help for rescue:restore command
 */
function showHelp(): void {
  console.log(`
${pc.bold('ix rescue:restore')} - Restore from a rescue checkpoint

${pc.bold('USAGE')}
  ix rescue:restore <checkpoint-id> [options]

${pc.bold('ARGUMENTS')}
  <checkpoint-id>         Checkpoint identifier to restore

${pc.bold('OPTIONS')}
  --db-only               Restore only the database (not code)
  --code-only             Restore only the code state (not database)
  --yes, -y               Skip confirmation prompt
  --help, -h              Show this help message

${pc.bold('DESCRIPTION')}
  Restores your local development environment from a previously created checkpoint.

  By default, restores all components that were backed up:
  • D1 database (replaces local SQLite file)
  • Git working directory state (applies git stash)

  ${pc.yellow('⚠️  Warning:')} This will overwrite your current state!

${pc.bold('EXAMPLES')}
  # Restore full checkpoint (with confirmation)
  ix rescue:restore rescue-2024-12-17-1430

  # Restore without confirmation
  ix rescue:restore rescue-2024-12-17-1430 --yes

  # Restore only database
  ix rescue:restore rescue-2024-12-17-1430 --db-only

  # Restore only code state
  ix rescue:restore rescue-2024-12-17-1430 --code-only

${pc.bold('BEFORE RESTORING')}
  Consider creating a new checkpoint first to save your current state:
    ix rescue:create --name "before-restore"

${pc.bold('GIT CONFLICTS')}
  If restoring git stash causes conflicts, resolve them manually:
    git status
    # Fix conflicts in files
    git add .
  `)
}

/**
 * Restore from rescue checkpoint
 *
 * @param checkpointId Checkpoint identifier
 * @param args Command arguments
 */
export async function restore(
  checkpointId: string | undefined,
  args: string[] = []
): Promise<void> {
  const cwd = process.cwd()

  // Parse arguments
  const dbOnly = args.includes('--db-only')
  const codeOnly = args.includes('--code-only')
  const yes = args.includes('--yes') || args.includes('-y')
  const help = args.includes('--help') || args.includes('-h')

  if (help || !checkpointId) {
    showHelp()
    if (!checkpointId) {
      console.log('')
      console.log(pc.red('Error: checkpoint-id is required'))
      console.log('')
      console.log('Available checkpoints:')
      console.log(pc.cyan('  ix rescue:list'))
      console.log('')
      process.exit(1)
    }
    return
  }

  // Security: Validate checkpoint ID to prevent path traversal attacks
  if (!isValidCheckpointId(checkpointId)) {
    console.log('')
    console.log(pc.red('Error: Invalid checkpoint ID format'))
    console.log(pc.dim('Checkpoint IDs must be alphanumeric with hyphens/underscores only'))
    console.log('')
    process.exit(1)
    return
  }

  // Load checkpoint metadata
  const metadata = loadCheckpointMetadata(cwd, checkpointId)

  if (!metadata) {
    console.log('')
    console.log(pc.red(`Error: Checkpoint "${checkpointId}" not found`))
    console.log('')
    console.log('Available checkpoints:')
    console.log(pc.cyan('  ix rescue:list'))
    console.log('')
    process.exit(1)
    return
  }

  // Show what will be restored
  console.log('')
  console.log(pc.bold('This will restore:'))
  console.log('')

  if (metadata.components.d1 && !codeOnly) {
    console.log(
      pc.cyan('  • Database'),
      pc.dim(`to snapshot from ${formatTimestamp(metadata.timestamp)}`)
    )
    console.log(pc.dim(`    Tables: ${metadata.components.d1.tables}`))
  }

  if (metadata.components.kv && !codeOnly) {
    console.log(
      pc.cyan('  • KV data'),
      pc.dim(`to snapshot from ${formatTimestamp(metadata.timestamp)}`)
    )
    console.log(pc.dim(`    Note: KV restore is limited`))
  }

  if (metadata.components.git && !dbOnly) {
    console.log(pc.cyan('  • Code state'), pc.dim(`from git stash`))
    console.log(pc.dim(`    Branch: ${metadata.components.git.branch}`))
    console.log(pc.dim(`    Commit: ${metadata.components.git.commitHash.substring(0, 8)}`))
  }

  console.log('')

  // Confirm with user unless --yes flag
  if (!yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with restore?',
      initial: false,
    })

    if (!response.proceed) {
      console.log('Cancelled.')
      return
    }
  }

  console.log('')
  console.log(pc.cyan('Restoring checkpoint...'))
  console.log('')

  let successCount = 0
  let totalComponents = 0

  // Restore D1 database
  if (metadata.components.d1 && !codeOnly) {
    totalComponents++
    if (restoreD1Database(cwd, checkpointId, metadata.components.d1)) {
      successCount++
    }
  }

  // Restore KV namespace (limited support)
  if (metadata.components.kv && !codeOnly) {
    totalComponents++
    console.log(pc.yellow('○'), 'KV restore not fully supported (local dev only)')
  }

  // Restore git state
  if (metadata.components.git && !dbOnly) {
    totalComponents++
    if (await restoreGitState(cwd, metadata.components.git)) {
      successCount++
    }
  }

  console.log('')
  if (successCount === totalComponents) {
    console.log(pc.green('✓'), 'Checkpoint restored successfully!')
  } else {
    console.log(
      pc.yellow('⚠'),
      `Partial restore: ${successCount}/${totalComponents} components restored`
    )
  }
  console.log('')
}
