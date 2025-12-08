/**
 * @module edge-record/crud/case-transform
 * @description Utilities for transforming between camelCase and snake_case
 */

/**
 * Convert snake_case to camelCase
 * @example toCamelCase('created_at') -> 'createdAt'
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert camelCase to snake_case
 * @example toSnakeCase('createdAt') -> 'created_at'
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Transform object keys from snake_case to camelCase
 */
export function transformKeysToCamelCase<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key in obj) {
    result[toCamelCase(key)] = obj[key]
  }

  return result
}

/**
 * Transform object keys from camelCase to snake_case
 */
export function transformKeysToSnakeCase<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key in obj) {
    result[toSnakeCase(key)] = obj[key]
  }

  return result
}
