/**
 * Secret management and log redaction for Ixflare
 * Provides automatic redaction of sensitive data in logs and error messages
 * @module security/secrets
 */

export type {
  RedactionConfig,
  SecretConfig,
  SecretInfo,
  RedactionResult,
} from './types'

export {
  DEFAULT_REDACT_FIELDS,
  DEFAULT_REDACT_PATTERNS,
  shouldRedactField,
  getRedactionPatterns,
} from './patterns'

export { redactValue, redactString, redactObject } from './redactor'

export { SecretTracker, getSecretTracker, autoTrackSecrets } from './tracker'

export { patchConsole, unpatchConsole, isConsolePatched } from './console-patch'

export {
  sanitizeError,
  sanitizeFetchError,
  createSafeError,
} from './error-sanitizer'

export type { LoggerConfig } from './logger'
export { Logger, createLogger, getLogger, logger } from './logger'
