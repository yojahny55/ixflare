/**
 * @module auth/oauth/types
 * @description OAuth 2.0 type definitions
 */

export interface OAuthProviderConfig {
  id: string
  clientId: string
  clientSecret?: string // Optional for PKCE public clients
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string[]
  pkce?: boolean // Enable PKCE (S256 only per RFC 9700)
  redirectUri?: string
}

export interface OAuthProfile {
  id: string
  email?: string
  name?: string
  avatar?: string
  raw: Record<string, unknown> // Original provider response
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  tokenType: string
  idToken?: string // For OIDC providers
}

export interface OAuthState {
  state: string
  provider: string
  sessionId?: string
  codeVerifier?: string // For PKCE
  redirectUri: string
  createdAt: number
}
