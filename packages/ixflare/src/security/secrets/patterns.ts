/**
 * Default patterns and field names for secret detection
 * @module security/secrets/patterns
 */

/**
 * Default field names that should be redacted
 * Based on @logtape/redaction and OWASP guidelines
 */
export const DEFAULT_REDACT_FIELDS = [
  // Password variants
  'password',
  'passwd',
  'pwd',

  // Secrets and tokens
  'secret',
  'token',
  'key',
  'apiKey',
  'api_key',
  'apikey',

  // Authorization
  'authorization',
  'auth',
  'bearer',

  // Credentials
  'credential',
  'credentials',

  // Private keys
  'private',
  'privateKey',
  'private_key',

  // Session
  'session',
  'sessionId',
  'session_id',
  'sessionToken',
  'session_token',

  // Cookies and JWT
  'cookie',
  'jwt',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',

  // Database
  'connectionString',
  'connection_string',
  'databaseUrl',
  'database_url',
] as const

/**
 * Default regex patterns for detecting common secret formats
 */
export const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  // JWT tokens (3 base64 segments separated by dots)
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,

  // Stripe secret keys (match the full key including prefix)
  /\bsk_live_[a-zA-Z0-9]{10,}\b/g,
  /\bsk_test_[a-zA-Z0-9]{10,}\b/g,

  // Stripe publishable keys
  /\bpk_live_[a-zA-Z0-9]{10,}\b/g,
  /\bpk_test_[a-zA-Z0-9]{10,}\b/g,

  // AWS access key IDs
  /\bAKIA[0-9A-Z]{16}\b/g,

  // GitHub tokens
  /\bgh[ps]_[a-zA-Z0-9]{36,}\b/g,

  // Bearer tokens in Authorization headers
  /Bearer\s+[A-Za-z0-9_-]{20,}/g,

  // Basic auth (base64 encoded)
  /Basic\s+[A-Za-z0-9+/]+=*/g,

  // Generic API keys (long alphanumeric strings)
  // Be careful with this one - it might catch UUIDs or other IDs
  // Only match if it looks like a secret context
  // NOTE: Max length of 128 added to prevent ReDoS attacks
  /(?:key|token|secret|password)[\s:=]["']?([a-zA-Z0-9_-]{32,128})["']?/gi,
]

/**
 * Check if a field name should be redacted
 * @param fieldName - The field name to check
 * @param customFields - Additional custom field names
 * @param whitelist - Fields that should never be redacted
 * @returns True if the field should be redacted
 */
export function shouldRedactField(
  fieldName: string,
  customFields: string[] = [],
  whitelist: string[] = []
): boolean {
  // Never redact whitelisted fields
  if (whitelist.includes(fieldName)) {
    return false
  }

  const lowerFieldName = fieldName.toLowerCase()

  // Check default fields
  const isDefaultField = DEFAULT_REDACT_FIELDS.some((field) =>
    lowerFieldName.includes(field.toLowerCase())
  )

  if (isDefaultField) {
    return true
  }

  // Check custom fields
  return customFields.some((field) => lowerFieldName.includes(field.toLowerCase()))
}

/**
 * Get all active redaction patterns (default + custom)
 * @param customPatterns - Additional custom patterns
 * @returns Combined array of all patterns
 */
export function getRedactionPatterns(customPatterns: RegExp[] = []): RegExp[] {
  return [...DEFAULT_REDACT_PATTERNS, ...customPatterns]
}
