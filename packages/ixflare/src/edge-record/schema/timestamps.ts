/**
 * @module edge-record/schema/timestamps
 * @description Timestamp helper for common timestamp fields
 */

import { field } from './field'

/**
 * Timestamps helper - provides createdAt and updatedAt fields
 * Use with spread operator in schema definitions
 *
 * @example
 * ```typescript
 * const User = defineModel('users', {
 *   id: field.id(),
 *   email: field.string(),
 *   ...timestamps(),
 * })
 * ```
 *
 * This will add:
 * - createdAt: datetime field with default value of current timestamp
 * - updatedAt: datetime field with default value of current timestamp
 */
export function timestamps() {
  return {
    createdAt: field.datetime().default(() => new Date()),
    updatedAt: field.datetime().default(() => new Date()),
  }
}
