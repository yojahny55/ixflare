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
 * Security configuration schema
 */
export const securityConfigSchema = z.object({
  /** Enable CSRF protection (defaults to true) */
  csrf: z.boolean().default(true),
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
 * Note: z.function() validation is limited - functions are passed through
 */
export const hooksConfigSchema = z.object({
  /** Called before build starts */
  'pre-build': z.function().optional(),
  /** Called after build completes */
  'post-build': z.function().optional(),
  /** Called before deployment */
  'pre-deploy': z.function().optional(),
  /** Called after deployment completes */
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
export const envConfigSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
)

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
