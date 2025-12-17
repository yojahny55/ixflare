/**
 * Structured logger with automatic secret redaction
 * @module security/secrets/logger
 */

import { redactConsoleArgs } from './redactor'
import { getSecretTracker } from './tracker'
import type { RedactionConfig } from './types'

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Redaction configuration
   */
  redaction?: RedactionConfig

  /**
   * Minimum log level to output
   * @default 'info'
   */
  level?: 'debug' | 'info' | 'warn' | 'error'

  /**
   * Custom output function (for testing or custom transports)
   * @default console methods
   */
  output?: {
    debug?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
}

/**
 * Log levels with numeric values for comparison
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const

/**
 * Structured logger with automatic secret redaction
 * All log output is automatically sanitized
 *
 * @example
 * ```typescript
 * import { createLogger } from 'ixflare/security/secrets'
 *
 * const logger = createLogger()
 *
 * logger.info('User authenticated', {
 *   userId: user.id,
 *   sessionToken: session.token, // Automatically redacted
 * })
 * // Output: {"level":"info","message":"User authenticated","userId":"123","sessionToken":"[REDACTED]"}
 * ```
 */
export class Logger {
  private config: LoggerConfig
  private minLevel: number

  constructor(config: LoggerConfig = {}) {
    this.config = config
    this.minLevel = LOG_LEVELS[config.level || 'info']
  }

  /**
   * Log debug message
   * @param message - Log message
   * @param args - Additional arguments
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.minLevel > LOG_LEVELS.debug) return

    const redactedArgs = this.redactArgs([message, ...args])
    const output = this.config.output?.debug || console.debug
    output(...redactedArgs)
  }

  /**
   * Log info message
   * @param message - Log message
   * @param args - Additional arguments
   */
  info(message: string, ...args: unknown[]): void {
    if (this.minLevel > LOG_LEVELS.info) return

    const redactedArgs = this.redactArgs([message, ...args])
    const output = this.config.output?.info || console.log
    output(...redactedArgs)
  }

  /**
   * Log warning message
   * @param message - Log message
   * @param args - Additional arguments
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.minLevel > LOG_LEVELS.warn) return

    const redactedArgs = this.redactArgs([message, ...args])
    const output = this.config.output?.warn || console.warn
    output(...redactedArgs)
  }

  /**
   * Log error message
   * @param message - Log message
   * @param args - Additional arguments
   */
  error(message: string, ...args: unknown[]): void {
    if (this.minLevel > LOG_LEVELS.error) return

    const redactedArgs = this.redactArgs([message, ...args])
    const output = this.config.output?.error || console.error
    output(...redactedArgs)
  }

  /**
   * Redact arguments before logging
   * @param args - Arguments to redact
   * @returns Redacted arguments
   * @private
   */
  private redactArgs(args: unknown[]): unknown[] {
    // First apply pattern-based redaction
    let redacted = redactConsoleArgs(args, this.config.redaction)

    // Then apply tracker-based redaction for each arg
    const tracker = getSecretTracker()
    redacted = redacted.map((arg) => {
      if (typeof arg === 'string') {
        return tracker.redact(arg)
      }
      return arg
    })

    return redacted
  }
}

/**
 * Create a new logger instance
 * @param config - Logger configuration
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'debug' })
 * logger.debug('Debug message')
 * ```
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config)
}

/**
 * Global logger instance
 * @internal
 */
let globalLogger: Logger | null = null

/**
 * Get the global logger instance
 * Creates one if it doesn't exist
 *
 * @returns Global logger
 * @example
 * ```typescript
 * import { logger } from 'ixflare/security/secrets'
 *
 * logger.info('Application started')
 * ```
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger()
  }
  return globalLogger
}

/**
 * Reset the global logger (mainly for testing)
 * @internal
 */
export function resetGlobalLogger(): void {
  globalLogger = null
}

/**
 * Default exported logger instance
 */
export const logger = getLogger()
