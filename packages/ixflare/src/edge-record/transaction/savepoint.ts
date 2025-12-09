/**
 * @module edge-record/transaction/savepoint
 * @description Savepoint management for nested transactions
 */

/**
 * Counter for generating unique savepoint names
 * Combined with timestamp and random suffix for collision resistance
 */
let savepointCounter = 0

/**
 * Generate a unique savepoint name
 * Uses depth, counter, timestamp, and random suffix for collision resistance
 * in high-concurrency scenarios
 */
export function generateSavepointName(depth: number): string {
  const counter = savepointCounter++
  const randomSuffix = Math.random().toString(36).slice(2, 8)
  return `sp_${depth}_${Date.now()}_${counter}_${randomSuffix}`
}

/**
 * Create SQL for SAVEPOINT statement
 */
export function createSavepointSQL(name: string): string {
  return `SAVEPOINT ${name}`
}

/**
 * Create SQL for RELEASE SAVEPOINT statement (on success)
 */
export function releaseSavepointSQL(name: string): string {
  return `RELEASE SAVEPOINT ${name}`
}

/**
 * Create SQL for ROLLBACK TO SAVEPOINT statement (on failure)
 */
export function rollbackToSavepointSQL(name: string): string {
  return `ROLLBACK TO SAVEPOINT ${name}`
}

/**
 * Savepoint manager tracks nested transaction hierarchy
 *
 * @remarks
 * This class provides a stack-based abstraction for managing savepoints.
 * Currently not used in the main transaction implementation (which manages
 * savepoints inline), but exported for potential advanced use cases where
 * manual savepoint management is needed.
 *
 * @internal
 */
export class SavepointManager {
  private stack: string[] = []

  /**
   * Push a new savepoint onto the stack
   */
  push(depth: number): string {
    const name = generateSavepointName(depth)
    this.stack.push(name)
    return name
  }

  /**
   * Pop the most recent savepoint from the stack
   */
  pop(): string | undefined {
    return this.stack.pop()
  }

  /**
   * Get the current savepoint name (most recent)
   */
  current(): string | undefined {
    return this.stack[this.stack.length - 1]
  }

  /**
   * Get the current depth (number of savepoints)
   */
  depth(): number {
    return this.stack.length
  }

  /**
   * Clear all savepoints
   */
  clear(): void {
    this.stack = []
  }
}
