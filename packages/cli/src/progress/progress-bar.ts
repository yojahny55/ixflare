/**
 * ProgressBar - Visual progress bar for quantifiable operations
 * Shows percentage, visual bar, and optional ETA
 */

import { cyan, dim } from 'picocolors'
import type { ProgressBarOptions } from './types'
import { formatDuration } from './indicator'

export class ProgressBar {
  private current: number = 0
  private total: number
  private startTime: number = 0
  private lastUpdateTime: number = 0
  private options: Required<ProgressBarOptions>
  private completed: boolean = false
  private failed: boolean = false

  constructor(options: ProgressBarOptions) {
    this.total = options.total
    this.options = {
      total: options.total,
      width: options.width ?? 20,
      showPercentage: options.showPercentage ?? true,
      showETA: options.showETA ?? false,
      text: options.text ?? '',
    }
    this.startTime = Date.now()
  }

  /**
   * Update progress to a specific value
   * @param current - Current progress value
   * @param text - Optional text to display
   */
  update(current: number, text?: string): void {
    // Clamp current between 0 and total
    this.current = Math.max(0, Math.min(current, this.total))
    this.lastUpdateTime = Date.now()

    if (text) {
      this.options.text = text
    }
  }

  /**
   * Increment progress by a specific amount
   * @param amount - Amount to increment (default: 1)
   */
  increment(amount: number = 1): void {
    this.update(this.current + amount)
  }

  /**
   * Mark progress as complete (sets to 100%)
   */
  complete(): void {
    this.current = this.total
    this.completed = true
  }

  /**
   * Mark progress as failed
   */
  fail(): void {
    this.failed = true
  }

  /**
   * Check if progress is complete
   */
  isComplete(): boolean {
    return this.completed || this.current >= this.total
  }

  /**
   * Check if progress failed
   */
  isFailed(): boolean {
    return this.failed
  }

  /**
   * Get elapsed time in milliseconds
   */
  get elapsed(): number {
    return Date.now() - this.startTime
  }

  /**
   * Get formatted elapsed time
   */
  get elapsedFormatted(): string {
    return formatDuration(this.elapsed)
  }

  /**
   * Get estimated time remaining in milliseconds
   * Returns 0 if cannot calculate or already complete
   */
  get estimatedTimeRemaining(): number {
    if (this.current === 0 || this.current >= this.total) {
      return 0
    }

    const elapsed = this.elapsed
    const rate = this.current / elapsed // units per ms
    const remaining = this.total - this.current
    const eta = remaining / rate

    return Math.round(eta)
  }

  /**
   * Get formatted ETA
   */
  get etaFormatted(): string {
    return formatDuration(this.estimatedTimeRemaining)
  }

  /**
   * Render the progress bar as a string
   */
  render(): string {
    const percentage = this.calculatePercentage()
    const bar = this.renderBar(percentage)
    const percentageText = this.options.showPercentage ? ` ${percentage}%` : ''
    const etaText =
      this.options.showETA && this.estimatedTimeRemaining > 0
        ? ` ${dim(`ETA: ${this.etaFormatted}`)}`
        : ''
    const text = this.options.text ? `${this.options.text}\n\n  ` : ''

    return `${text}${bar}${percentageText}${etaText}`
  }

  /**
   * Calculate percentage (0-100)
   */
  private calculatePercentage(): number {
    if (this.total === 0) return 0
    return Math.round((this.current / this.total) * 100)
  }

  /**
   * Render the visual progress bar
   */
  private renderBar(percentage: number): string {
    const filled = Math.round((percentage / 100) * this.options.width)
    const empty = this.options.width - filled

    const filledBar = cyan('█'.repeat(filled))
    const emptyBar = dim('░'.repeat(empty))

    return `[${filledBar}${emptyBar}]`
  }
}
