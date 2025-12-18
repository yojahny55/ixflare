/**
 * ProgressIndicator - Wrapper around nanospinner for consistent progress indication
 * Provides a fluent API for showing progress in CLI commands
 */

import { createSpinner, type Spinner } from 'nanospinner'
import type { ProgressOptions } from './types'

export class ProgressIndicator {
  private spinner: Spinner | null = null
  private startTime: number = 0
  private running: boolean = false
  private options: ProgressOptions

  constructor(options: ProgressOptions = {}) {
    this.options = options
  }

  /**
   * Start the progress indicator
   * @param text - Optional text to display (overrides constructor text)
   * @returns this for chaining
   */
  start(text?: string): this {
    const displayText = text || this.options.text || 'Loading...'

    // Create spinner - color type compatibility with nanospinner
    this.spinner = createSpinner(displayText, {
      color: this.options.color || 'cyan',
    })

    this.spinner.start()
    this.startTime = Date.now()
    this.running = true

    return this
  }

  /**
   * Update the progress indicator text
   * @param text - New text to display
   * @returns this for chaining
   */
  update(text: string): this {
    if (this.spinner) {
      this.spinner.update({ text })
    }
    return this
  }

  /**
   * Complete with success status
   * @param text - Optional completion message
   * @returns this for chaining
   */
  succeed(text?: string): this {
    if (this.spinner) {
      const displayText = text || this.options.text || 'Done'
      this.spinner.success({ text: displayText })
      this.running = false
    }
    return this
  }

  /**
   * Complete with error status
   * @param text - Optional error message
   * @returns this for chaining
   */
  fail(text?: string): this {
    if (this.spinner) {
      const displayText = text || this.options.text || 'Failed'
      this.spinner.error({ text: displayText })
      this.running = false
    }
    return this
  }

  /**
   * Complete with warning status
   * @param text - Optional warning message
   * @returns this for chaining
   */
  warn(text?: string): this {
    if (this.spinner) {
      const displayText = text || this.options.text || 'Warning'
      this.spinner.warn({ text: displayText })
      this.running = false
    }
    return this
  }

  /**
   * Complete with info status
   * @param text - Optional info message
   * @returns this for chaining
   */
  info(text?: string): this {
    if (this.spinner) {
      const displayText = text || this.options.text || 'Info'
      this.spinner.info({ text: displayText })
      this.running = false
    }
    return this
  }

  /**
   * Stop the spinner without status
   * @returns this for chaining
   */
  stop(): this {
    if (this.spinner) {
      this.spinner.stop()
      this.running = false
    }
    return this
  }

  /**
   * Clear the spinner from terminal
   * @returns this for chaining
   */
  clear(): this {
    if (this.spinner) {
      this.spinner.clear()
    }
    return this
  }

  /**
   * Check if the indicator is currently running
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Get elapsed time in milliseconds
   */
  get elapsed(): number {
    if (this.startTime === 0) {
      return 0
    }
    return Date.now() - this.startTime
  }

  /**
   * Get formatted elapsed time (e.g., "2.3s", "234ms")
   */
  get elapsedFormatted(): string {
    return formatDuration(this.elapsed)
  }
}

/**
 * Format milliseconds as human-readable duration
 * @param ms - Milliseconds to format
 * @returns Formatted string (e.g., "234ms", "2.3s", "1m 12s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}
