/**
 * Deployment-related errors (IX_E3XX)
 * @packageDocumentation
 */

import { CLIError } from './cli-error'
import type { CLIErrorOptions } from './types'
import { getErrorDocsUrl } from './codes'

/**
 * Deployment error class
 * Used for errors related to deployment, wrangler, Cloudflare API, etc.
 */
export class DeployError extends CLIError {
  constructor(options: Omit<CLIErrorOptions, 'docsUrl'>) {
    const docsUrl = getErrorDocsUrl(options.code)
    super({
      ...options,
      docsUrl,
    })
    this.name = 'DeployError'
  }
}
