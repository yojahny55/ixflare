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
