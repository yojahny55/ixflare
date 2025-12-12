/**
 * @module auth/oauth/flow
 * @description OAuth 2.0 authorization code flow primitives
 *
 * Security requirements:
 * - HTTPS required for all endpoints
 * - Timeout protection (10s for token endpoint)
 * - No secret logging (redaction in errors)
 * - PKCE support (S256 only)
 */

import type { OAuthProviderConfig, OAuthTokens } from './types'
import { OAuthTokenError, OAuthError } from './errors'

const TOKEN_ENDPOINT_TIMEOUT = 10000 // 10 seconds

/**
 * Build OAuth authorization URL with all required parameters
 * @param provider - OAuth provider configuration
 * @param options - Authorization options (state, redirectUri, codeChallenge)
 */
export function buildAuthorizationUrl(
  provider: OAuthProviderConfig,
  options: {
    state: string
    redirectUri: string
    codeChallenge?: string
  }
): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state: options.state,
  })

  // Add PKCE challenge if enabled
  if (options.codeChallenge) {
    params.set('code_challenge', options.codeChallenge)
    params.set('code_challenge_method', 'S256') // Only S256 per RFC 9700
  }

  return `${provider.authorizationUrl}?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 * @param provider - OAuth provider configuration
 * @param code - Authorization code from callback
 * @param redirectUri - Callback redirect URI (must match authorization request)
 * @param codeVerifier - PKCE code verifier (if PKCE enabled)
 */
export async function exchangeCode(
  provider: OAuthProviderConfig,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  // Add client credentials if available (confidential client)
  if (provider.clientSecret) {
    params.set('client_id', provider.clientId)
    params.set('client_secret', provider.clientSecret)
  } else {
    // Public client - client_id only
    params.set('client_id', provider.clientId)
  }

  // Add PKCE code verifier if provided
  if (codeVerifier) {
    params.set('code_verifier', codeVerifier)
  }

  try {
    const response = await secureFetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      // DO NOT log response body - may contain sensitive error details
      throw new OAuthTokenError(provider.id, `HTTP ${response.status}`)
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
      id_token?: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
      idToken: data.id_token, // For OIDC providers
    }
  } catch (error) {
    if (error instanceof OAuthTokenError) {
      throw error
    }
    // DO NOT expose original error - may contain secrets
    throw new OAuthTokenError(provider.id)
  }
}

/**
 * Fetch user profile from provider
 * @param provider - OAuth provider configuration
 * @param accessToken - Access token from token exchange
 */
export async function fetchUserProfile(
  provider: OAuthProviderConfig,
  accessToken: string
): Promise<Record<string, unknown>> {
  if (!provider.userInfoUrl) {
    throw new OAuthError(
      'USER_INFO_UNAVAILABLE',
      'Provider does not support user info',
      provider.id
    )
  }

  try {
    const response = await secureFetch(provider.userInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new OAuthError(
        'USER_INFO_FAILED',
        `Failed to fetch user profile: HTTP ${response.status}`,
        provider.id
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof OAuthError) {
      throw error
    }
    throw new OAuthError('USER_INFO_FAILED', 'Failed to fetch user profile', provider.id)
  }
}

/**
 * Secure fetch wrapper with timeout and error handling
 * @param url - Request URL
 * @param options - Fetch options
 */
async function secureFetch(url: string, options: RequestInit): Promise<Response> {
  // Create abort controller for timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TOKEN_ENDPOINT_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
