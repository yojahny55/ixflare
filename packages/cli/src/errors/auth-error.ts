/**
 * Authentication-related errors (IX_E5XX)
 * @packageDocumentation
 */

import { CLIError } from './cli-error'
import type { CLIErrorOptions } from './types'
import { getErrorDocsUrl } from './codes'

/**
 * Authentication error class
 * Used for errors related to JWT configuration, key rotation, secrets, etc.
 */
export class AuthError extends CLIError {
  constructor(options: Omit<CLIErrorOptions, 'docsUrl'>) {
    const docsUrl = getErrorDocsUrl(options.code)
    super({
      ...options,
      docsUrl,
    })
    this.name = 'AuthError'
  }
}
