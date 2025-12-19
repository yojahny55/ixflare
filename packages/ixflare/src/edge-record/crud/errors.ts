/**
 * @module edge-record/crud/errors
 * @description Error classes for CRUD operations
 */

/**
 * Base error class for EdgeRecord CRUD operations
 */
export class EdgeRecordError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'EdgeRecordError'
  }
}

/**
 * Error thrown when a record is not found
 */
export class NotFoundError extends EdgeRecordError {
  constructor(code: string, message: string) {
    super(code, message, 404)
    this.name = 'NotFoundError'
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends EdgeRecordError {
  constructor(
    code: string,
    message: string,
    public errors?: unknown
  ) {
    super(code, message, 422)
    this.name = 'ValidationError'
  }
}

/**
 * Error thrown when a unique constraint is violated
 */
export class ConflictError extends EdgeRecordError {
  constructor(code: string, message: string) {
    super(code, message, 409)
    this.name = 'ConflictError'
  }
}

/**
 * Base error class for transaction operations
 */
export class TransactionError extends EdgeRecordError {
  constructor(
    code: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`TRANSACTION.${code}`, message, 500)
    this.name = 'TransactionError'
  }
}

/**
 * Error thrown when a transaction times out
 */
export class TransactionTimeoutError extends TransactionError {
  constructor(
    public readonly timeoutMs: number,
    public readonly elapsedMs: number,
    public readonly operationCount: number
  ) {
    super(
      'TIMEOUT',
      `Transaction timed out after ${elapsedMs}ms (limit: ${timeoutMs}ms) with ${operationCount} pending operations`
    )
    this.name = 'TransactionTimeoutError'
  }
}

/**
 * Error thrown when a transaction rollback fails
 */
export class TransactionRollbackError extends TransactionError {
  constructor(message: string, cause?: Error) {
    super('ROLLBACK_FAILED', message, cause)
    this.name = 'TransactionRollbackError'
  }
}

/**
 * Error thrown when write-through succeeds in D1 but fails in KV
 *
 * This indicates a partial success state where:
 * - D1 (source of truth) has been successfully updated
 * - KV cache write failed
 * - KV cache entry has been invalidated to force cache miss
 *
 * The data is consistent in D1, and the next read will
 * re-populate the cache from D1.
 */
export class WriteThroughPartialError extends EdgeRecordError {
  constructor(
    message: string,
    public readonly recordId: string,
    public readonly kvError: Error
  ) {
    super('WRITE_THROUGH.PARTIAL_FAILURE', message, 500)
    this.name = 'WriteThroughPartialError'
  }
}
