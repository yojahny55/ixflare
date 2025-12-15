/**
 * Security Headers Error Classes
 * Story 5-8: Security Headers Auto-Injection
 *
 * Typed error classes for security header validation and configuration errors
 */

/**
 * Base class for security header errors
 */
export class SecurityHeaderError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'SECURITY_HEADER_ERROR'
  ) {
    super(message)
    this.name = 'SecurityHeaderError'
    Object.setPrototypeOf(this, SecurityHeaderError.prototype)
  }
}

/**
 * Error thrown when CSP configuration is invalid
 *
 * @example
 * ```typescript
 * throw new CSPConfigError(
 *   'Invalid CSP directive: script-src must be an array',
 *   'INVALID_CSP_DIRECTIVE'
 * )
 * ```
 */
export class CSPConfigError extends SecurityHeaderError {
  constructor(message: string, code: string = 'CSP_CONFIG_ERROR') {
    super(message, code)
    this.name = 'CSPConfigError'
    Object.setPrototypeOf(this, CSPConfigError.prototype)
  }
}

/**
 * Error thrown when HSTS configuration is invalid
 *
 * @example
 * ```typescript
 * throw new HSTSConfigError(
 *   'HSTS preload requires maxAge >= 31536000 and includeSubDomains = true',
 *   'HSTS_PRELOAD_REQUIREMENTS'
 * )
 * ```
 */
export class HSTSConfigError extends SecurityHeaderError {
  constructor(message: string, code: string = 'HSTS_CONFIG_ERROR') {
    super(message, code)
    this.name = 'HSTSConfigError'
    Object.setPrototypeOf(this, HSTSConfigError.prototype)
  }
}

/**
 * Error thrown when Permissions-Policy configuration is invalid
 *
 * @example
 * ```typescript
 * throw new PermissionsPolicyError(
 *   'Invalid allowlist format for camera policy',
 *   'INVALID_PERMISSIONS_POLICY'
 * )
 * ```
 */
export class PermissionsPolicyError extends SecurityHeaderError {
  constructor(message: string, code: string = 'PERMISSIONS_POLICY_ERROR') {
    super(message, code)
    this.name = 'PermissionsPolicyError'
    Object.setPrototypeOf(this, PermissionsPolicyError.prototype)
  }
}

/**
 * Error thrown when nonce generation fails
 *
 * @example
 * ```typescript
 * throw new NonceGenerationError(
 *   'Failed to generate cryptographically secure nonce',
 *   'NONCE_GENERATION_FAILED'
 * )
 * ```
 */
export class NonceGenerationError extends SecurityHeaderError {
  constructor(message: string, code: string = 'NONCE_GENERATION_ERROR') {
    super(message, code)
    this.name = 'NonceGenerationError'
    Object.setPrototypeOf(this, NonceGenerationError.prototype)
  }
}
