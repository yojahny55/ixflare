/**
 * @module auth/oauth/pkce
 * @description PKCE (Proof Key for Code Exchange) implementation
 *
 * Standards compliance:
 * - RFC 7636: PKCE specification
 * - RFC 9700: Only S256 method allowed (plain method REJECTED)
 * - GitHub (July 2025): S256 only
 *
 * Security requirements:
 * - Code verifier: 43-128 chars, cryptographically random
 * - Code challenge: SHA-256 hash, base64url encoded
 * - Plain challenge method: REJECTED (security vulnerability)
 */

/**
 * Generate PKCE code verifier
 * RFC 7636: 43-128 chars from unreserved characters
 * Uses 256 bits of entropy (~43 base64url chars)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32) // 256 bits
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generate PKCE code challenge from verifier
 * RFC 7636 + RFC 9700: ONLY S256 method allowed
 * @param verifier - Code verifier string
 * @returns Base64url-encoded SHA-256 hash of verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(hash))
}

/**
 * Validate PKCE code verifier format
 * RFC 7636: 43-128 chars, unreserved characters only
 */
export function validateCodeVerifier(verifier: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) {
    return false
  }
  // RFC 7636: unreserved characters = [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  return /^[A-Za-z0-9\-._~]+$/.test(verifier)
}

/**
 * Verify PKCE code challenge against verifier
 * Used for validation in custom OAuth server implementations
 * @param verifier - Code verifier from client
 * @param challenge - Code challenge to verify against
 * @returns True if challenge matches verifier
 */
export async function verifyCodeChallenge(verifier: string, challenge: string): Promise<boolean> {
  if (!validateCodeVerifier(verifier)) {
    return false
  }
  const computedChallenge = await generateCodeChallenge(verifier)
  return computedChallenge === challenge
}

/**
 * Base64url encode (no padding, URL-safe)
 * RFC 7636 requirement for PKCE
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
