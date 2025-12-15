/**
 * Core Cookie Utilities
 * Story 5-7: Secure Cookie Handling (Enhanced from Story 5-2)
 *
 * OWASP compliant cookie handling with secure defaults
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
 */

import { CookieValidationError } from './errors'
import { validateCookiePrefix } from './prefix-validator'
import { enforceSecureDefaults } from './security'
import type { CookieOptions } from './types'

/**
 * RFC 6265 compliant cookie name validation
 *
 * Cookie names must be valid tokens per RFC 2616:
 * - US-ASCII characters except control characters and separators
 * - Separators: ( ) < > @ , ; : \ " / [ ] ? = { }
 *
 * @param name - Cookie name to validate
 * @throws {CookieValidationError} If name contains invalid characters
 */
function validateCookieName(name: string): void {
  if (!name || name.length === 0) {
    throw new CookieValidationError('NAME_EMPTY', 'Cookie name cannot be empty')
  }

  // RFC 6265: cookie-name = token
  // token = 1*<any CHAR except CTLs or separators>
  // CTL = <any US-ASCII control character (0-31) and DEL (127)>
  // separators = ( ) < > @ , ; : \ " / [ ] ? = { } SP HT
  const separators = '()<>@,;:\\"/[]?={}'

  for (let i = 0; i < name.length; i++) {
    const charCode = name.charCodeAt(i)
    const char = name[i]

    // Check for control characters (0-31) and DEL (127)
    if (charCode <= 31 || charCode === 127) {
      throw new CookieValidationError(
        'NAME_INVALID_CHARS',
        'Cookie name contains invalid characters (control chars, spaces, or separators)'
      )
    }

    // Check for whitespace or separators
    if (char === ' ' || char === '\t' || separators.includes(char)) {
      throw new CookieValidationError(
        'NAME_INVALID_CHARS',
        'Cookie name contains invalid characters (control chars, spaces, or separators)'
      )
    }
  }
}

/**
 * Set cookie on response with secure defaults and validation
 *
 * Security features:
 * - Validates cookie prefix requirements (__Host-, __Secure-)
 * - Enforces secure defaults in production
 * - URL encodes cookie values
 * - Supports Expires and Partitioned attributes
 *
 * @param response - Response object to add Set-Cookie header to
 * @param name - Cookie name
 * @param value - Cookie value (will be URL encoded)
 * @param options - Cookie options (uses secure defaults)
 * @returns Response with Set-Cookie header
 *
 * @example
 * // Set secure session cookie with __Host- prefix
 * const response = Response.json({ success: true })
 * setCookie(response, '__Host-session', token, {
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: 'lax',
 *   maxAge: 3600
 * })
 */
export function setCookie(
  response: Response,
  name: string,
  value: string,
  options: CookieOptions = {}
): Response {
  // Validate cookie name per RFC 6265
  validateCookieName(name)

  // Enforce secure defaults based on environment
  const enforcedOptions = enforceSecureDefaults(name, options)

  // Validate cookie prefix requirements
  validateCookiePrefix(name, enforcedOptions)

  const {
    httpOnly = true, // OWASP: Always use httpOnly for session cookies
    secure = true, // OWASP: Always use secure in production
    sameSite = 'lax', // OWASP: CSRF protection
    maxAge,
    expires,
    path = '/',
    domain,
    partitioned,
  } = enforcedOptions

  // URL encode cookie value to handle special characters
  const encodedValue = encodeURIComponent(value)

  // Build cookie string
  let cookie = `${name}=${encodedValue}`

  // Add Max-Age if specified (takes precedence over Expires)
  if (maxAge !== undefined) {
    cookie += `; Max-Age=${maxAge}`
  }
  // Add Expires if specified and no Max-Age
  else if (expires !== undefined) {
    const expiresDate = typeof expires === 'number' ? new Date(expires) : expires
    cookie += `; Expires=${expiresDate.toUTCString()}`
  }

  cookie += `; Path=${path}`

  if (domain) {
    cookie += `; Domain=${domain}`
  }

  if (secure) {
    cookie += '; Secure'
  }

  if (httpOnly) {
    cookie += '; HttpOnly'
  }

  if (sameSite) {
    cookie += `; SameSite=${sameSite.charAt(0).toUpperCase() + sameSite.slice(1)}`
  }

  // Add Partitioned attribute for CHIPS support
  if (partitioned) {
    cookie += '; Partitioned'
  }

  // Clone response and add Set-Cookie header
  const headers = new Headers(response.headers)
  headers.append('Set-Cookie', cookie)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Get cookie value from request
 *
 * Automatically URL decodes the cookie value
 *
 * @param request - Request object with Cookie header
 * @param name - Cookie name to retrieve
 * @returns Decoded cookie value or null if not found
 *
 * @example
 * const sessionToken = getCookie(request, '__Host-session')
 * if (sessionToken) {
 *   // Process session token
 * }
 */
export function getCookie(request: Request, name: string): string | null {
  const cookies = parseCookies(request)
  const value = cookies[name]

  if (value === undefined) {
    return null
  }

  // URL decode cookie value (handle empty string separately)
  if (value === '') {
    return ''
  }

  try {
    return decodeURIComponent(value)
  } catch {
    // Return raw value if decoding fails
    return value
  }
}

/**
 * Parse all cookies from request Cookie header
 *
 * @param request - Request object
 * @returns Object mapping cookie names to raw (encoded) values
 *
 * @example
 * const cookies = parseCookies(request)
 * for (const [name, value] of Object.entries(cookies)) {
 *   console.log(`${name}: ${value}`)
 * }
 */
export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get('Cookie')

  if (!cookieHeader) {
    return {}
  }

  const cookies: Record<string, string> = {}

  // Parse cookie header: "name1=value1; name2=value2"
  const pairs = cookieHeader.split(';')

  for (const pair of pairs) {
    const trimmedPair = pair.trim()
    const equalIndex = trimmedPair.indexOf('=')

    if (equalIndex === -1) {
      // No equals sign, skip this pair
      continue
    }

    const name = trimmedPair.substring(0, equalIndex).trim()
    const value = trimmedPair.substring(equalIndex + 1).trim()

    if (name) {
      cookies[name] = value
    }
  }

  return cookies
}

/**
 * Delete cookie by setting Max-Age=0
 *
 * Path and domain must match the original cookie for deletion to work
 *
 * @param response - Response object
 * @param name - Cookie name to delete
 * @param options - Cookie options (path and domain must match original)
 * @returns Response with delete cookie header
 *
 * @example
 * // Delete session cookie
 * const response = Response.json({ success: true })
 * deleteCookie(response, '__Host-session', { path: '/' })
 */
export function deleteCookie(
  response: Response,
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {}
): Response {
  const { path = '/', domain } = options

  // Set both Max-Age=0 and Expires to epoch for maximum browser compatibility
  // Some older browsers only support Expires, modern browsers prefer Max-Age
  let cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${path}`

  if (domain) {
    cookie += `; Domain=${domain}`
  }

  const headers = new Headers(response.headers)
  headers.append('Set-Cookie', cookie)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
