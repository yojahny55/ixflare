/**
 * @module commands/rescue/delete
 * @description Delete rescue checkpoints
 * @node-only
 */

import pc from 'picocolors'
import prompts from 'prompts'
import {
  loadCheckpointMetadata,
  deleteCheckpoint as deleteCheckpointUtil,
  listCheckpoints,
  isOlderThan,
  formatCheckpointAge,
} from './utils'

/**
 * Argument value extractor helper
 */
function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index !== -1 && args[index + 1] ? args[index + 1] : undefined
}

/**
 * Show help for rescue:delete command
 */
function showHelp(): void {
  console.log(`
${pc.bold('ix rescue:delete')} - Delete rescue checkpoint(s)

${pc.bold('USAGE')}
  ix rescue:delete <checkpoint-id> [options]
  ix rescue:delete --older-than <days> [options]

${pc.bold('ARGUMENTS')}
  <checkpoint-id>         Checkpoint identifier to delete

${pc.bold('OPTIONS')}
  --older-than <days>     Delete all checkpoints older than specified days
  --yes, -y               Skip confirmation prompt
  --help, -h              Show this help message

${pc.bold('DESCRIPTION')}
  Deletes one or more rescue checkpoints permanently.

  ${pc.yellow('⚠️  Warning:')} This action cannot be undone!

${pc.bold('EXAMPLES')}
  # Delete specific checkpoint (with confirmation)
  ix rescue:delete rescue-2024-12-01-1600

  # Delete without confirmation
  ix rescue:delete rescue-2024-12-01-1600 --yes

  # Delete all checkpoints older than 7 days
  ix rescue:delete --older-than 7

  # Delete old checkpoints without confirmation
  ix rescue:delete --older-than 7 --yes

${pc.bold('STORAGE CLEANUP')}
  Deleting checkpoints frees up disk space in .ixflare/rescue/ directory.
  `)
}

/**
 * Delete rescue checkpoint(s)
 *
 * @param checkpointId Optional checkpoint identifier
 * @param args Command arguments
 */
export async function deleteCheckpoint(
  checkpointId: string | undefined,
  args: string[] = []
): Promise<void> {
  const cwd = process.cwd()

  // Parse arguments
  const olderThanStr = getArgValue(args, '--older-than')
  const yes = args.includes('--yes') || args.includes('-y')
  const help = args.includes('--help') || args.includes('-h')

  if (help) {
    showHelp()
    return
  }

  // Bulk delete by age
  if (olderThanStr) {
    const olderThanDays = parseInt(olderThanStr, 10)

    if (isNaN(olderThanDays) || olderThanDays < 1) {
      console.log('')
      console.log(pc.red('Error: --older-than must be a positive number'))
      console.log('')
      process.exit(1)
      return
    }

    const allCheckpoints = listCheckpoints(cwd)
    const oldCheckpoints = allCheckpoints.filter((cp) => isOlderThan(cp.timestamp, olderThanDays))

    if (oldCheckpoints.length === 0) {
      console.log('')
      console.log(pc.yellow(`No checkpoints older than ${olderThanDays} days found`))
      console.log('')
      return
    }

    console.log('')
    console.log(
      pc.yellow(`Found ${oldCheckpoints.length} checkpoint${oldCheckpoints.length > 1 ? 's' : ''} older than ${olderThanDays} days:`)
    )
    console.log('')

    for (const cp of oldCheckpoints) {
      const age = formatCheckpointAge(cp.timestamp)
      console.log(
        pc.dim('  •'),
        pc.bold(cp.id),
        cp.name ? pc.dim(`(${cp.name})`) : '',
        pc.dim(`- ${age}`)
      )
    }

    console.log('')

    // Confirm with user unless --yes flag
    if (!yes) {
      const response = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: `Delete ${oldCheckpoints.length} checkpoint${oldCheckpoints.length > 1 ? 's' : ''}?`,
        initial: false,
      })

      if (!response.proceed) {
        console.log('Cancelled.')
        return
      }
    }

    console.log('')
    let deletedCount = 0

    for (const cp of oldCheckpoints) {
      if (deleteCheckpointUtil(cwd, cp.id)) {
        console.log(pc.green('✓'), `Deleted ${cp.id}`)
        deletedCount++
      } else {
        console.log(pc.red('✗'), `Failed to delete ${cp.id}`)
      }
    }

    console.log('')
    console.log(pc.green(`Successfully deleted ${deletedCount} checkpoint${deletedCount > 1 ? 's' : ''}`))
    console.log('')
    return
  }

  // Single checkpoint delete
  if (!checkpointId) {
    console.log('')
    console.log(pc.red('Error: checkpoint-id is required'))
    console.log('')
    console.log('Usage:')
    console.log(pc.cyan('  ix rescue:delete <checkpoint-id>'))
    console.log(pc.cyan('  ix rescue:delete --older-than <days>'))
    console.log('')
    console.log('Available checkpoints:')
    console.log(pc.cyan('  ix rescue:list'))
    console.log('')
    process.exit(1)
    return
  }

  // Verify checkpoint exists
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

  console.log('')
  console.log(pc.bold('Delete checkpoint:'), checkpointId)
  if (metadata.name) {
    console.log(pc.dim(`  Name: ${metadata.name}`))
  }
  if (metadata.description) {
    console.log(pc.dim(`  Description: ${metadata.description}`))
  }
  console.log(pc.dim(`  Created: ${formatCheckpointAge(metadata.timestamp)}`))
  console.log('')

  // Confirm with user unless --yes flag
  if (!yes) {
    const response = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: `Delete checkpoint ${checkpointId}?`,
      initial: false,
    })

    if (!response.proceed) {
      console.log('Cancelled.')
      return
    }
  }

  console.log('')
  if (deleteCheckpointUtil(cwd, checkpointId)) {
    console.log(pc.green('✓'), 'Checkpoint deleted successfully')
  } else {
    console.log(pc.red('✗'), 'Failed to delete checkpoint')
    process.exit(1)
  }
  console.log('')
}
