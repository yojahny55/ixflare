/**
 * @module query-parser
 * @description URL query parameter parsing with Zod validation
 */

import type { ZodSchema } from 'zod'
import { ValidationError } from '@/errors'
import { formatZodErrors } from '@/core/body-parser'

/**
 * Parse and validate URL query parameters using Zod schema
 *
 * Uses safeParse for graceful error handling without try/catch.
 * Throws ValidationError with field-level errors on validation failure.
 *
 * @param request - The incoming Request object
 * @param schema - Zod schema for validation
 * @returns Fully typed validated query object
 * @throws {ValidationError} When validation fails with detailed field errors
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { parseQuery } from 'ixflare'
 *
 * const schema = z.object({
 *   page: z.coerce.number().positive().default(1),
 *   limit: z.coerce.number().min(1).max(100).default(20),
 *   sort: z.enum(['name', 'createdAt', 'email']).optional(),
 * })
 *
 * const query = parseQuery(request, schema)
 * // query is typed: { page: number, limit: number, sort?: 'name' | 'createdAt' | 'email' }
 * ```
 */
export function parseQuery<T>(request: Request, schema: ZodSchema<T>): T {
  const url = new URL(request.url)
  const queryObject = searchParamsToObject(url.searchParams)
  const result = schema.safeParse(queryObject)

  if (!result.success) {
    throw new ValidationError('Query parameter validation failed', formatZodErrors(result.error))
  }

  return result.data
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert URLSearchParams to plain object for Zod validation
 * Handles multiple values with same key as arrays
 * @internal
 */
function searchParamsToObject(searchParams: URLSearchParams): Record<string, unknown> {
  const obj: Record<string, unknown> = {}

  // Use unique keys to avoid processing duplicates
  const keys = new Set(searchParams.keys())

  for (const key of keys) {
    const values = searchParams.getAll(key)
    // If multiple values, use array; otherwise use single value
    obj[key] = values.length > 1 ? values : values[0]
  }

  return obj
}
