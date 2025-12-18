/**
 * Build-related errors (IX_E2XX)
 * @packageDocumentation
 */

import { CLIError } from './cli-error'
import type { CLIErrorOptions } from './types'
import { getErrorDocsUrl } from './codes'

/**
 * Build error class
 * Used for errors related to compilation, bundling, module resolution, etc.
 */
export class BuildError extends CLIError {
  constructor(options: Omit<CLIErrorOptions, 'docsUrl'>) {
    const docsUrl = getErrorDocsUrl(options.code)
    super({
      ...options,
      docsUrl,
    })
    this.name = 'BuildError'
  }
}
