/**
 * Type definitions for secret management and log redaction
 * @module security/secrets/types
 */

/**
 * Configuration for secret redaction behavior
 */
export interface RedactionConfig {
  /**
   * Additional field names to redact (beyond defaults)
   * @example ['internalId', 'ssn', 'creditCard']
   */
  fields?: string[]

  /**
   * Additional regex patterns to match secrets
   * @example [/\b\d{3}-\d{2}-\d{4}\b/]
   */
  patterns?: RegExp[]

  /**
   * Fields that should never be redacted
   * @example ['userId', 'requestId']
   */
  whitelist?: string[]

  /**
   * Custom placeholder text for redacted values
   * @default '[REDACTED]'
   */
  placeholder?: string
}

/**
 * Configuration for secret management system
 */
export interface SecretConfig {
  /**
   * Enable debug mode to show secrets in development
   * WARNING: Should never be enabled in production
   * @default false
   */
  debugMode?: boolean

  /**
   * Redaction configuration
   */
  redaction?: RedactionConfig
}

/**
 * Information about a tracked secret
 */
export interface SecretInfo {
  /**
   * Name of the secret (e.g., 'STRIPE_SECRET_KEY')
   */
  name: string

  /**
   * The actual secret value (never logged or exposed)
   */
  value: string

  /**
   * When this secret was registered
   */
  registeredAt: number
}

/**
 * Result of a redaction operation
 */
export interface RedactionResult<T> {
  /**
   * The redacted value
   */
  value: T

  /**
   * Number of secrets that were redacted
   */
  redactedCount: number

  /**
   * Names of secrets that were redacted
   */
  redactedNames: string[]
}
