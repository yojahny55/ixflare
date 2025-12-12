/**
 * @module auth/oauth/validation
 * @description OAuth redirect URI validation (RFC 9700 compliant)
 *
 * Security requirements:
 * - Exact string matching (RFC 9700)
 * - No query parameters allowed
 * - No fragment identifiers allowed
 * - HTTPS required for production
 * - Prevent open redirector attacks
 */

import { OAuthRedirectError } from './errors'

/**
 * Validate OAuth redirect URI (RFC 9700 strict validation)
 * @param redirectUri - Redirect URI to validate
 * @param allowedUris - List of allowed redirect URIs
 * @param providerId - Provider ID for error messages
 * @throws OAuthRedirectError if validation fails
 */
export function validateRedirectUri(
  redirectUri: string,
  allowedUris: string[],
  providerId: string
): void {
  // Parse URL for format validation first
  let parsed: URL
  try {
    parsed = new URL(redirectUri)
  } catch {
    throw new OAuthRedirectError(providerId, 'Invalid redirect URI format')
  }

  // RFC 9700: Query parameters not allowed in redirect_uri
  if (parsed.search) {
    throw new OAuthRedirectError(providerId, 'Redirect URI must not contain query parameters')
  }

  // RFC 9700: Fragment identifiers not allowed in redirect_uri
  if (parsed.hash) {
    throw new OAuthRedirectError(providerId, 'Redirect URI must not contain fragment identifiers')
  }

  // HTTPS required for production (allow http://localhost for development)
  if (parsed.protocol !== 'https:' && !isLocalhost(parsed.hostname)) {
    throw new OAuthRedirectError(providerId, 'Redirect URI must use HTTPS protocol')
  }

  // RFC 9700: Exact string matching required (after validation)
  if (!allowedUris.includes(redirectUri)) {
    throw new OAuthRedirectError(providerId, 'Redirect URI does not match any allowed URI')
  }
}

/**
 * Check if hostname is localhost (for development)
 */
function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/**
 * Prevent open redirector attacks
 * @param redirectUri - Redirect URI to check
 * @param trustedDomains - List of trusted domains
 * @param providerId - Provider ID for error messages
 * @throws OAuthRedirectError if redirect is to untrusted domain
 */
export function preventOpenRedirect(
  redirectUri: string,
  trustedDomains: string[],
  providerId: string
): void {
  let parsed: URL
  try {
    parsed = new URL(redirectUri)
  } catch {
    throw new OAuthRedirectError(providerId, 'Invalid redirect URI format')
  }

  // Check if hostname is in trusted domains
  const isTrusted = trustedDomains.some((domain) => {
    // Exact match
    if (parsed.hostname === domain) return true

    // Subdomain match (*.example.com)
    if (domain.startsWith('*.')) {
      const baseDomain = domain.slice(2)
      return parsed.hostname.endsWith(`.${baseDomain}`)
    }

    return false
  })

  if (!isTrusted) {
    throw new OAuthRedirectError(providerId, 'Redirect URI domain is not in trusted domains list')
  }
}

/**
 * Build callback redirect URI from base URL and provider
 * @param baseUrl - Application base URL
 * @param providerId - Provider ID
 * @returns Callback redirect URI
 */
export function buildCallbackUri(baseUrl: string, providerId: string): string {
  const url = new URL(baseUrl)
  return `${url.origin}/auth/${providerId}/callback`
}
