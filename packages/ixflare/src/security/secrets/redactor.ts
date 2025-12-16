/**
 * Core redaction engine for sanitizing sensitive data
 * @module security/secrets/redactor
 */

import type { RedactionConfig } from './types'
import { shouldRedactField, getRedactionPatterns } from './patterns'

/**
 * Default placeholder for redacted values
 */
const DEFAULT_PLACEHOLDER = '[REDACTED]'

/**
 * Redact sensitive data from any value
 * Handles strings, objects, arrays, and primitives
 *
 * @param value - The value to redact
 * @param config - Redaction configuration
 * @returns The redacted value
 *
 * @example
 * ```typescript
 * redactValue('Bearer sk_live_abc123', {})
 * // Returns: 'Bearer [REDACTED]'
 *
 * redactValue({ password: 'secret' }, {})
 * // Returns: { password: '[REDACTED]' }
 * ```
 */
export function redactValue<T>(value: T, config: RedactionConfig = {}): T {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle strings
  if (typeof value === 'string') {
    return redactString(value, getRedactionPatterns(config.patterns)) as T
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, config)) as T
  }

  // Handle objects
  if (typeof value === 'object') {
    return redactObject(value as Record<string, unknown>, config) as T
  }

  // Primitives (number, boolean, etc.) pass through
  return value
}

/**
 * Redact secrets from a string using regex patterns
 *
 * @param str - The string to redact
 * @param patterns - Array of regex patterns to match
 * @param placeholder - Replacement text for matches
 * @returns The redacted string
 *
 * @example
 * ```typescript
 * redactString('Bearer sk_live_abc123', DEFAULT_REDACT_PATTERNS)
 * // Returns: 'Bearer [REDACTED]'
 * ```
 */
export function redactString(
  str: string,
  patterns: RegExp[] = [],
  placeholder: string = DEFAULT_PLACEHOLDER
): string {
  let result = str

  // Apply each pattern
  for (const pattern of patterns) {
    // Create a new RegExp to ensure global flag and reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    result = result.replace(regex, placeholder)
  }

  return result
}

/**
 * Redact sensitive fields from an object
 * Recursively processes nested objects and arrays
 *
 * @param obj - The object to redact
 * @param config - Redaction configuration
 * @returns The redacted object
 *
 * @example
 * ```typescript
 * redactObject({ user: 'john', password: 'secret' }, {})
 * // Returns: { user: 'john', password: '[REDACTED]' }
 * ```
 */
export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  config: RedactionConfig = {}
): T {
  const placeholder = config.placeholder ?? DEFAULT_PLACEHOLDER
  const customFields = config.fields ?? []
  const whitelist = config.whitelist ?? []
  const patterns = getRedactionPatterns(config.patterns)

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Check if this field should be redacted
    if (shouldRedactField(key, customFields, whitelist)) {
      // For sensitive fields, preserve null/undefined but redact everything else
      result[key] = (value === null || value === undefined) ? value : placeholder
      continue
    }

    // For non-redacted fields, recursively process the value
    if (value === null || value === undefined) {
      result[key] = value
    } else if (typeof value === 'string') {
      result[key] = redactString(value, patterns, placeholder)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? redactValue(item, config)
          : typeof item === 'string'
            ? redactString(item, patterns, placeholder)
            : item
      )
    } else if (typeof value === 'object') {
      result[key] = redactObject(value as Record<string, unknown>, config)
    } else {
      // Primitives pass through
      result[key] = value
    }
  }

  return result as T
}

/**
 * Redact secrets from console.log arguments
 * Used by the logger integration
 *
 * @param args - Arguments passed to console.log
 * @param config - Redaction configuration
 * @returns Redacted arguments
 * @internal
 */
export function redactConsoleArgs(
  args: unknown[],
  config: RedactionConfig = {}
): unknown[] {
  return args.map((arg) => redactValue(arg, config))
}
