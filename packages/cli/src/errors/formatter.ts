/**
 * Error message formatting with actionable guidance
 * @packageDocumentation
 */

import pc from 'picocolors'
import type { CLIError } from './cli-error'
import type { FormatOptions } from './types'
import { formatSourceLocation } from './code-snippet'

/**
 * Format a CLIError for display in the terminal
 * Follows the error message anatomy:
 * 1. Error indicator (icon + type)
 * 2. What went wrong (clear description)
 * 3. Why it might have happened (common causes)
 * 4. How to fix it (actionable steps)
 * 5. Where to learn more (documentation link)
 *
 * @param error - The CLI error to format
 * @param options - Formatting options
 * @returns Formatted error message
 */
export function formatError(error: CLIError, options: FormatOptions): string {
  const lines: string[] = []

  // 1. Error header: icon + code + message
  const icon = getErrorIcon(error.severity)
  const styledIcon = options.color ? pc.red(icon) : icon
  const styledCode = options.color ? pc.bold(pc.red(error.code)) : error.code
  const styledMessage = options.color ? pc.bold(error.message) : error.message

  lines.push(`${styledIcon} ${styledCode}: ${styledMessage}`)
  lines.push('')

  // 2. Source location (if available)
  if (error.sourceLocation) {
    lines.push(formatSourceLocation(error.sourceLocation, options))
    lines.push('')
  }

  // 3. Common causes (numbered list)
  if (error.causes.length > 0) {
    const header = options.color ? pc.dim('This usually means:') : 'This usually means:'
    lines.push(header)
    error.causes.forEach((cause, i) => {
      lines.push(`  ${i + 1}. ${cause}`)
    })
    lines.push('')
  }

  // 4. Quick fixes (bullet list)
  if (error.fixes.length > 0) {
    const header = options.color ? pc.dim('Quick fixes:') : 'Quick fixes:'
    lines.push(header)
    error.fixes.forEach((fix) => {
      // Highlight commands in fixes (text between backticks)
      const styledFix = options.color ? highlightCommands(fix) : fix
      lines.push(`  • ${styledFix}`)
    })
    lines.push('')
  }

  // 5. Documentation link
  if (error.docsUrl) {
    const label = options.color ? pc.dim('📖 More info:') : 'More info:'
    const url = options.color ? pc.cyan(error.docsUrl) : error.docsUrl
    lines.push(`${label} ${url}`)
    lines.push('')
  }

  // 6. Verbose mode: show stack trace and original error
  if (options.verbose) {
    lines.push(formatVerboseInfo(error, options))
  }

  return lines.join('\n')
}

/**
 * Format verbose debugging information
 */
function formatVerboseInfo(error: CLIError, options: FormatOptions): string {
  const lines: string[] = []

  const header = options.color
    ? pc.yellow('Verbose Debug Information:')
    : 'Verbose Debug Information:'
  lines.push(header)
  lines.push('')

  // Stack trace
  if (error.stack) {
    const stackHeader = options.color ? pc.dim('Stack trace:') : 'Stack trace:'
    lines.push(stackHeader)
    const stack = error.stack.split('\n').slice(1).join('\n') // Skip first line (error message)
    lines.push(options.color ? pc.dim(stack) : stack)
    lines.push('')
  }

  // Original error (if wrapped)
  if (error.originalError) {
    const originalHeader = options.color ? pc.dim('Original error:') : 'Original error:'
    lines.push(originalHeader)
    lines.push(error.originalError.message)
    if (error.originalError.stack) {
      lines.push(options.color ? pc.dim(error.originalError.stack) : error.originalError.stack)
    }
    lines.push('')
  }

  // Environment information
  const envHeader = options.color ? pc.dim('Environment:') : 'Environment:'
  lines.push(envHeader)
  lines.push(`  Node version: ${process.version}`)
  lines.push(`  Platform: ${process.platform}`)
  lines.push(`  Architecture: ${process.arch}`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Get icon for error severity
 */
function getErrorIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return '❌'
    case 'warning':
      return '⚠️'
    case 'info':
      return 'ℹ️'
    default:
      return '❌'
  }
}

/**
 * Highlight command text (between backticks) in cyan
 */
function highlightCommands(text: string): string {
  return text.replace(/`([^`]+)`/g, (_, command) => pc.cyan(command))
}

/**
 * Detect display options from CLI arguments and environment
 */
export function detectDisplayOptions(args: string[] = process.argv): FormatOptions {
  const isTTY = !!process.stdout.isTTY
  const noColor = args.includes('--no-color') || !!process.env.NO_COLOR || !isTTY

  const verbose = args.includes('--verbose') || args.includes('-v')

  const interactive = isTTY && !process.env.CI && !args.includes('--no-interactive')

  return {
    color: !noColor,
    verbose,
    interactive,
  }
}

/**
 * Format and print an error to stderr, then exit
 */
export function formatAndExit(error: CLIError, exitCode: number = 1): never {
  const options = detectDisplayOptions()
  console.error(error.format(options))
  process.exit(exitCode)
}
