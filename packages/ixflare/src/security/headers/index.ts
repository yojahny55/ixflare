/**
 * Security Headers Module
 * Story 5-8: Security Headers Auto-Injection
 *
 * Barrel export for all security header functionality
 */

// Types
export type {
  CSPSource,
  ContentSecurityPolicyConfig,
  HSTSConfig,
  PermissionsPolicyConfig,
  ReferrerPolicy,
  XFrameOptions,
  CrossOriginEmbedderPolicy,
  CrossOriginOpenerPolicy,
  CrossOriginResourcePolicy,
  SecurityHeadersConfig,
} from './types'

// Error classes
export {
  SecurityHeaderError,
  CSPConfigError,
  HSTSConfigError,
  PermissionsPolicyError,
  NonceGenerationError,
} from './errors'

// CSP Builder
export {
  generateNonce,
  getNonce,
  setRequestNonce,
  clearRequestNonce,
  buildCSPHeader,
  getCSPHeaderName,
  DEFAULT_CSP_CONFIG,
} from './csp'

// HSTS Builder
export {
  buildHSTSHeader,
  validateHSTSPreloadRequirements,
  createHttpsRedirectMiddleware,
  DEFAULT_HSTS_CONFIG,
  HSTS_PRELOAD_MIN_MAX_AGE,
} from './hsts'

// Permissions-Policy Builder
export { buildPermissionsPolicyHeader, DEFAULT_PERMISSIONS_POLICY_CONFIG } from './permissions'

// Common Headers Builders
export {
  buildXContentTypeOptionsHeader,
  buildXFrameOptionsHeader,
  buildReferrerPolicyHeader,
  buildXXssProtectionHeader,
  buildCrossOriginEmbedderPolicyHeader,
  buildCrossOriginOpenerPolicyHeader,
  buildCrossOriginResourcePolicyHeader,
  DEFAULT_SECURITY_HEADERS,
} from './common'

// Middleware
export { createSecurityHeadersMiddleware, DEFAULT_SECURITY_HEADERS_CONFIG } from './middleware'
