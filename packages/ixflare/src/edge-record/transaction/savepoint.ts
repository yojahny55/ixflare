/**
 * @module edge-record/transaction/savepoint
 * @description Savepoint management for nested transactions
 */

/**
 * Generate a unique savepoint name
 * Uses depth and timestamp to ensure uniqueness
 */
export function generateSavepointName(depth: number): string {
  return `sp_${depth}_${Date.now()}`
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
