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
    causes: [
      'Syntax error in edge.config.ts',
      'Missing comma or bracket in configuration object',
      'Invalid TypeScript syntax',
    ],
    fixes: [
      'Check edge.config.ts for syntax errors',
      'Run `pnpm typecheck` to find TypeScript issues',
      'Validate JSON/object structure',
    ],
  },
  IX_E102: {
    category: 'config',
    title: 'Missing Required Configuration',
    docsPath: '/errors/IX_E102',
    causes: [
      'edge.config.ts file not found in project root',
      'Required configuration field is missing',
    ],
    fixes: [
      'Create edge.config.ts: `touch edge.config.ts`',
      'Copy from template: check docs for starter config',
      'Ensure all required fields are present',
    ],
  },
  IX_E103: {
    category: 'config',
    title: 'Invalid Configuration Value',
    docsPath: '/errors/IX_E103',
    causes: [
      'Value does not match expected type',
      'Value is outside allowed range',
      'Unsupported option specified',
    ],
    fixes: [
      'Check documentation for valid values',
      'Review TypeScript type hints in editor',
      'Use autocomplete to see available options',
    ],
  },
  IX_E104: {
    category: 'config',
    title: 'Configuration File Not Found',
    docsPath: '/errors/IX_E104',
    causes: [
      'edge.config.ts does not exist',
      'Running command from wrong directory',
      'File was deleted or moved',
    ],
    fixes: [
      'Create edge.config.ts in project root',
      'Run command from project root directory',
      'Check if file exists: `ls edge.config.ts`',
    ],
  },
  IX_E105: {
    category: 'config',
    title: 'Invalid TypeScript Configuration',
    docsPath: '/errors/IX_E105',
    causes: [
      'tsconfig.json has invalid settings',
      'Missing required compiler options',
      'Incompatible TypeScript version',
    ],
    fixes: [
      'Check tsconfig.json for errors',
      'Ensure "strict": true is set',
      'Update TypeScript: `pnpm add -D typescript@latest`',
    ],
  },

  // Build Errors (IX_E2XX)
  IX_E201: {
    category: 'build',
    title: 'TypeScript Compilation Error',
    docsPath: '/errors/IX_E201',
    causes: [
      'Type errors in source code',
      'Missing type definitions',
      'Incompatible type assignments',
    ],
    fixes: [
      'Run `pnpm typecheck` to see all errors',
      'Fix type errors shown in editor',
      'Install missing @types packages',
    ],
  },
  IX_E202: {
    category: 'build',
    title: 'Bundle Size Exceeded',
    docsPath: '/errors/IX_E202',
    causes: [
      'Worker bundle exceeds 1MB limit',
      'Large dependencies included',
      'Unoptimized imports',
    ],
    fixes: [
      'Use tree-shaking: import only what you need',
      'Check for large dependencies with `pnpm why <pkg>`',
      'Consider code splitting or lazy loading',
    ],
  },
  IX_E203: {
    category: 'build',
    title: 'Module Not Found',
    docsPath: '/errors/IX_E203',
    causes: [
      'Package not installed',
      'Typo in import path',
      'Path alias not configured',
    ],
    fixes: [
      'Install missing package: `pnpm add <package>`',
      'Check import path for typos',
      'Verify tsconfig.json paths configuration',
    ],
  },
  IX_E204: {
    category: 'build',
    title: 'Build Process Failed',
    docsPath: '/errors/IX_E204',
    causes: [
      'Vite build error',
      'Plugin configuration issue',
      'Missing build dependencies',
    ],
    fixes: [
      'Check build output for specific error',
      'Run `pnpm install` to ensure dependencies',
      'Clear cache: `rm -rf node_modules/.vite`',
    ],
  },
  IX_E205: {
    category: 'build',
    title: 'Invalid Import in Worker Code',
    docsPath: '/errors/IX_E205',
    causes: [
      'Node.js module imported in Worker code',
      'Using fs, path, or other Node APIs',
      '@node-only code imported in @worker-only package',
    ],
    fixes: [
      'Use Web APIs instead of Node.js APIs',
      'Check package boundaries in project-context.md',
      'Move Node.js code to CLI package',
    ],
  },

  // Deployment Errors (IX_E3XX)
  IX_E301: {
    category: 'deploy',
    title: 'Missing Cloudflare Credentials',
    docsPath: '/errors/IX_E301',
    causes: [
      'CLOUDFLARE_API_TOKEN not set',
      'Not logged in to Wrangler',
      'Token expired or revoked',
    ],
    fixes: [
      'Run: `wrangler login`',
      'Set CLOUDFLARE_API_TOKEN environment variable',
      'Get token at: https://dash.cloudflare.com/profile/api-tokens',
    ],
  },
  IX_E302: {
    category: 'deploy',
    title: 'Wrangler Configuration Missing',
    docsPath: '/errors/IX_E302',
    causes: [
      'wrangler.toml not found',
      'Invalid wrangler.toml syntax',
      'Missing required wrangler fields',
    ],
    fixes: [
      'Create wrangler.toml: `touch wrangler.toml`',
      'Run `ix generate` to scaffold config',
      'Check wrangler.toml syntax',
    ],
  },
  IX_E303: {
    category: 'deploy',
    title: 'Deployment Validation Failed',
    docsPath: '/errors/IX_E303',
    causes: [
      'Pre-deployment checks failed',
      'TypeScript errors in code',
      'Missing required bindings',
    ],
    fixes: [
      'Run `pnpm build` locally first',
      'Fix all TypeScript errors',
      'Check wrangler.toml bindings configuration',
    ],
  },
  IX_E304: {
    category: 'deploy',
    title: 'Deployment Hook Failed',
    docsPath: '/errors/IX_E304',
    causes: [
      'Pre-deploy hook script failed',
      'Post-deploy hook script failed',
      'Hook command not found',
    ],
    fixes: [
      'Check hook script for errors',
      'Ensure hook commands are executable',
      'Review hook output for details',
    ],
  },
  IX_E305: {
    category: 'deploy',
    title: 'Worker Script Too Large',
    docsPath: '/errors/IX_E305',
    causes: [
      'Compiled Worker exceeds size limit',
      'Too many dependencies bundled',
      'Large static assets included',
    ],
    fixes: [
      'Reduce bundle size (see IX_E202)',
      'Move assets to R2 or external CDN',
      'Enable gzip compression',
    ],
  },

  // Database Errors (IX_E4XX)
  IX_E401: {
    category: 'database',
    title: 'Migration File Not Found',
    docsPath: '/errors/IX_E401',
    causes: [
      'Migration file deleted or moved',
      'Migrations directory not found',
      'Migration name typo',
    ],
    fixes: [
      'Check drizzle/ directory for migrations',
      'Generate new migration: `ix migrate:generate`',
      'Verify migration file exists',
    ],
  },
  IX_E402: {
    category: 'database',
    title: 'Schema Validation Failed',
    docsPath: '/errors/IX_E402',
    causes: [
      'Schema definition has errors',
      'Invalid column type',
      'Foreign key constraint issue',
    ],
    fixes: [
      'Check schema file for TypeScript errors',
      'Verify column types are valid for D1/SQLite',
      'Review foreign key references',
    ],
  },
  IX_E403: {
    category: 'database',
    title: 'Migration Failed',
    docsPath: '/errors/IX_E403',
    causes: [
      'SQL syntax error in migration',
      'Constraint violation',
      'Table already exists',
    ],
    fixes: [
      'Review migration SQL for errors',
      'Check for data conflicts',
      'Use --force for destructive changes (carefully)',
    ],
  },
  IX_E404: {
    category: 'database',
    title: 'Database Connection Failed',
    docsPath: '/errors/IX_E404',
    causes: [
      'D1 database not configured',
      'Local database file missing',
      'Remote database unreachable',
    ],
    fixes: [
      'Check wrangler.toml for D1 binding',
      'Create local database: `wrangler d1 create <name>`',
      'Verify network connectivity',
    ],
  },
  IX_E405: {
    category: 'database',
    title: 'Invalid Model Definition',
    docsPath: '/errors/IX_E405',
    causes: [
      'EdgeRecord model has invalid fields',
      'Missing required model properties',
      'Type mismatch in model definition',
    ],
    fixes: [
      'Check model file for TypeScript errors',
      'Ensure all required fields are defined',
      'Review EdgeRecord documentation',
    ],
  },

  // Authentication Errors (IX_E5XX)
  IX_E501: {
    category: 'auth',
    title: 'Invalid JWT Configuration',
    docsPath: '/errors/IX_E501',
    causes: [
      'Unsupported algorithm specified',
      'Invalid key format',
      'Missing required JWT options',
    ],
    fixes: [
      'Use ES256 or HS256 algorithm (not RS256)',
      'Check key format matches algorithm',
      'Review JWT configuration in edge.config.ts',
    ],
  },
  IX_E502: {
    category: 'auth',
    title: 'Key Rotation Failed',
    docsPath: '/errors/IX_E502',
    causes: [
      'KV namespace not configured',
      'Insufficient permissions',
      'Key generation failed',
    ],
    fixes: [
      'Configure KV namespace for key storage',
      'Check Cloudflare API permissions',
      'Run `ix auth:rotate-keys --verbose` for details',
    ],
  },
  IX_E503: {
    category: 'auth',
    title: 'Missing Authentication Secrets',
    docsPath: '/errors/IX_E503',
    causes: [
      'JWT_SECRET not set',
      'Session secret missing',
      'OAuth credentials not configured',
    ],
    fixes: [
      'Set JWT_SECRET in environment or wrangler.toml',
      'Generate secret: `openssl rand -base64 32`',
      'Check .dev.vars for local development',
    ],
  },

  // Internal Errors (IX_E9XX)
  IX_E901: {
    category: 'internal',
    title: 'Unexpected Internal Error',
    docsPath: '/errors/IX_E901',
    causes: [
      'Bug in Ixflare CLI',
      'Unexpected runtime condition',
      'Corrupted state',
    ],
    fixes: [
      'Run with --verbose for more details',
      'Report issue: https://github.com/ixflare/ixflare/issues',
      'Try clearing cache and reinstalling',
    ],
  },
  IX_E902: {
    category: 'internal',
    title: 'Invalid CLI Arguments',
    docsPath: '/errors/IX_E902',
    causes: [
      'Unknown command or flag',
      'Missing required argument',
      'Invalid argument value',
    ],
    fixes: [
      'Run `ix --help` for available commands',
      'Check command syntax: `ix <command> --help`',
      'Verify argument spelling',
    ],
  },
  IX_E903: {
    category: 'internal',
    title: 'File System Error',
    docsPath: '/errors/IX_E903',
    causes: [
      'Permission denied',
      'Disk full',
      'File locked by another process',
    ],
    fixes: [
      'Check file/directory permissions',
      'Free up disk space',
      'Close other programs using the file',
    ],
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
