/**
 * @module auth/oauth/define-provider
 * @description Factory for custom OAuth provider definitions
 *
 * Use cases:
 * - Corporate SSO providers
 * - Custom OIDC providers
 * - Regional OAuth services
 */

import type { OAuthProviderConfig } from './types'
import { OAuthError } from './errors'

/**
 * Define a custom OAuth provider
 * @param config - Provider configuration
 * @returns Validated provider configuration
 */
export function defineOAuthProvider(
  config: Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'>
): Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'> {
  // Validate required fields
  if (!config.id) {
    throw new OAuthError('OAUTH_CONFIG_INVALID', 'Provider ID is required', 'unknown')
  }

  if (!config.authorizationUrl) {
    throw new OAuthError('OAUTH_CONFIG_INVALID', 'Authorization URL is required', config.id)
  }

  if (!config.tokenUrl) {
    throw new OAuthError('OAUTH_CONFIG_INVALID', 'Token URL is required', config.id)
  }

  if (!config.scopes || config.scopes.length === 0) {
    throw new OAuthError('OAUTH_CONFIG_INVALID', 'At least one scope is required', config.id)
  }

  // Validate URLs are HTTPS (security requirement)
  validateHttpsUrl(config.authorizationUrl, 'Authorization URL', config.id)
  validateHttpsUrl(config.tokenUrl, 'Token URL', config.id)
  if (config.userInfoUrl) {
    validateHttpsUrl(config.userInfoUrl, 'User Info URL', config.id)
  }

  return config
}

/**
 * Validate that URL is HTTPS
 */
function validateHttpsUrl(url: string, field: string, providerId: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      throw new OAuthError('OAUTH_CONFIG_INVALID', `${field} must use HTTPS protocol`, providerId)
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new OAuthError('OAUTH_CONFIG_INVALID', `${field} is not a valid URL`, providerId)
    }
    throw error
  }
}

/**
 * Create OAuth provider with OpenID Connect discovery
 * @param issuerUrl - OIDC issuer URL (e.g., https://accounts.google.com)
 * @param id - Provider ID
 * @param scopes - OAuth scopes
 * @returns Provider configuration promise
 */
export async function discoverOAuthProvider(
  issuerUrl: string,
  id: string,
  scopes: string[]
): Promise<Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'>> {
  validateHttpsUrl(issuerUrl, 'Issuer URL', id)

  // Construct discovery URL (.well-known/openid-configuration)
  const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`

  try {
    const response = await fetch(discoveryUrl)
    if (!response.ok) {
      throw new OAuthError(
        'OIDC_DISCOVERY_FAILED',
        `OIDC discovery failed: HTTP ${response.status}`,
        id
      )
    }

    const metadata = (await response.json()) as {
      authorization_endpoint: string
      token_endpoint: string
      userinfo_endpoint?: string
    }

    return defineOAuthProvider({
      id,
      authorizationUrl: metadata.authorization_endpoint,
      tokenUrl: metadata.token_endpoint,
      userInfoUrl: metadata.userinfo_endpoint,
      scopes,
      pkce: true, // OIDC providers typically support PKCE
    })
  } catch (error) {
    if (error instanceof OAuthError) {
      throw error
    }
    if (error instanceof Error) {
      throw new OAuthError('OIDC_DISCOVERY_FAILED', `OIDC discovery failed: ${error.message}`, id)
    }
    throw error
  }
}
