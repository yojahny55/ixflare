/**
 * Cursor encoding and decoding utilities for cursor-based pagination
 */

import type { Cursor } from './types'
import { ValidationError } from '../crud/errors'

/**
 * Encodes a cursor object to a Base64 URL-safe string
 *
 * @param cursor - Cursor object containing orderField value and id
 * @returns Base64 URL-safe encoded cursor string
 *
 * @example
 * ```typescript
 * const cursor = encodeCursor({ createdAt: 1733311800000, id: 100 })
 * // Returns: "eyJjcmVhdGVkQXQiOjE3MzMzMTE4MDAwMDAsImlkIjoxMDB9"
 * ```
 */
export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify(cursor)
  const base64 = btoa(json)

  // Make URL-safe by replacing characters and removing padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodes a Base64 URL-safe cursor string back to a cursor object
 *
 * @param encoded - Base64 URL-safe encoded cursor string
 * @returns Decoded cursor object
 * @throws {ValidationError} If cursor format is invalid
 *
 * @example
 * ```typescript
 * const cursor = decodeCursor("eyJjcmVhdGVkQXQiOjE3MzMzMTE4MDAwMDAsImlkIjoxMDB9")
 * // Returns: { createdAt: 1733311800000, id: 100 }
 * ```
 */
export function decodeCursor(encoded: string): Cursor {
  try {
    // Restore standard Base64 from URL-safe format
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')

    // Decode Base64 to JSON string
    const json = atob(padded)

    // Parse JSON to object
    const cursor = JSON.parse(json) as Cursor

    // Validate cursor structure
    if (typeof cursor !== 'object' || cursor === null) {
      throw new Error('Cursor must be an object')
    }

    return cursor
  } catch (error) {
    throw new ValidationError(
      'PAGINATION.INVALID_CURSOR',
      `Invalid cursor format: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }
}

/**
 * Validates that a cursor contains the expected fields
 *
 * @param cursor - Cursor object to validate
 * @param orderByField - Expected order field name
 * @throws {ValidationError} If cursor doesn't contain expected fields
 *
 * @example
 * ```typescript
 * validateCursor({ createdAt: 1733311800000, id: 100 }, 'createdAt')
 * // Passes validation
 *
 * validateCursor({ wrongField: 123, id: 100 }, 'createdAt')
 * // Throws ValidationError
 * ```
 */
export function validateCursor(cursor: Cursor, orderByField: string): void {
  if (!(orderByField in cursor)) {
    throw new ValidationError(
      'PAGINATION.CURSOR_MISMATCH',
      `Cursor must contain '${orderByField}' field to match current orderBy clause`
    )
  }

  if (!('id' in cursor)) {
    throw new ValidationError(
      'PAGINATION.CURSOR_MISMATCH',
      `Cursor must contain 'id' field for tie-breaking`
    )
  }
}
