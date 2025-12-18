/**
 * Configuration-related errors (IX_E1XX)
 * @packageDocumentation
 */

import { CLIError } from './cli-error'
import type { CLIErrorOptions } from './types'
import { getErrorDocsUrl } from './codes'

/**
 * Configuration error class
 * Used for errors related to edge.config.ts, tsconfig.json, wrangler.toml, etc.
 */
export class ConfigError extends CLIError {
  constructor(options: Omit<CLIErrorOptions, 'docsUrl'>) {
    const docsUrl = getErrorDocsUrl(options.code)
    super({
      ...options,
      docsUrl,
    })
    this.name = 'ConfigError'
  }
}
