/**
 * @module commands/custom
 * @description Custom command execution from user configuration
 * @node-only
 */

import { loadConfig } from 'ixflare/config'
import type { CommandConfig } from 'ixflare'

/**
 * Load custom commands from configuration
 *
 * @param projectRoot - Root directory of the project
 * @returns Map of command names to command configurations
 */
export async function loadCustomCommands(projectRoot: string): Promise<Map<string, CommandConfig>> {
  try {
    const config = await loadConfig(projectRoot)
    return new Map(Object.entries(config.commands ?? {}))
  } catch {
    // Config load may fail if not in a project directory
    // Return empty map to indicate no custom commands available
    return new Map()
  }
}

/**
 * Execute a custom command by name
 *
 * @param projectRoot - Root directory of the project
 * @param commandName - Name of the command to execute
 * @throws {Error} When command is not found or execution fails
 */
export async function runCustomCommand(
  projectRoot: string,
  commandName: string
): Promise<void> {
  const config = await loadConfig(projectRoot)
  const command = config.commands?.[commandName]

  if (!command) {
    throw new Error(`Unknown custom command: ${commandName}`)
  }

  console.log(`Running custom command: ${commandName}`)
  await command.handler()
}
