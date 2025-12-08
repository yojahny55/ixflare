/**
 * @module commands/custom
 * @description Custom command execution from user configuration
 * @node-only
 */

import { loadConfig } from 'ixflare/config'
import type { CommandConfig, IxflareConfig } from 'ixflare'

/**
 * Error thrown when a custom command fails
 */
export class CommandError extends Error {
  constructor(
    public readonly code: 'COMMAND_NOT_FOUND' | 'COMMAND_EXECUTION_FAILED',
    message: string,
    public readonly commandName: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'CommandError'
  }
}

/**
 * Result of loading custom commands, includes config for reuse
 */
export interface LoadCustomCommandsResult {
  commands: Map<string, CommandConfig>
  config: IxflareConfig | null
}

/**
 * Load custom commands from configuration
 *
 * @param projectRoot - Root directory of the project
 * @returns Object containing commands map and loaded config for reuse
 */
export async function loadCustomCommands(projectRoot: string): Promise<LoadCustomCommandsResult> {
  try {
    const config = await loadConfig(projectRoot)
    return {
      commands: new Map(Object.entries(config.commands ?? {})),
      config,
    }
  } catch {
    // Config load may fail if not in a project directory
    // Return empty map to indicate no custom commands available
    return {
      commands: new Map(),
      config: null,
    }
  }
}

/**
 * Execute a custom command by name
 *
 * @param commandName - Name of the command to execute
 * @param config - Pre-loaded config (avoids re-loading)
 * @throws {CommandError} When command is not found or execution fails
 */
export async function runCustomCommand(commandName: string, config: IxflareConfig): Promise<void> {
  const command = config.commands?.[commandName]

  if (!command) {
    throw new CommandError(
      'COMMAND_NOT_FOUND',
      `Unknown custom command: ${commandName}`,
      commandName
    )
  }

  console.log(`Running custom command: ${commandName}`)
  try {
    await command.handler()
  } catch (error) {
    throw new CommandError(
      'COMMAND_EXECUTION_FAILED',
      `Custom command "${commandName}" failed: ${error instanceof Error ? error.message : String(error)}`,
      commandName,
      error
    )
  }
}
