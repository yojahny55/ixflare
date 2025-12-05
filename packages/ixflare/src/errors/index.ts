/**
 * @module errors
 * @description Error classes with typed error codes and secret redaction
 */

import { redactString } from '../utils/redact'

export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly timestamp: number
  private rawMessage: string

  constructor(code: string, message: string, status: number = 500) {
    // Redact secrets from message before passing to Error
    const sanitizedMessage = redactString(message)
    super(sanitizedMessage)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.timestamp = Date.now()
    this.rawMessage = sanitizedMessage
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.rawMessage,
        status: this.status,
        timestamp: this.timestamp,
      },
    }
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string) {
    super(`AUTH.${code}`, message, 401)
    this.name = 'AuthError'
  }
}

export class ValidationError extends AppError {
  readonly errors: Array<{ field: string; message: string }>

  constructor(message: string, errors: Array<{ field: string; message: string }> = []) {
    super('VALIDATION.FAILED', message, 422)
    this.name = 'ValidationError'
    this.errors = errors
  }

  toJSON() {
    return {
      error: {
        ...super.toJSON().error,
        errors: this.errors,
      },
    }
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super('NOT_FOUND', message, 404)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
    this.name = 'ConflictError'
  }
}

export class InfraError extends AppError {
  constructor(code: string, message: string) {
    super(`INFRA.${code}`, message, 500)
    this.name = 'InfraError'
  }
}

export class HttpError extends AppError {
  constructor(status: number, code: string, message: string) {
    super(code, message, status)
    this.name = 'HttpError'
  }
}
