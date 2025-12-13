/**
 * CSRF Token Generation and Signing
 * Story 5-6: CSRF Protection
 *
 * Implements Signed Double-Submit Cookie pattern with HMAC-SHA256
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import { base64urlEncode, timingSafeEqual } from '@/auth/utils'
import type { CSRFToken } from './types'

/**
 * Generate a cryptographically secure CSRF token
 *
 * Uses crypto.randomUUID() which provides 128-bit entropy (OWASP requirement)
 *
 * @returns Random token value
 */
export function generateCSRFToken(): string {
  return crypto.randomUUID()
}

/**
 * Sign CSRF token with HMAC-SHA256 bound to session ID
 *
 * Signature format: HMAC-SHA256(tokenValue:sessionId, secret)
 * This binding prevents:
 * - Session fixation attacks (token is bound to specific session)
 * - Subdomain cookie injection (signature includes session ID)
 * - Token forgery (HMAC requires secret key)
 *
 * @param token - Token value to sign
 * @param sessionId - Session ID to bind token to
 * @param secret - HMAC secret key
 * @returns Base64url-encoded HMAC signature
 */
export async function signCSRFToken(
  token: string,
  sessionId: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder()

  // Import HMAC secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Create signature over token:sessionId binding
  const data = encoder.encode(`${token}:${sessionId}`)
  const signature = await crypto.subtle.sign('HMAC', key, data)

  return base64urlEncode(signature)
}

/**
 * Verify CSRF token signature and session binding
 *
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param signedToken - Token in format "value.signature"
 * @param sessionId - Session ID to verify binding
 * @param secret - HMAC secret key
 * @returns True if signature is valid and session matches
 */
export async function verifyCSRFSignature(
  signedToken: string,
  sessionId: string,
  secret: string
): Promise<boolean> {
  // Parse signed token format: value.signature
  const parts = signedToken.split('.')
  if (parts.length !== 2) {
    return false
  }

  const [tokenValue, providedSignature] = parts

  // Re-compute expected signature
  const expectedSignature = await signCSRFToken(tokenValue, sessionId, secret)

  // Timing-safe comparison prevents timing attacks
  return timingSafeEqual(providedSignature, expectedSignature)
}

/**
 * Create a complete signed CSRF token
 *
 * Combines generation and signing into a single operation
 * Format: "randomValue.hmacSignature"
 *
 * @param sessionId - Session ID to bind token to
 * @param secret - HMAC secret key
 * @returns Signed token and metadata
 */
export async function createSignedToken(
  sessionId: string,
  secret: string
): Promise<CSRFToken> {
  const value = generateCSRFToken()
  const signature = await signCSRFToken(value, sessionId, secret)
  const signedToken = `${value}.${signature}`

  return {
    value,
    signature,
    sessionId,
    signedToken,
  }
}
