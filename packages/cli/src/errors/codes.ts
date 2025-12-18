/**
 * Error code registry for Ixflare CLI
 *
 * Error code format: IX_E{category}{number}
 * - IX_E1XX: Configuration errors
 * - IX_E2XX: Build errors
 * - IX_E3XX: Deployment errors
 * - IX_E4XX: Database/migration errors
 * - IX_E5XX: Authentication errors
 * - IX_E9XX: Internal/unexpected errors
 *
 * @packageDocumentation
 */

import type { ErrorCodeRegistry } from './types'

/**
 * Base URL for error documentation
 */
export const ERROR_DOCS_BASE_URL = 'https://ixflare.dev'

/**
 * Complete error code catalog with metadata
 */
export const ERROR_CODES: ErrorCodeRegistry = {
  // Configuration Errors (IX_E1XX)
  IX_E101: {
    category: 'config',
    title: 'Invalid Configuration Syntax',
    docsPath: '/errors/IX_E101',
  },
  IX_E102: {
    category: 'config',
    title: 'Missing Required Configuration',
    docsPath: '/errors/IX_E102',
  },
  IX_E103: {
    category: 'config',
    title: 'Invalid Configuration Value',
    docsPath: '/errors/IX_E103',
  },
  IX_E104: {
    category: 'config',
    title: 'Configuration File Not Found',
    docsPath: '/errors/IX_E104',
  },
  IX_E105: {
    category: 'config',
    title: 'Invalid TypeScript Configuration',
    docsPath: '/errors/IX_E105',
  },

  // Build Errors (IX_E2XX)
  IX_E201: {
    category: 'build',
    title: 'TypeScript Compilation Error',
    docsPath: '/errors/IX_E201',
  },
  IX_E202: {
    category: 'build',
    title: 'Bundle Size Exceeded',
    docsPath: '/errors/IX_E202',
  },
  IX_E203: {
    category: 'build',
    title: 'Module Not Found',
    docsPath: '/errors/IX_E203',
  },
  IX_E204: {
    category: 'build',
    title: 'Build Process Failed',
    docsPath: '/errors/IX_E204',
  },
  IX_E205: {
    category: 'build',
    title: 'Invalid Import in Worker Code',
    docsPath: '/errors/IX_E205',
  },

  // Deployment Errors (IX_E3XX)
  IX_E301: {
    category: 'deploy',
    title: 'Missing Cloudflare Credentials',
    docsPath: '/errors/IX_E301',
  },
  IX_E302: {
    category: 'deploy',
    title: 'Wrangler Configuration Missing',
    docsPath: '/errors/IX_E302',
  },
  IX_E303: {
    category: 'deploy',
    title: 'Deployment Validation Failed',
    docsPath: '/errors/IX_E303',
  },
  IX_E304: {
    category: 'deploy',
    title: 'Deployment Hook Failed',
    docsPath: '/errors/IX_E304',
  },
  IX_E305: {
    category: 'deploy',
    title: 'Worker Script Too Large',
    docsPath: '/errors/IX_E305',
  },

  // Database Errors (IX_E4XX)
  IX_E401: {
    category: 'database',
    title: 'Migration File Not Found',
    docsPath: '/errors/IX_E401',
  },
  IX_E402: {
    category: 'database',
    title: 'Schema Validation Failed',
    docsPath: '/errors/IX_E402',
  },
  IX_E403: {
    category: 'database',
    title: 'Migration Failed',
    docsPath: '/errors/IX_E403',
  },
  IX_E404: {
    category: 'database',
    title: 'Database Connection Failed',
    docsPath: '/errors/IX_E404',
  },
  IX_E405: {
    category: 'database',
    title: 'Invalid Model Definition',
    docsPath: '/errors/IX_E405',
  },

  // Authentication Errors (IX_E5XX)
  IX_E501: {
    category: 'auth',
    title: 'Invalid JWT Configuration',
    docsPath: '/errors/IX_E501',
  },
  IX_E502: {
    category: 'auth',
    title: 'Key Rotation Failed',
    docsPath: '/errors/IX_E502',
  },
  IX_E503: {
    category: 'auth',
    title: 'Missing Authentication Secrets',
    docsPath: '/errors/IX_E503',
  },

  // Internal Errors (IX_E9XX)
  IX_E901: {
    category: 'internal',
    title: 'Unexpected Internal Error',
    docsPath: '/errors/IX_E901',
  },
  IX_E902: {
    category: 'internal',
    title: 'Invalid CLI Arguments',
    docsPath: '/errors/IX_E902',
  },
  IX_E903: {
    category: 'internal',
    title: 'File System Error',
    docsPath: '/errors/IX_E903',
  },
} as const

/**
 * Get error code metadata by code
 */
export function getErrorMeta(code: string): ErrorCodeRegistry[string] | undefined {
  return ERROR_CODES[code as keyof typeof ERROR_CODES]
}

/**
 * Get full documentation URL for an error code
 */
export function getErrorDocsUrl(code: string): string | undefined {
  const meta = getErrorMeta(code)
  if (!meta) return undefined
  return `${ERROR_DOCS_BASE_URL}${meta.docsPath}`
}

/**
 * Validate that an error code exists in the registry
 */
export function isValidErrorCode(code: string): code is keyof typeof ERROR_CODES {
  return code in ERROR_CODES
}

/**
 * Get all error codes for a specific category
 */
export function getErrorCodesByCategory(category: string): string[] {
  return Object.entries(ERROR_CODES)
    .filter(([_, meta]) => meta.category === category)
    .map(([code]) => code)
}
