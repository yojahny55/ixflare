/**
 * @module config/errors
 * @description Config-specific error classes and formatting utilities
 * @universal - Used in both Node.js build and Workers runtime
 */

import type { ZodError, ZodIssue } from 'zod'

/**
 * Configuration error class for config-related failures
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly issues: ConfigIssue[] = [],
    public readonly filePath?: string
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Individual configuration issue
 */
export interface ConfigIssue {
  /** Dot-notation path to the problematic field */
  path: string
  /** Human-readable error message */
  message: string
  /** Expected value or type */
  expected?: string
  /** Received value or type */
  received?: string
}

/**
 * Common configuration mistake patterns and their fixes
 */
const FIX_SUGGESTIONS: Record<string, string> = {
  name: 'Ensure "name" is a non-empty string (1-100 characters)',
  'database.binding': 'Use a valid D1 binding name (e.g., "DB")',
  'database.warmup': 'Set to true or false',
  'cache.binding': 'Use a valid KV binding name (e.g., "CACHE")',
  'cache.defaultTtl': 'Use a positive integer for TTL in seconds (e.g., 3600)',
  'security.csrf': 'Set to true or false',
  'security.headers': 'Set to true or false',
  'hooks.pre-build': 'Provide a function: () => void | Promise<void>',
  'hooks.post-build': 'Provide a function: (ctx: { outputPath: string }) => void',
  'hooks.pre-deploy': 'Provide a function: (ctx: { environment: string }) => void',
  'hooks.post-deploy': 'Provide a function: (ctx: { url: string }) => void',
  'commands': 'Provide an object with description and handler for each command',
}

/**
 * Format a single Zod issue into a readable ConfigIssue
 */
function formatIssue(issue: ZodIssue): ConfigIssue {
  const path = issue.path.join('.')
  let message = issue.message

  // Enhance message based on issue code
  if (issue.code === 'invalid_type') {
    message = `Expected ${issue.expected}, received ${issue.received}`
  } else if (issue.code === 'too_small') {
    if (issue.type === 'string') {
      message = `String must be at least ${issue.minimum} character(s)`
    } else if (issue.type === 'number') {
      message = `Number must be greater than or equal to ${issue.minimum}`
    }
  } else if (issue.code === 'too_big') {
    if (issue.type === 'string') {
      message = `String must be at most ${issue.maximum} character(s)`
    }
  }

  return {
    path: path || 'config',
    message,
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? String(issue.received) : undefined,
  }
}

/**
 * Get fix suggestion for a configuration path
 */
function getFixSuggestion(path: string): string | undefined {
  // Try exact match first
  if (FIX_SUGGESTIONS[path]) {
    return FIX_SUGGESTIONS[path]
  }

  // Try parent path match
  const parts = path.split('.')
  while (parts.length > 0) {
    const parentPath = parts.join('.')
    if (FIX_SUGGESTIONS[parentPath]) {
      return FIX_SUGGESTIONS[parentPath]
    }
    parts.pop()
  }

  return undefined
}

/**
 * Format Zod validation errors into developer-friendly messages
 *
 * @param error - Zod validation error
 * @param filePath - Optional path to the config file for better error context
 * @returns Formatted error message string
 */
export function formatConfigError(error: ZodError, filePath?: string): string {
  const issues = error.issues.map(formatIssue)

  const issueLines = issues.map((issue) => {
    const fixSuggestion = getFixSuggestion(issue.path)
    let line = `  • ${issue.path}: ${issue.message}`
    if (fixSuggestion) {
      line += `\n    Fix: ${fixSuggestion}`
    }
    return line
  })

  const fileContext = filePath ? ` in ${filePath}` : ''

  return `
Invalid edge.config.ts configuration${fileContext}:

${issueLines.join('\n\n')}

For configuration reference, see: https://ixflare.dev/docs/configuration
`.trim()
}

/**
 * Create a ConfigError from a Zod validation error
 *
 * @param error - Zod validation error
 * @param filePath - Optional path to the config file
 * @returns ConfigError with formatted message and issues
 */
export function createConfigError(
  error: ZodError,
  filePath?: string
): ConfigError {
  const issues = error.issues.map(formatIssue)
  const message = formatConfigError(error, filePath)
  return new ConfigError(message, issues, filePath)
}
