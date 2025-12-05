/**
 * @module core/params
 * @description Runtime parameter extraction and validation for dynamic routes
 * @worker-only
 */

import type { ZodSchema } from 'zod'

/**
 * Extract parameters from a URL using URLPattern API
 *
 * @param pattern - Route pattern (e.g., '/users/:userId' or '/docs/*')
 * @param pathname - Incoming request pathname
 * @returns Extracted parameters or null if no match
 *
 * @example
 * ```ts
 * extractParamsFromUrl('/users/:userId', '/users/123')
 * // Returns: { userId: '123' }
 *
 * extractParamsFromUrl('/docs/*', '/docs/guides/routing/basics')
 * // Returns: { '0': 'guides/routing/basics' }
 * ```
 */
export function extractParamsFromUrl(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  // Convert route pattern to URLPattern format
  // :param → :param (URLPattern compatible)
  // * → * (catch-all - URLPattern compatible)
  const urlPatternStr = pattern

  try {
    const urlPattern = new URLPattern({ pathname: urlPatternStr })
    const match = urlPattern.exec({ pathname })

    if (!match) {
      return null
    }

    // Extract pathname groups (params)
    const params: Record<string, string> = {}

    if (match.pathname.groups) {
      for (const [key, value] of Object.entries(match.pathname.groups)) {
        if (value !== undefined) {
          params[key] = value
        }
      }
    }

    return params
  } catch (error) {
    // URLPattern parsing failed - invalid pattern
    console.error(`[ixflare] Invalid route pattern: ${pattern}`, error)
    return null
  }
}

/**
 * Convert catch-all parameter to array
 *
 * @param catchAllValue - The catch-all string value (e.g., 'guides/routing/basics')
 * @returns Array of path segments
 *
 * @example
 * ```ts
 * parseCatchAllParam('guides/routing/basics')
 * // Returns: ['guides', 'routing', 'basics']
 *
 * parseCatchAllParam('')
 * // Returns: []
 * ```
 */
export function parseCatchAllParam(catchAllValue: string): string[] {
  if (!catchAllValue || catchAllValue === '') {
    return []
  }
  return catchAllValue.split('/').filter(Boolean)
}

/**
 * Validate and coerce route parameters using Zod schema
 *
 * @param params - Raw parameters extracted from URL (all strings)
 * @param schema - Zod schema for validation and coercion
 * @returns Validated and coerced parameters
 * @throws ValidationError if params don't match schema
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   userId: z.coerce.number().int().positive(),
 *   active: z.coerce.boolean().default(true),
 * })
 *
 * const validated = validateParams({ userId: '123', active: 'true' }, schema)
 * // Returns: { userId: 123, active: true }
 * ```
 */
export function validateParams<T>(
  params: Record<string, string | string[]>,
  schema: ZodSchema<T>
): T {
  // Use Zod's parse method - this will throw ZodError if validation fails
  // The calling code should catch ZodError and return 400 response
  return schema.parse(params)
}

/**
 * Match a route pattern against a pathname and extract typed parameters
 * This combines pattern matching with optional validation
 *
 * @param pattern - Route pattern (e.g., '/users/:userId')
 * @param pathname - Request pathname
 * @param schema - Optional Zod schema for validation
 * @returns Matched and validated params, or null if no match
 *
 * @example
 * ```ts
 * const schema = z.object({ userId: z.coerce.number() })
 * const result = matchRouteWithParams('/users/:userId', '/users/123', schema)
 * // Returns: { userId: 123 }
 * ```
 */
export function matchRouteWithParams<T = Record<string, string>>(
  pattern: string,
  pathname: string,
  schema?: ZodSchema<T>
): T | null {
  const params = extractParamsFromUrl(pattern, pathname)

  if (params === null) {
    return null
  }

  // If schema provided, validate and coerce
  if (schema) {
    try {
      return validateParams(params, schema)
    } catch (error) {
      // Validation failed - return null to indicate no match
      // The router should try the next route
      return null
    }
  }

  return params as T
}
