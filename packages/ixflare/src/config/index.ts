/**
 * @module config
 * @description Configuration system exports
 *
 * The config module provides:
 * - `defineConfig()` - Type-safe configuration helper with validation
 * - `loadConfig()` - Runtime config loader with env file precedence
 * - `loadEnv()` - Environment variable loader
 * - Configuration types and schemas
 */

// Core exports
export { defineConfig } from './define-config'
export { loadConfig, loadEnv } from './loader'
export { applyDefaults, deepMerge, defaults } from './defaults'
export { formatConfigError, createConfigError, ConfigError } from './errors'

// Schema exports (for advanced usage)
export {
  configSchema,
  databaseConfigSchema,
  cacheConfigSchema,
  securityConfigSchema,
  hooksConfigSchema,
  commandSchema,
  envConfigSchema,
} from './schema'

// Type exports
export type {
  IxflareConfig,
  IxflareConfigInput,
  DatabaseConfig,
  CacheConfig,
  SecurityConfig,
  HooksConfig,
  CommandConfig,
  EnvConfig,
} from './types'
