/**
 * TTY and CI environment detection utilities
 * Determines if wizard can run in interactive mode
 */

import type { InteractiveMode } from './types'

/**
 * Detect if wizard should run in interactive mode
 * Checks for --yes flag, CI environment, and TTY availability
 *
 * @param args - Command line arguments to check for flags
 * @returns Interactive mode configuration
 */
export function detectInteractiveMode(args: string[]): InteractiveMode {
  // Check --yes flag first (highest priority)
  if (args.includes('--yes') || args.includes('-y')) {
    return {
      isInteractive: false,
      isTTY: !!process.stdout.isTTY,
      isCI: false,
      reason: '--yes flag',
    }
  }

  // Check CI environment variables
  const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI)

  if (isCI) {
    return {
      isInteractive: false,
      isTTY: false,
      isCI: true,
      reason: 'CI environment',
    }
  }

  // Check TTY availability
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return {
      isInteractive: false,
      isTTY: false,
      isCI: false,
      reason: 'No TTY',
    }
  }

  // Interactive mode available
  return {
    isInteractive: true,
    isTTY: true,
    isCI: false,
  }
}
