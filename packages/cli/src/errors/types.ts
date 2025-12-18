/**
 * Error system types for Ixflare CLI
 * @packageDocumentation
 */

/**
 * Severity levels for errors
 */
export type ErrorSeverity = 'error' | 'warning' | 'info'

/**
 * Error code categories
 * - IX_E1XX: Configuration errors
 * - IX_E2XX: Build errors
 * - IX_E3XX: Deployment errors
 * - IX_E4XX: Database/migration errors
 * - IX_E5XX: Authentication errors
 * - IX_E9XX: Internal/unexpected errors
 */
export type ErrorCategory = 'config' | 'build' | 'deploy' | 'database' | 'auth' | 'internal'

/**
 * Source location for code snippets in error messages
 */
export interface SourceLocation {
  /** File path where error occurred */
  file: string
  /** Line number where error occurred */
  line: number
  /** Column number where error occurred (optional) */
  column?: number
  /** Length of error span (optional) */
  length?: number
  /** Code snippet to display (optional) */
  snippet?: string
}

/**
 * Options for creating a CLI error
 */
export interface CLIErrorOptions {
  /** Error code (e.g., "IX_E101") */
  code: string
  /** Human-readable error message */
  message: string
  /** List of possible causes for this error */
  causes?: string[]
  /** List of quick fixes to try */
  fixes?: string[]
  /** Documentation URL for more information */
  docsUrl?: string
  /** Source code location where error occurred */
  sourceLocation?: SourceLocation
  /** Error severity (defaults to 'error') */
  severity?: ErrorSeverity
  /** Original error that caused this (for wrapping) */
  originalError?: Error
}

/**
 * Display formatting options for error output
 */
export interface FormatOptions {
  /** Enable/disable colors in output */
  color: boolean
  /** Show verbose output (stack traces, etc.) */
  verbose: boolean
  /** Interactive mode (TTY detected) */
  interactive: boolean
}

/**
 * Error code metadata
 */
export interface ErrorCodeMeta {
  /** Error code category */
  category: ErrorCategory
  /** Short title for this error */
  title: string
  /** Path to documentation (relative to base URL) */
  docsPath: string
}

/**
 * Error code registry type
 */
export type ErrorCodeRegistry = Record<string, ErrorCodeMeta>
