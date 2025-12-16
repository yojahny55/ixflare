/**
 * Error message sanitization to prevent secret leakage
 * @module security/secrets/error-sanitizer
 */

import { redactString, redactObject } from './redactor'
import { getRedactionPatterns } from './patterns'
import { getSecretTracker } from './tracker'
import type { RedactionConfig } from './types'

/**
 * Sanitize an error object to remove sensitive data
 * Redacts secrets from error messages, stack traces, and error context
 *
 * @param error - The error to sanitize
 * @param config - Redaction configuration
 * @returns Sanitized error object
 *
 * @example
 * ```typescript
 * try {
 *   await fetch('https://api.stripe.com', {
 *     headers: { Authorization: `Bearer ${apiKey}` }
 *   })
 * } catch (err) {
 *   const sanitized = sanitizeError(err)
 *   console.error(sanitized) // Secrets are redacted
 * }
 * ```
 */
export function sanitizeError(
  error: unknown,
  config: RedactionConfig = {}
): unknown {
  // Handle non-Error types
  if (!(error instanceof Error)) {
    // If it's a plain object, redact it
    if (typeof error === 'object' && error !== null) {
      return redactObject(error as Record<string, unknown>, config)
    }
    // For primitives, check if it's a string and redact
    if (typeof error === 'string') {
      return sanitizeString(error, config)
    }
    return error
  }

  // Create a sanitized error object
  const sanitized: Record<string, unknown> = {
    name: error.name,
    message: sanitizeString(error.message, config),
  }

  // Sanitize stack trace if present
  if (error.stack) {
    sanitized.stack = sanitizeString(error.stack, config)
  }

  // Sanitize any additional properties
  // Many errors have custom properties like `cause`, `code`, etc.
  for (const [key, value] of Object.entries(error)) {
    if (key === 'message' || key === 'stack' || key === 'name') {
      continue // Already handled
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, config)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactObject(value as Record<string, unknown>, config)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Sanitize a string using both pattern-based and tracker-based redaction
 * @param str - String to sanitize
 * @param config - Redaction configuration
 * @returns Sanitized string
 * @internal
 */
function sanitizeString(str: string, config: RedactionConfig = {}): string {
  // First apply pattern-based redaction
  let result = redactString(str, getRedactionPatterns(config.patterns))

  // Then apply tracker-based redaction
  const tracker = getSecretTracker()
  result = tracker.redact(result)

  return result
}

/**
 * Sanitize fetch error details
 * Specifically handles errors from fetch() that may contain URLs, headers, etc.
 *
 * @param error - Fetch error to sanitize
 * @param config - Redaction configuration
 * @returns Sanitized error
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch(url, {
 *     headers: { Authorization: `Bearer ${secret}` }
 *   })
 * } catch (err) {
 *   const sanitized = sanitizeFetchError(err)
 *   console.error(sanitized) // Headers are redacted
 * }
 * ```
 */
export function sanitizeFetchError(
  error: unknown,
  config: RedactionConfig = {}
): unknown {
  // Start with basic sanitization
  const sanitized = sanitizeError(error, config)

  // If it's an object, check for common fetch error properties
  if (typeof sanitized === 'object' && sanitized !== null) {
    const errorObj = sanitized as Record<string, unknown>

    // Sanitize URL if present
    if (typeof errorObj.url === 'string') {
      errorObj.url = sanitizeString(errorObj.url, config)
    }

    // Sanitize headers if present
    if (typeof errorObj.headers === 'object' && errorObj.headers !== null) {
      errorObj.headers = redactObject(
        errorObj.headers as Record<string, unknown>,
        config
      )
    }

    // Sanitize request/response details if present
    if (
      typeof errorObj.request === 'object' &&
      errorObj.request !== null
    ) {
      errorObj.request = redactObject(
        errorObj.request as Record<string, unknown>,
        config
      )
    }

    if (
      typeof errorObj.response === 'object' &&
      errorObj.response !== null
    ) {
      errorObj.response = redactObject(
        errorObj.response as Record<string, unknown>,
        config
      )
    }
  }

  return sanitized
}

/**
 * Create a safe error for logging
 * Removes stack traces and sanitizes all sensitive data
 *
 * @param error - Error to make safe
 * @param config - Redaction configuration
 * @returns Safe error object for logging
 *
 * @example
 * ```typescript
 * try {
 *   // ... some operation
 * } catch (err) {
 *   const safeError = createSafeError(err)
 *   // Send to error tracking service
 *   await logToService(safeError)
 * }
 * ```
 */
export function createSafeError(
  error: unknown,
  config: RedactionConfig = {}
): { name: string; message: string; [key: string]: unknown } {
  const sanitized = sanitizeError(error, config)

  if (typeof sanitized === 'object' && sanitized !== null) {
    const sanitizedObj = sanitized as Record<string, unknown>

    return {
      name: String(sanitizedObj.name || 'Error'),
      message: String(sanitizedObj.message || 'Unknown error'),
      // Include other properties but exclude stack
      ...Object.fromEntries(
        Object.entries(sanitizedObj).filter(
          ([key]) => key !== 'stack' && key !== 'name' && key !== 'message'
        )
      ),
    }
  }

  return {
    name: 'Error',
    message: String(sanitized),
  }
}
