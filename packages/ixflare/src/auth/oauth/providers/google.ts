/**
 * @module auth/oauth/providers/google
 * @description Google OAuth provider adapter (OpenID Connect)
 *
 * Features:
 * - OIDC compliant (id_token support)
 * - User profile normalization
 *
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 */

import type { OAuthProviderConfig, OAuthProfile } from '@/auth/oauth/types'

export const googleProvider: Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'> = {
  id: 'google',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
  scopes: ['openid', 'email', 'profile'],
  pkce: true, // Google supports PKCE
}

/**
 * Normalize Google user profile to standard format
 */
export function normalizeGoogleProfile(raw: Record<string, unknown>): OAuthProfile {
  return {
    id: raw.sub as string, // Google uses "sub" (subject) as user ID
    email: raw.email as string | undefined,
    name: raw.name as string | undefined,
    avatar: raw.picture as string | undefined,
    raw,
  }
}
