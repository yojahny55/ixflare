/**
 * Signed Cookie Support
 * Story 5-7: Secure Cookie Handling
 *
 * HMAC-SHA256 signed cookies for tamper detection
 * Pattern: value.signature where signature = HMAC(name:value, secret)
 * Including cookie name prevents name substitution attacks
 */

import { base64urlEncode, timingSafeEqual } from '@/auth/utils'
import { CookieSignatureError } from './errors'
import type { CookieOptions } from './types'

/** Minimum recommended secret length for HMAC-SHA256 */
const MIN_SECRET_LENGTH = 32

/**
 * Validate signing secret
 *
 * @param secret - Secret to validate
 * @throws {CookieSignatureError} If secret is empty or too short
 */
function validateSecret(secret: string): void {
  if (!secret || secret.length === 0) {
    throw new CookieSignatureError('Cookie signing secret cannot be empty')
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    console.warn(
      `[COOKIE SECURITY] Signing secret is ${secret.length} chars, recommended minimum is ${MIN_SECRET_LENGTH} chars for HMAC-SHA256`
    )
  }
}

/**
 * Sign a cookie value with HMAC-SHA256
 *
 * Signature binds cookie name to value to prevent name substitution attacks
 * Format: HMAC-SHA256(cookieName:cookieValue, secret)
 *
 * @param name - Cookie name (included in signature)
 * @param value - Cookie value to sign
 * @param secret - HMAC secret key (minimum 32 chars recommended)
 * @returns Signed value in format "value.signature"
 * @throws {CookieSignatureError} If secret is empty
 */
export async function signCookieValue(
  name: string,
  value: string,
  secret: string
): Promise<string> {
  // Validate secret configuration
  validateSecret(secret)

  const encoder = new TextEncoder()

  // Import HMAC secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Include cookie name in signature to prevent name substitution attacks
  const data = encoder.encode(`${name}:${value}`)
  const signature = await crypto.subtle.sign('HMAC', key, data)

  return `${value}.${base64urlEncode(signature)}`
}

/**
 * Verify cookie signature and return original value
 *
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param name - Cookie name (must match signature)
 * @param signedValue - Signed cookie value in format "value.signature"
 * @param secret - HMAC secret key
 * @returns Original value if valid, null if tampered or invalid format
 */
export async function verifyCookieSignature(
  name: string,
  signedValue: string,
  secret: string
): Promise<string | null> {
  // Parse signed value format: value.signature
  // Use lastIndexOf to support values containing dots (e.g., "user.role.admin.signature")
  const lastDotIndex = signedValue.lastIndexOf('.')

  // Must have at least one dot, and it can't be at the end
  // Note: lastDotIndex === 0 is valid for empty values (format: ".signature")
  if (lastDotIndex < 0 || lastDotIndex === signedValue.length - 1) {
    return null // Invalid format, don't throw
  }

  const value = signedValue.substring(0, lastDotIndex)
  const providedSignature = signedValue.substring(lastDotIndex + 1)

  // Re-compute expected signature
  const expectedSignedValue = await signCookieValue(name, value, secret)
  const expectedLastDot = expectedSignedValue.lastIndexOf('.')
  const expectedSignature = expectedSignedValue.substring(expectedLastDot + 1)

  // Timing-safe comparison prevents timing attacks
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null // Tampered, return null not error
  }

  return value
}

/**
 * Set signed cookie on response
 *
 * @param response - Response object to add Set-Cookie header to
 * @param name - Cookie name
 * @param value - Cookie value to sign
 * @param secret - HMAC secret key
 * @param options - Cookie options (uses secure defaults)
 * @returns Response with Set-Cookie header
 */
export async function setSignedCookie(
  response: Response,
  name: string,
  value: string,
  secret: string,
  options: CookieOptions = {}
): Promise<Response> {
  // Import setCookie here to avoid circular dependency
  const { setCookie } = await import('./core')

  // Sign the value
  const signedValue = await signCookieValue(name, value, secret)

  // Set cookie with signed value
  return setCookie(response, name, signedValue, options)
}

/**
 * Get and verify signed cookie from request
 *
 * @param request - Request object with Cookie header
 * @param name - Cookie name to retrieve
 * @param secret - HMAC secret key
 * @returns Original value if valid, null if not found or tampered
 */
export async function getSignedCookie(
  request: Request,
  name: string,
  secret: string
): Promise<string | null> {
  // Import getCookie here to avoid circular dependency
  const { getCookie } = await import('./core')

  // Get signed cookie value
  const signedValue = getCookie(request, name)

  if (!signedValue) {
    return null // Cookie not found
  }

  // Verify signature and return original value
  return verifyCookieSignature(name, signedValue, secret)
}
