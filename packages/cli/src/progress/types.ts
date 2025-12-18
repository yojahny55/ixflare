/**
 * Progress indicator types and interfaces
 * Supports spinners, multi-step progress, and progress bars
 */

import type { Spinner } from 'nanospinner'

/**
 * Color options for progress indicators
 */
export type ProgressColor =
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'magenta'
  | 'white'
  | 'gray'

/**
 * Status symbols for visual output
 */
export interface StatusSymbols {
  success: string
  error: string
  warning: string
  info: string
  pending: string
}

/**
 * Options for creating a progress indicator
 */
export interface ProgressOptions {
  /** Initial text to display */
  text?: string
  /** Color of the spinner/text */
  color?: ProgressColor
  /** Spinner animation style (from nanospinner) */
  spinner?: string
}

/**
 * Display mode configuration based on environment
 */
export interface DisplayMode {
  /** Can use cursor manipulation (TTY + not CI) */
  interactive: boolean
  /** Show animated spinners (interactive mode) */
  spinner: boolean
  /** Use ANSI colors in output */
  colors: boolean
  /** Show detailed/verbose output */
  verbose: boolean
}

/**
 * Step status for multi-step progress
 */
export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped'

/**
 * Individual step in multi-step progress
 */
export interface Step {
  /** Unique identifier for the step */
  id: string
  /** Display text for the step */
  text: string
  /** Current status of the step */
  status: StepStatus
  /** Duration in milliseconds (populated when complete) */
  duration?: number
}

/**
 * Options for creating a progress bar
 */
export interface ProgressBarOptions {
  /** Total number of units to complete */
  total: number
  /** Width of the progress bar in characters (default: 20) */
  width?: number
  /** Show percentage indicator (default: true) */
  showPercentage?: boolean
  /** Show estimated time to completion (default: false) */
  showETA?: boolean
  /** Initial text to display */
  text?: string
}

/**
 * Internal progress indicator state
 */
export interface ProgressState {
  spinner: Spinner | null
  startTime: number
  mode: DisplayMode
}
