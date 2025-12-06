/**
 * @module config/defaults
 * @description Default configuration values for Ixflare
 * @universal - Used in both Node.js build and Workers runtime
 */

import type { IxflareConfig } from './schema'

/**
 * Default database binding name
 */
export const DEFAULT_DATABASE_BINDING = 'DB'

/**
 * Default cache binding name
 */
export const DEFAULT_CACHE_BINDING = 'CACHE'

/**
 * Default cache TTL in seconds (1 hour)
 */
export const DEFAULT_CACHE_TTL = 3600

/**
 * Default configuration values
 * These are applied when options are not explicitly provided
 */
export const defaults: Partial<IxflareConfig> = {
  database: {
    binding: DEFAULT_DATABASE_BINDING,
    warmup: true,
  },
  cache: {
    binding: DEFAULT_CACHE_BINDING,
    defaultTtl: DEFAULT_CACHE_TTL,
  },
  security: {
    csrf: true,
    headers: true,
  },
}

/**
 * Deep merge two objects, with source values overriding target values
 * Handles nested objects recursively while preserving type safety
 *
 * @param target - Base object with default values
 * @param source - Object with user-provided values to merge in
 * @returns Merged object with source values overriding target
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target }

  for (const key in source) {
    const sourceValue = source[key]
    const targetValue = target[key]

    if (
      sourceValue !== undefined &&
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>]
    } else if (sourceValue !== undefined) {
      // Override with source value
      result[key] = sourceValue as T[Extract<keyof T, string>]
    }
  }

  return result
}

/**
 * Apply default values to a configuration object
 * User-provided values take precedence over defaults
 *
 * @param config - User-provided configuration
 * @returns Configuration with defaults applied
 */
export function applyDefaults(config: IxflareConfig): IxflareConfig {
  return deepMerge(defaults as IxflareConfig, config)
}
