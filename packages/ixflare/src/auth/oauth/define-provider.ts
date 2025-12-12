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
    throw new Error('Provider ID is required')
  }

  if (!config.authorizationUrl) {
    throw new Error('Authorization URL is required')
  }

  if (!config.tokenUrl) {
    throw new Error('Token URL is required')
  }

  if (!config.scopes || config.scopes.length === 0) {
    throw new Error('At least one scope is required')
  }

  // Validate URLs are HTTPS (security requirement)
  validateHttpsUrl(config.authorizationUrl, 'Authorization URL')
  validateHttpsUrl(config.tokenUrl, 'Token URL')
  if (config.userInfoUrl) {
    validateHttpsUrl(config.userInfoUrl, 'User Info URL')
  }

  return config
}

/**
 * Validate that URL is HTTPS
 */
function validateHttpsUrl(url: string, field: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      throw new Error(`${field} must use HTTPS protocol`)
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${field} is not a valid URL`)
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
  validateHttpsUrl(issuerUrl, 'Issuer URL')

  // Construct discovery URL (.well-known/openid-configuration)
  const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`

  try {
    const response = await fetch(discoveryUrl)
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: HTTP ${response.status}`)
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
    if (error instanceof Error) {
      throw new Error(`OIDC discovery failed: ${error.message}`)
    }
    throw error
  }
}
