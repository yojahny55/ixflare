/**
 * @module config/define-config
 * @description Configuration helper with Zod validation and type inference
 * @universal - Used in both Node.js build and Workers runtime
 */

import { configSchema, type IxflareConfig, type IxflareConfigInput } from './schema'
import { applyDefaults } from './defaults'
import { createConfigError } from './errors'

/**
 * Define and validate Ixflare configuration with full TypeScript support
 *
 * This function provides:
 * - Full autocomplete for all configuration options
 * - Runtime validation with clear error messages
 * - Sensible defaults for optional values
 * - Type-safe configuration object
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'ixflare'
 *
 * export default defineConfig({
 *   name: 'my-app',
 *   database: {
 *     binding: 'DB',
 *     warmup: true,
 *   },
 *   cache: {
 *     binding: 'CACHE',
 *     defaultTtl: 3600,
 *   },
 *   security: {
 *     csrf: true,
 *     headers: true,
 *   },
 * })
 * ```
 *
 * @param config - User configuration object
 * @returns Validated and normalized configuration with defaults applied
 * @throws {ConfigError} When configuration validation fails
 */
export function defineConfig(config: IxflareConfigInput): IxflareConfig {
  // Validate configuration against schema
  const result = configSchema.safeParse(config)

  if (!result.success) {
    throw createConfigError(result.error)
  }

  // Apply default values for optional fields
  return applyDefaults(result.data)
}
