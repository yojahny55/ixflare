/**
 * MultiStepProgress - Progress indicator for multi-step operations
 * Shows a list of steps with status symbols (pending, in-progress, completed, failed, skipped)
 */

import { green, red, yellow, dim, cyan } from 'picocolors'
import type { Step, StepStatus } from './types'
import { formatDuration } from './indicator'

export class MultiStepProgress {
  private steps: Step[] = []
  private currentIndex: number = -1
  private startTime: number = 0
  private stepStartTime: number = 0

  constructor(stepNames: string[]) {
    this.steps = stepNames.map((text, index) => ({
      id: `step-${index + 1}`,
      text,
      status: 'pending' as StepStatus,
      duration: undefined,
    }))
  }

  /**
   * Start the multi-step progress (marks first step as in-progress)
   */
  start(): this {
    if (this.steps.length === 0) return this

    this.startTime = Date.now()
    this.stepStartTime = Date.now()
    this.currentIndex = 0
    this.steps[0].status = 'in-progress'

    return this
  }

  /**
   * Complete current step and move to next
   * @param text - Optional completion message to override step text
   */
  next(text?: string): this {
    if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) {
      return this
    }

    // Complete current step
    const currentStep = this.steps[this.currentIndex]
    currentStep.status = 'completed'
    currentStep.duration = Date.now() - this.stepStartTime
    if (text) {
      currentStep.text = text
    }

    // Move to next step if available
    this.currentIndex++
    if (this.currentIndex < this.steps.length) {
      this.steps[this.currentIndex].status = 'in-progress'
      this.stepStartTime = Date.now()
    }

    return this
  }

  /**
   * Complete current step (final step)
   * @param text - Optional completion message
   */
  complete(text?: string): this {
    if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) {
      return this
    }

    const currentStep = this.steps[this.currentIndex]
    currentStep.status = 'completed'
    currentStep.duration = Date.now() - this.stepStartTime
    if (text) {
      currentStep.text = text
    }

    return this
  }

  /**
   * Mark current step as failed
   * @param text - Optional error message
   */
  fail(text?: string): this {
    if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) {
      return this
    }

    const currentStep = this.steps[this.currentIndex]
    currentStep.status = 'failed'
    currentStep.duration = Date.now() - this.stepStartTime
    if (text) {
      currentStep.text = text
    }

    return this
  }

  /**
   * Skip current step and move to next
   * @param text - Optional skip message
   */
  skip(text?: string): this {
    if (this.currentIndex < 0 || this.currentIndex >= this.steps.length) {
      return this
    }

    // Mark current step as skipped
    const currentStep = this.steps[this.currentIndex]
    currentStep.status = 'skipped'
    if (text) {
      currentStep.text = text
    }

    // Move to next step if available
    this.currentIndex++
    if (this.currentIndex < this.steps.length) {
      this.steps[this.currentIndex].status = 'in-progress'
      this.stepStartTime = Date.now()
    }

    return this
  }

  /**
   * Complete all progress (marks current step as complete if in-progress)
   */
  finish(): void {
    if (
      this.currentIndex >= 0 &&
      this.currentIndex < this.steps.length &&
      this.steps[this.currentIndex].status === 'in-progress'
    ) {
      this.complete()
    }
  }

  /**
   * Get all steps with their current status
   */
  getSteps(): Step[] {
    return [...this.steps]
  }

  /**
   * Get total duration from start to now
   */
  get totalDuration(): number {
    if (this.startTime === 0) return 0
    return Date.now() - this.startTime
  }

  /**
   * Get formatted total duration
   */
  get totalDurationFormatted(): string {
    return formatDuration(this.totalDuration)
  }

  /**
   * Render the current progress state as a string
   * @returns Multi-line string showing all steps with status symbols
   */
  render(): string {
    if (this.steps.length === 0) return ''

    const lines: string[] = []

    for (const step of this.steps) {
      const symbol = this.getStatusSymbol(step.status)
      const durationText = step.duration ? ` ${dim(`(${formatDuration(step.duration)})`)}` : ''
      const line = `  ${symbol} ${step.text}${durationText}`
      lines.push(line)
    }

    return lines.join('\n')
  }

  /**
   * Get visual symbol for step status
   */
  private getStatusSymbol(status: StepStatus): string {
    switch (status) {
      case 'completed':
        return green('✓')
      case 'failed':
        return red('✖')
      case 'in-progress':
        return cyan('◐')
      case 'skipped':
        return yellow('⊘')
      case 'pending':
        return dim('○')
      default:
        return '○'
    }
  }
}
