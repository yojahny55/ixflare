/**
 * @module commands/rescue/list
 * @description List available rescue checkpoints
 * @node-only
 */

import pc from 'picocolors'
import { listCheckpoints, formatCheckpointAge, formatTimestamp, isOlderThan } from './utils'

/**
 * Default retention period in days
 */
const DEFAULT_RETENTION_DAYS = 7

/**
 * Show help for rescue:list command
 */
function showHelp(): void {
  console.log(`
${pc.bold('ix rescue:list')} - List available rescue checkpoints

${pc.bold('USAGE')}
  ix rescue:list [options]

${pc.bold('OPTIONS')}
  --json                  Output in JSON format
  --help, -h              Show this help message

${pc.bold('DESCRIPTION')}
  Shows all available rescue checkpoints with details:
  • Checkpoint name/ID
  • Age (time since creation)
  • Description (if provided)
  • Components included (DB, KV, Code)

  Checkpoints older than ${DEFAULT_RETENTION_DAYS} days are highlighted for cleanup.

${pc.bold('EXAMPLES')}
  # List all checkpoints
  ix rescue:list

  # List in JSON format (for scripting)
  ix rescue:list --json

${pc.bold('CLEANUP')}
  To delete old checkpoints:
    ix rescue:delete <checkpoint-id>

  To delete all checkpoints older than 7 days:
    ix rescue:delete --older-than 7
  `)
}

/**
 * List available checkpoints
 *
 * @param args Command arguments
 */
export async function list(args: string[] = []): Promise<void> {
  const cwd = process.cwd()

  // Parse arguments
  const json = args.includes('--json')
  const help = args.includes('--help') || args.includes('-h')

  if (help) {
    showHelp()
    return
  }

  const checkpoints = listCheckpoints(cwd)

  if (json) {
    // JSON output for scripting
    console.log(JSON.stringify(checkpoints, null, 2))
    return
  }

  if (checkpoints.length === 0) {
    console.log('')
    console.log(pc.yellow('No checkpoints found'))
    console.log('')
    console.log('Create a checkpoint with:')
    console.log(pc.cyan('  ix rescue:create'))
    console.log('')
    return
  }

  console.log('')
  console.log(pc.bold('Available Checkpoints'))
  console.log('')

  const oldCheckpoints: string[] = []

  for (const checkpoint of checkpoints) {
    const age = formatCheckpointAge(checkpoint.timestamp)
    const timestamp = formatTimestamp(checkpoint.timestamp)
    const isOld = isOlderThan(checkpoint.timestamp, DEFAULT_RETENTION_DAYS)

    if (isOld) {
      oldCheckpoints.push(checkpoint.id)
    }

    // Checkpoint header
    const nameDisplay = checkpoint.name
      ? `${pc.bold(checkpoint.id)} (${checkpoint.name})`
      : pc.bold(checkpoint.id)

    console.log(isOld ? pc.yellow(nameDisplay) : nameDisplay)
    console.log(pc.dim(`  Created: ${timestamp} (${age})`))

    if (checkpoint.description) {
      console.log(pc.dim(`  Description: ${checkpoint.description}`))
    }

    // Components
    const components: string[] = []
    if (checkpoint.components.d1) {
      components.push(`DB (${checkpoint.components.d1.tables} tables)`)
    }
    if (checkpoint.components.kv) {
      components.push(`KV (${checkpoint.components.kv.keys} keys)`)
    }
    if (checkpoint.components.git) {
      components.push(`Code (${checkpoint.components.git.branch})`)
    }

    if (components.length > 0) {
      console.log(pc.dim(`  Components: ${components.join(', ')}`))
    }

    console.log(pc.dim(`  Restore: ${pc.cyan(`ix rescue:restore ${checkpoint.id}`)}`))

    if (isOld) {
      console.log(pc.yellow(`  ⚠  Older than ${DEFAULT_RETENTION_DAYS} days - consider cleanup`))
    }

    console.log('')
  }

  // Summary
  console.log(pc.dim(`Total: ${checkpoints.length} checkpoint${checkpoints.length > 1 ? 's' : ''}`))

  if (oldCheckpoints.length > 0) {
    console.log('')
    console.log(
      pc.yellow(
        `${oldCheckpoints.length} checkpoint${oldCheckpoints.length > 1 ? 's' : ''} older than ${DEFAULT_RETENTION_DAYS} days`
      )
    )
    console.log(pc.dim('Clean up with:'), pc.cyan(`ix rescue:delete --older-than ${DEFAULT_RETENTION_DAYS}`))
  }

  console.log('')
}
