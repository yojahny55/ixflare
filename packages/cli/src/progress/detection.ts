/**
 * Display mode detection for progress indicators
 * Detects TTY, CI environment, quiet mode, and color support
 */

import type { DisplayMode } from './types'

/**
 * Detect display mode based on environment and command-line arguments
 * @param args - Command-line arguments (e.g., process.argv.slice(2))
 * @returns Display mode configuration
 */
export function detectDisplayMode(args: string[]): DisplayMode {
  // Check for flags
  const isQuiet = args.includes('--quiet') || args.includes('-q')
  const isVerbose = args.includes('--verbose') || args.includes('-v')
  const noColorFlag = args.includes('--no-color')

  // Check environment
  const isTTY = process.stdout.isTTY ?? false
  const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS)
  const noColorEnv = !!process.env.NO_COLOR
  const forceColor = !!process.env.FORCE_COLOR

  // Determine color support
  // Priority: NO_COLOR > --no-color > FORCE_COLOR > TTY
  const colors = noColorEnv || noColorFlag ? false : forceColor || isTTY

  // Interactive mode requires: TTY + not CI + not quiet
  const interactive = isTTY && !isCI && !isQuiet

  // Spinner requires interactive mode
  const spinner = interactive

  return {
    interactive,
    spinner,
    colors,
    verbose: isVerbose,
  }
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(process.env.CI || process.env.GITHUB_ACTIONS)
}

/**
 * Check if running in TTY
 */
export function isTTY(): boolean {
  return process.stdout.isTTY ?? false
}

/**
 * Check if colors should be disabled
 */
export function shouldDisableColors(): boolean {
  return !!process.env.NO_COLOR
}
