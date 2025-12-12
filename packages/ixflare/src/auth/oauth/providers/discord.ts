/**
 * @module auth/oauth/providers/discord
 * @description Discord OAuth provider adapter
 *
 * Features:
 * - User profile normalization
 * - Avatar URL construction
 *
 * @see https://discord.com/developers/docs/topics/oauth2
 */

import type { OAuthProviderConfig, OAuthProfile } from '@/auth/oauth/types'

export const discordProvider: Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'> = {
  id: 'discord',
  authorizationUrl: 'https://discord.com/oauth2/authorize',
  tokenUrl: 'https://discord.com/api/oauth2/token',
  userInfoUrl: 'https://discord.com/api/users/@me',
  scopes: ['identify', 'email'],
  pkce: true, // Discord supports PKCE
}

/**
 * Normalize Discord user profile to standard format
 */
export function normalizeDiscordProfile(raw: Record<string, unknown>): OAuthProfile {
  const id = raw.id as string
  const avatar = raw.avatar as string | undefined

  // Construct full avatar URL if hash is available
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : undefined

  return {
    id,
    email: raw.email as string | undefined,
    name: raw.username as string | undefined,
    avatar: avatarUrl,
    raw,
  }
}
