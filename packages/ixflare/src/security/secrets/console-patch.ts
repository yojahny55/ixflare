/**
 * Console patching for automatic secret redaction
 * Wraps global console methods to automatically redact secrets
 * @module security/secrets/console-patch
 */

import { redactConsoleArgs } from './redactor'
import { getSecretTracker } from './tracker'
import type { RedactionConfig } from './types'

/**
 * Original console methods (stored before patching)
 */
interface OriginalConsole {
  log: typeof console.log
  info: typeof console.info
  warn: typeof console.warn
  error: typeof console.error
  debug: typeof console.debug
}

let originalConsole: OriginalConsole | null = null
let isPatched = false
let patchConfig: RedactionConfig = {}

/**
 * Wrap console arguments with redaction
 * @param args - Arguments to redact
 * @returns Redacted arguments
 */
function wrapArgs(args: unknown[]): unknown[] {
  // First apply pattern-based redaction
  let redacted = redactConsoleArgs(args, patchConfig)

  // Then apply tracker-based redaction
  const tracker = getSecretTracker()
  redacted = redacted.map((arg) => redactTrackedValue(arg, tracker))

  return redacted
}

/**
 * Recursively redact tracked secrets in any value
 * @param value - Value to process
 * @param tracker - Secret tracker instance
 * @returns Value with tracked secrets redacted
 */
function redactTrackedValue(
  value: unknown,
  tracker: ReturnType<typeof getSecretTracker>
): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    return tracker.redact(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTrackedValue(item, tracker))
  }

  if (typeof value === 'object') {
    return redactTrackedInObject(value, tracker)
  }

  return value
}

/**
 * Recursively redact tracked secrets in object values
 * @param obj - Object to process
 * @param tracker - Secret tracker instance
 * @returns Object with tracked secrets redacted
 */
function redactTrackedInObject(
  obj: unknown,
  tracker: ReturnType<typeof getSecretTracker>
): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactTrackedInObject(item, tracker))
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = tracker.redact(value)
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redactTrackedInObject(value, tracker)
      } else {
        result[key] = value
      }
    }
    return result
  }

  return obj
}

/**
 * Patch the global console to automatically redact secrets
 *
 * IMPORTANT: Call this early in your application startup to ensure
 * all console output is protected.
 *
 * @param config - Optional redaction configuration
 * @returns Cleanup function to restore original console
 *
 * @example
 * ```typescript
 * import { patchConsole, getSecretTracker } from 'ixflare'
 *
 * // Patch console at app startup
 * const restore = patchConsole()
 *
 * // Track your secrets
 * const tracker = getSecretTracker()
 * tracker.track('API_KEY', env.API_KEY)
 *
 * // Now console.log will automatically redact
 * console.log('Key is:', env.API_KEY)
 * // Output: 'Key is: [REDACTED:API_KEY]'
 *
 * // Restore original console (optional, e.g., in tests)
 * restore()
 * ```
 */
export function patchConsole(config: RedactionConfig = {}): () => void {
  if (isPatched) {
    // Already patched, just update config
    patchConfig = config
    return unpatchConsole
  }

  // Store original methods
  originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  }

  patchConfig = config

  // Patch each method
  console.log = (...args: unknown[]) => {
    originalConsole!.log(...wrapArgs(args))
  }

  console.info = (...args: unknown[]) => {
    originalConsole!.info(...wrapArgs(args))
  }

  console.warn = (...args: unknown[]) => {
    originalConsole!.warn(...wrapArgs(args))
  }

  console.error = (...args: unknown[]) => {
    originalConsole!.error(...wrapArgs(args))
  }

  console.debug = (...args: unknown[]) => {
    originalConsole!.debug(...wrapArgs(args))
  }

  isPatched = true

  return unpatchConsole
}

/**
 * Restore the original console methods
 * Call this to disable automatic redaction
 *
 * @example
 * ```typescript
 * import { patchConsole, unpatchConsole } from 'ixflare'
 *
 * patchConsole()
 * // ... your code with redaction ...
 * unpatchConsole() // Restore original console
 * ```
 */
export function unpatchConsole(): void {
  if (!isPatched || !originalConsole) {
    return
  }

  console.log = originalConsole.log
  console.info = originalConsole.info
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.debug = originalConsole.debug

  originalConsole = null
  isPatched = false
  patchConfig = {}
}

/**
 * Check if console is currently patched
 * @returns True if console is patched for redaction
 */
export function isConsolePatched(): boolean {
  return isPatched
}
