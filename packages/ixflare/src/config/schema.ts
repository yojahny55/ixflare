/**
 * @module config/schema
 * @description Zod schema for Ixflare configuration with full type inference
 * @universal - Used in both Node.js build and Workers runtime
 */

import { z } from 'zod'

/**
 * Database configuration schema
 */
export const databaseConfigSchema = z.object({
  /** D1 binding name (defaults to 'DB') */
  binding: z.string().min(1).default('DB'),
  /** Enable connection warmup for cold starts */
  warmup: z.boolean().default(true),
})

/**
 * Cache configuration schema
 */
export const cacheConfigSchema = z.object({
  /** KV binding name (defaults to 'CACHE') */
  binding: z.string().min(1).default('CACHE'),
  /** Default TTL in seconds (defaults to 3600 = 1 hour) */
  defaultTtl: z.number().int().positive().default(3600),
})

/**
 * CSRF configuration schema
 */
export const csrfConfigSchema = z.object({
  /** Enable CSRF protection (defaults to true) */
  enabled: z.boolean().default(true),
  /** CSRF cookie name (defaults to '__csrf') */
  cookie: z.string().min(1).default('__csrf'),
  /** CSRF header name (defaults to 'X-CSRF-Token') */
  header: z.string().min(1).default('X-CSRF-Token'),
  /** CSRF body field name (defaults to '_csrf') */
  bodyField: z.string().min(1).default('_csrf'),
  /** HTTP methods requiring CSRF protection (defaults to POST, PUT, PATCH, DELETE) */
  methods: z
    .array(z.enum(['POST', 'PUT', 'PATCH', 'DELETE']))
    .default(['POST', 'PUT', 'PATCH', 'DELETE']),
  /** SameSite cookie attribute (defaults to 'strict') */
  sameSite: z.enum(['strict', 'lax']).default('strict'),
  /** HMAC secret for token signing (required) */
  secret: z.string().min(1),
})

/**
 * Security configuration schema
 */
export const securityConfigSchema = z.object({
  /** Enable CSRF protection (boolean for simple on/off, object for full configuration) */
  csrf: z.union([z.boolean(), csrfConfigSchema]).default(true),
  /** Auto-inject security headers (defaults to true) */
  headers: z.boolean().default(true),
})

/**
 * Build hook context types
 */
export const postBuildContextSchema = z.object({
  outputPath: z.string(),
})

export const preDeployContextSchema = z.object({
  environment: z.string(),
})

export const postDeployContextSchema = z.object({
  url: z.string().url(),
})

/**
 * Lifecycle hooks schema
 *
 * Note: Zod's z.function() validates that values are functions but cannot
 * enforce specific signatures at the schema level. For full type safety,
 * use the exported hook types (PreBuildHook, PostBuildHook, PreDeployHook,
 * PostDeployHook) when defining hooks in your edge.config.ts:
 *
 * @example
 * import type { PostBuildHook, PreDeployHook } from 'ixflare'
 *
 * const myPostBuildHook: PostBuildHook = async ({ outputPath }) => {
 *   // TypeScript will enforce correct parameter types
 * }
 *
 * export default defineConfig({
 *   hooks: {
 *     'post-build': myPostBuildHook,
 *   },
 * })
 */
export const hooksConfigSchema = z.object({
  /** Called before build starts (no parameters) */
  'pre-build': z.function().optional(),
  /** Called after build completes (receives { outputPath: string }) */
  'post-build': z.function().optional(),
  /** Called before deployment (receives { environment: string }) */
  'pre-deploy': z.function().optional(),
  /** Called after deployment completes (receives { url: string }) */
  'post-deploy': z.function().optional(),
})

/**
 * Custom CLI command schema
 */
export const commandSchema = z.object({
  /** Command description shown in help */
  description: z.string().min(1),
  /** Command handler function */
  handler: z.function(),
})

/**
 * Environment variables schema
 * Supports string, number, or boolean values
 */
export const envConfigSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

/**
 * Main Ixflare configuration schema
 */
export const configSchema = z.object({
  /** Application name (required, 1-100 characters) */
  name: z
    .string()
    .min(1, 'Application name is required')
    .max(100, 'Application name must be 100 characters or less'),

  /** Environment variables (loaded from env files and wrangler.toml) */
  env: envConfigSchema.optional(),

  /** Database configuration */
  database: databaseConfigSchema.optional(),

  /** Cache configuration */
  cache: cacheConfigSchema.optional(),

  /** Security configuration */
  security: securityConfigSchema.optional(),

  /** Lifecycle hooks for build/deploy customization */
  hooks: hooksConfigSchema.optional(),

  /** Custom CLI commands */
  commands: z.record(z.string(), commandSchema).optional(),

  /**
   * Global middleware that runs on every request
   *
   * Middleware are executed in array order before any directory or route-specific middleware.
   *
   * @example
   * ```typescript
   * import { defineConfig, createMiddleware } from 'ixflare'
   *
   * export default defineConfig({
   *   name: 'my-app',
   *   middleware: [
   *     createMiddleware(async (ctx, next) => {
   *       console.log(`${ctx.method} ${ctx.url.pathname}`)
   *       return next()
   *     }),
   *     createMiddleware(async (ctx, next) => {
   *       const response = await next()
   *       response.headers.set('X-Powered-By', 'Ixflare')
   *       return response
   *     }),
   *   ],
   * })
   * ```
   */
  middleware: z.array(z.any()).optional(),
})

/**
 * Inferred TypeScript type from the schema
 */
export type IxflareConfig = z.infer<typeof configSchema>

/**
 * Input type for defineConfig (partial with optional fields)
 */
export type IxflareConfigInput = z.input<typeof configSchema>

/**
 * Database configuration type
 */
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>

/**
 * Cache configuration type
 */
export type CacheConfig = z.infer<typeof cacheConfigSchema>

/**
 * CSRF configuration type
 */
export type CSRFConfigSchema = z.infer<typeof csrfConfigSchema>

/**
 * Security configuration type
 */
export type SecurityConfig = z.infer<typeof securityConfigSchema>

/**
 * Hooks configuration type
 */
export type HooksConfig = z.infer<typeof hooksConfigSchema>

/**
 * Command configuration type
 */
export type CommandConfig = z.infer<typeof commandSchema>

/**
 * Environment variables type
 */
export type EnvConfig = z.infer<typeof envConfigSchema>

/**
 * Hook context types - actual runtime types for hook functions
 */

/**
 * Context passed to post-build hook
 */
export type PostBuildContext = z.infer<typeof postBuildContextSchema>

/**
 * Context passed to pre-deploy hook
 */
export type PreDeployContext = z.infer<typeof preDeployContextSchema>

/**
 * Context passed to post-deploy hook
 */
export type PostDeployContext = z.infer<typeof postDeployContextSchema>

/**
 * Hook function type definitions
 */

/**
 * Pre-build hook function (no context)
 */
export type PreBuildHook = () => void | Promise<void>

/**
 * Post-build hook function (receives output path)
 */
export type PostBuildHook = (context: PostBuildContext) => void | Promise<void>

/**
 * Pre-deploy hook function (receives environment)
 */
export type PreDeployHook = (context: PreDeployContext) => void | Promise<void>

/**
 * Post-deploy hook function (receives deployment URL)
 */
export type PostDeployHook = (context: PostDeployContext) => void | Promise<void>

/**
 * Union type of all hook contexts
 */
export type HookContext = PostBuildContext | PreDeployContext | PostDeployContext
