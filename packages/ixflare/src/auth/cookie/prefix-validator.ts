/**
 * Cookie Prefix Validation
 * Story 5-7: Secure Cookie Handling
 *
 * Validates cookie names with __Host- and __Secure- prefixes
 * Reference: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies
 */

import { CookieValidationError } from './errors'
import type { CookieOptions } from './types'

/**
 * Validate cookie prefix requirements
 *
 * __Host- prefix requirements:
 * - Secure attribute MUST be true
 * - Path MUST be "/" (if specified)
 * - Domain MUST NOT be set
 *
 * __Secure- prefix requirements:
 * - Secure attribute MUST be true
 *
 * @param name - Cookie name to validate
 * @param options - Cookie options to validate against prefix requirements
 * @throws {CookieValidationError} If prefix requirements are not met
 */
export function validateCookiePrefix(name: string, options: CookieOptions): void {
  // __Host- prefix validation (most restrictive)
  if (name.startsWith('__Host-')) {
    if (!options.secure) {
      throw new CookieValidationError(
        'PREFIX_HOST_SECURE_REQUIRED',
        '__Host- prefix requires Secure attribute to be true'
      )
    }

    if (options.domain !== undefined) {
      throw new CookieValidationError(
        'PREFIX_HOST_NO_DOMAIN',
        '__Host- prefix cannot have Domain attribute'
      )
    }

    if (options.path !== undefined && options.path !== '/') {
      throw new CookieValidationError(
        'PREFIX_HOST_PATH_ROOT',
        '__Host- prefix requires Path="/" or no Path specified'
      )
    }
  }

  // __Secure- prefix validation
  if (name.startsWith('__Secure-')) {
    if (!options.secure) {
      throw new CookieValidationError(
        'PREFIX_SECURE_REQUIRED',
        '__Secure- prefix requires Secure attribute to be true'
      )
    }
  }
}
