/**
 * @module auth/oauth/providers
 * @description Built-in OAuth provider registry
 */

export * from './github'
export * from './google'
export * from './discord'

import { githubProvider, normalizeGitHubProfile } from './github'
import { googleProvider, normalizeGoogleProfile } from './google'
import { discordProvider, normalizeDiscordProfile } from './discord'
import type { OAuthProfile } from '@/auth/oauth/types'

/**
 * Provider registry for built-in providers
 */
export const providers = {
  github: githubProvider,
  google: googleProvider,
  discord: discordProvider,
} as const

/**
 * Profile normalizers for built-in providers
 */
export const profileNormalizers: Record<string, (raw: Record<string, unknown>) => OAuthProfile> = {
  github: normalizeGitHubProfile,
  google: normalizeGoogleProfile,
  discord: normalizeDiscordProfile,
}

/**
 * Get normalizer for provider
 */
export function getProfileNormalizer(
  providerId: string
): ((raw: Record<string, unknown>) => OAuthProfile) | undefined {
  return profileNormalizers[providerId]
}
