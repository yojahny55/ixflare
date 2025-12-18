/**
 * CLIError base class for all Ixflare CLI errors
 * @packageDocumentation
 */

import type { CLIErrorOptions, SourceLocation, ErrorSeverity } from './types'
import { formatError } from './formatter'
import type { FormatOptions } from './types'

/**
 * Base class for all CLI errors
 * Provides structured error information with actionable guidance
 */
export class CLIError extends Error {
  /** Error code (e.g., "IX_E101") */
  readonly code: string

  /** List of possible causes for this error */
  readonly causes: string[]

  /** List of quick fixes to try */
  readonly fixes: string[]

  /** Documentation URL for more information */
  readonly docsUrl?: string

  /** Source code location where error occurred */
  readonly sourceLocation?: SourceLocation

  /** Error severity level */
  readonly severity: ErrorSeverity

  /** Original error that caused this (for wrapping) */
  readonly originalError?: Error

  constructor(options: CLIErrorOptions) {
    super(options.message)

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    this.name = 'CLIError'
    this.code = options.code
    this.causes = options.causes || []
    this.fixes = options.fixes || []
    this.docsUrl = options.docsUrl
    this.sourceLocation = options.sourceLocation
    this.severity = options.severity || 'error'
    this.originalError = options.originalError
  }

  /**
   * Format the error for display in the terminal
   */
  format(options: FormatOptions): string {
    return formatError(this, options)
  }

  /**
   * Get a JSON representation of the error
   * Useful for logging or debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      causes: this.causes,
      fixes: this.fixes,
      docsUrl: this.docsUrl,
      sourceLocation: this.sourceLocation,
      severity: this.severity,
      stack: this.stack,
    }
  }
}

/**
 * Type guard to check if an error is a CLIError
 */
export function isCLIError(error: unknown): error is CLIError {
  return error instanceof CLIError
}
