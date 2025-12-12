/**
 * @module auth/oauth/providers/github
 * @description GitHub OAuth provider adapter
 *
 * Features:
 * - PKCE support (S256 only, since July 2025)
 * - User profile normalization
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authenticating-to-the-rest-api-with-an-oauth-app
 */

import type { OAuthProviderConfig, OAuthProfile } from '@/auth/oauth/types'

export const githubProvider: Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'> = {
  id: 'github',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scopes: ['user:email'],
  pkce: true, // GitHub supports PKCE since July 2025 (S256 only)
}

/**
 * Normalize GitHub user profile to standard format
 */
export function normalizeGitHubProfile(raw: Record<string, unknown>): OAuthProfile {
  return {
    id: String(raw.id),
    email: raw.email as string | undefined,
    name: raw.name as string | undefined,
    avatar: raw.avatar_url as string | undefined,
    raw,
  }
}
