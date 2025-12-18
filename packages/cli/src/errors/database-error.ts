/**
 * Database-related errors (IX_E4XX)
 * @packageDocumentation
 */

import { CLIError } from './cli-error'
import type { CLIErrorOptions } from './types'
import { getErrorDocsUrl } from './codes'

/**
 * Database error class
 * Used for errors related to migrations, D1, schema validation, etc.
 */
export class DatabaseError extends CLIError {
  constructor(options: Omit<CLIErrorOptions, 'docsUrl'>) {
    const docsUrl = getErrorDocsUrl(options.code)
    super({
      ...options,
      docsUrl,
    })
    this.name = 'DatabaseError'
  }
}
