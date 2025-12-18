/**
 * NestedProgress - Progress indicator for hierarchical operations
 * Shows parent operation with indented child operations
 */

import { green, red, cyan, dim } from 'picocolors'
import type { StepStatus } from './types'
import { formatDuration } from './indicator'

interface ChildOperation {
  text: string
  status: StepStatus
  duration?: number
}

export class NestedProgress {
  private parentText: string
  private parentStatus: StepStatus = 'pending'
  private children: ChildOperation[] = []
  private startTime: number = 0
  private started: boolean = false

  constructor(parentText: string) {
    this.parentText = parentText
  }

  /**
   * Start the parent operation
   */
  start(): this {
    this.parentStatus = 'in-progress'
    this.startTime = Date.now()
    this.started = true
    return this
  }

  /**
   * Add a child operation
   * @param text - Child operation text
   * @param status - Status of the child operation
   * @param duration - Optional duration in milliseconds
   */
  addChild(
    text: string,
    status: StepStatus = 'in-progress',
    duration?: number
  ): this {
    this.children.push({ text, status, duration })
    return this
  }

  /**
   * Mark parent operation as complete
   */
  complete(): this {
    this.parentStatus = 'completed'
    return this
  }

  /**
   * Mark parent operation as failed
   */
  fail(): this {
    this.parentStatus = 'failed'
    return this
  }

  /**
   * Check if operation has started
   */
  isStarted(): boolean {
    return this.started
  }

  /**
   * Check if operation is complete
   */
  isComplete(): boolean {
    return this.parentStatus === 'completed'
  }

  /**
   * Check if operation failed
   */
  isFailed(): boolean {
    return this.parentStatus === 'failed'
  }

  /**
   * Get total duration
   */
  get totalDuration(): number {
    if (this.startTime === 0) return 0
    return Date.now() - this.startTime
  }

  /**
   * Render the nested progress structure
   */
  render(): string {
    if (!this.started) return ''

    const lines: string[] = []

    // Render parent
    const parentSymbol = this.getStatusSymbol(this.parentStatus)
    lines.push(`${parentSymbol} ${this.parentText}`)

    // Render children (indented)
    for (const child of this.children) {
      const childSymbol = this.getStatusSymbol(child.status)
      const durationText = child.duration
        ? ` ${dim(`(${formatDuration(child.duration)})`)}`
        : ''
      lines.push(`  ${childSymbol} ${child.text}${durationText}`)
    }

    return lines.join('\n')
  }

  /**
   * Get visual symbol for status
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
        return dim('⊘')
      case 'pending':
        return dim('○')
      default:
        return '○'
    }
  }
}
