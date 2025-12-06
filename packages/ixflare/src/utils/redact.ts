/**
 * @module utils/redact
 * @description Secret redaction utilities for secure logging
 * @universal - Pure function, no runtime dependencies
 */

/**
 * Default patterns for identifying sensitive keys
 * Matches common secret/credential naming conventions
 */
const SENSITIVE_PATTERNS = [
  /API[_-]?KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /PRIVATE[_-]?KEY/i,
  /AUTH/i,
]

/**
 * Redact sensitive values from an object based on key patterns
 *
 * @example
 * ```typescript
 * const env = {
 *   DATABASE_URL: 'postgres://...',
 *   API_KEY: 'sk_live_abc123',
 *   JWT_SECRET: 'supersecret',
 *   DEBUG: true
 * }
 *
 * const safe = redactSecrets(env)
 * // {
 * //   DATABASE_URL: 'postgres://...',
 * //   API_KEY: '[REDACTED]',
 * //   JWT_SECRET: '[REDACTED]',
 * //   DEBUG: true
 * // }
 * ```
 *
 * @param obj - Object to redact secrets from
 * @param sensitiveKeys - Custom regex patterns to identify sensitive keys (defaults to SENSITIVE_PATTERNS)
 * @returns New object with sensitive values replaced with '[REDACTED]'
 */
export function redactSecrets(
  obj: Record<string, unknown>,
  sensitiveKeys?: RegExp[]
): Record<string, unknown> {
  const patterns = sensitiveKeys ?? SENSITIVE_PATTERNS
  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      redacted[key] = '[REDACTED]'
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Redact sensitive values from a string based on known patterns
 * Useful for sanitizing error messages and logs
 *
 * @example
 * ```typescript
 * const message = 'Connection failed with API_KEY=sk_live_abc123'
 * const safe = redactString(message)
 * // 'Connection failed with API_KEY=[REDACTED]'
 * ```
 *
 * @param str - String to redact secrets from
 * @param sensitiveKeys - Custom regex patterns (defaults to SENSITIVE_PATTERNS)
 * @returns String with sensitive values replaced with '[REDACTED]'
 */
export function redactString(str: string, sensitiveKeys?: RegExp[]): string {
  const patterns = sensitiveKeys ?? SENSITIVE_PATTERNS
  let result = str

  // Pattern to match KEY=value or KEY: value
  const valuePattern = /(\w+)\s*[=:]\s*([^\s,;)}\]]+)/g

  result = result.replace(valuePattern, (match, key) => {
    if (patterns.some((pattern) => pattern.test(key))) {
      return `${key}=[REDACTED]`
    }
    return match
  })

  return result
}

/**
 * Check if a key is considered sensitive based on patterns
 *
 * @param key - Key name to check
 * @param sensitiveKeys - Custom regex patterns (defaults to SENSITIVE_PATTERNS)
 * @returns True if key matches a sensitive pattern
 */
export function isSensitiveKey(key: string, sensitiveKeys?: RegExp[]): boolean {
  const patterns = sensitiveKeys ?? SENSITIVE_PATTERNS
  return patterns.some((pattern) => pattern.test(key))
}
