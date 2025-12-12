/**
 * Cookie Utilities for Session Management
 * Story 5-2: Session Management
 *
 * OWASP compliant cookie handling with secure defaults
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
 */

export interface CookieOptions {
  /** HTTP only flag (prevents JavaScript access) - default: true */
  httpOnly?: boolean

  /** Secure flag (HTTPS only) - default: true in production */
  secure?: boolean

  /** SameSite attribute for CSRF protection - default: lax */
  sameSite?: 'lax' | 'strict' | 'none'

  /** Max age in seconds */
  maxAge?: number

  /** Cookie path - default: / */
  path?: string

  /** Cookie domain (omit for strictest scope) */
  domain?: string
}

/**
 * Set cookie on response with secure defaults
 * Follows OWASP Session Management Cheat Sheet recommendations
 *
 * @param response - Response object to add Set-Cookie header to
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options (uses secure defaults)
 * @returns Response with Set-Cookie header
 */
export function setCookie(
  response: Response,
  name: string,
  value: string,
  options: CookieOptions = {}
): Response {
  const {
    httpOnly = true, // OWASP: Always use httpOnly for session cookies
    secure = true, // OWASP: Always use secure in production
    sameSite = 'lax', // OWASP: CSRF protection
    maxAge,
    path = '/',
    domain,
  } = options

  // Build cookie string
  let cookie = `${name}=${value}`

  // Add attributes
  if (maxAge !== undefined) {
    cookie += `; Max-Age=${maxAge}`
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
 * @param request - Request object with Cookie header
 * @param name - Cookie name to retrieve
 * @returns Cookie value or null if not found
 */
export function getCookie(request: Request, name: string): string | null {
  const cookies = parseCookies(request)
  return cookies[name] ?? null
}

/**
 * Parse all cookies from request Cookie header
 *
 * @param request - Request object
 * @returns Object mapping cookie names to values
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
    const [name, ...valueParts] = pair.trim().split('=')
    if (name) {
      // Join value parts in case value contained '='
      cookies[name] = valueParts.join('=')
    }
  }

  return cookies
}

/**
 * Delete cookie by setting Max-Age=0
 *
 * @param response - Response object
 * @param name - Cookie name to delete
 * @param options - Cookie options (path and domain must match original)
 * @returns Response with delete cookie header
 */
export function deleteCookie(
  response: Response,
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {}
): Response {
  const { path = '/', domain } = options

  // Set Max-Age=0 to delete immediately
  let cookie = `${name}=; Max-Age=0; Path=${path}`

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
