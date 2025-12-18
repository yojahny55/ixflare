/**
 * Progress indicators for CLI commands
 * Provides spinners, multi-step progress, progress bars, and nested progress
 */

// Core classes
import { ProgressIndicator as PI, formatDuration as fd } from './indicator'
import { MultiStepProgress as MSP } from './multi-step'
import { ProgressBar as PB } from './progress-bar'
import { NestedProgress as NP } from './nested'
import { detectDisplayMode as ddm } from './detection'
import type { ProgressBarOptions as PBO } from './types'

export { PI as ProgressIndicator, fd as formatDuration }
export { MSP as MultiStepProgress }
export { PB as ProgressBar }
export { NP as NestedProgress }

// Detection utilities
export { detectDisplayMode, isCI, isTTY, shouldDisableColors } from './detection'

// Types
export type {
  ProgressColor,
  ProgressOptions,
  DisplayMode,
  StepStatus,
  Step,
  ProgressBarOptions,
  StatusSymbols,
  ProgressState,
} from './types'

// Factory functions for convenience

/**
 * Create a progress indicator with display mode detection
 */
export function createProgressIndicator(text?: string, args: string[] = process.argv.slice(2)): PI {
  const mode = ddm(args)
  return new PI({
    text,
    color: mode.colors ? 'cyan' : undefined,
  })
}

/**
 * Create multi-step progress with display mode detection
 * Note: Display mode detection available via detectDisplayMode() for callers
 * who need to conditionally use progress indicators
 */
export function createMultiStepProgress(
  steps: string[],
  _args: string[] = process.argv.slice(2)
): MSP {
  // MultiStepProgress uses picocolors which respects NO_COLOR automatically
  // Callers should use detectDisplayMode() to decide whether to show progress
  return new MSP(steps)
}

/**
 * Create a progress bar with display mode detection
 * Note: Display mode detection available via detectDisplayMode() for callers
 * who need to conditionally use progress indicators
 */
export function createProgressBar(
  total: number,
  options?: Partial<PBO>,
  _args: string[] = process.argv.slice(2)
): PB {
  // Callers should use detectDisplayMode() to decide whether to show progress
  return new PB({
    total,
    ...options,
  })
}

/**
 * Create nested progress with display mode detection
 * Note: Display mode detection available via detectDisplayMode() for callers
 * who need to conditionally use progress indicators
 */
export function createNestedProgress(
  parentText: string,
  _args: string[] = process.argv.slice(2)
): NP {
  // Callers should use detectDisplayMode() to decide whether to show progress
  return new NP(parentText)
}
