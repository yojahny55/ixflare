/**
 * Ixflare CLI Error System
 *
 * Provides structured, actionable error messages with:
 * - Error codes for searchability
 * - Common causes and quick fixes
 * - Code snippets with line numbers
 * - Syntax highlighting
 * - Documentation links
 * - Verbose mode for debugging
 * - NO_COLOR support
 *
 * @packageDocumentation
 */

// Core error class
export { CLIError, isCLIError } from './cli-error'

// Specific error types
export { ConfigError } from './config-error'
export { BuildError } from './build-error'
export { DeployError } from './deploy-error'
export { DatabaseError } from './database-error'
export { AuthError } from './auth-error'

// Formatting utilities
export { formatError, detectDisplayOptions, formatAndExit } from './formatter'
export { formatCodeSnippet, formatSourceLocation, extractCodeSnippet } from './code-snippet'

// Error codes
export {
  ERROR_CODES,
  ERROR_DOCS_BASE_URL,
  getErrorMeta,
  getErrorDocsUrl,
  isValidErrorCode,
  getErrorCodesByCategory,
} from './codes'

// Types
export type {
  ErrorSeverity,
  ErrorCategory,
  SourceLocation,
  CLIErrorOptions,
  FormatOptions,
  ErrorCodeMeta,
  ErrorCodeRegistry,
} from './types'
