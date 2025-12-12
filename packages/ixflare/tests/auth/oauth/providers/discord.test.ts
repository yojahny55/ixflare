/**
 * @module tests/auth/oauth/providers/discord
 * @description Tests for Discord OAuth provider adapter
 */

import { describe, it, expect } from 'vitest'
import { discordProvider, normalizeDiscordProfile } from '@/auth/oauth/providers/discord'

describe('Discord OAuth Provider', () => {
  describe('Provider Configuration', () => {
    it('should have correct OAuth endpoints', () => {
      expect(discordProvider.id).toBe('discord')
      expect(discordProvider.authorizationUrl).toBe('https://discord.com/oauth2/authorize')
      expect(discordProvider.tokenUrl).toBe('https://discord.com/api/oauth2/token')
      expect(discordProvider.userInfoUrl).toBe('https://discord.com/api/users/@me')
    })

    it('should have default scopes', () => {
      expect(discordProvider.scopes).toEqual(['identify', 'email'])
    })

    it('should support PKCE', () => {
      expect(discordProvider.pkce).toBe(true)
    })
  })

  describe('Profile Normalization', () => {
    it('should normalize complete Discord profile', () => {
      const rawProfile = {
        id: '123456789012345678',
        username: 'discorduser',
        discriminator: '1234',
        email: 'user@example.com',
        verified: true,
        avatar: 'a1b2c3d4e5f6g7h8i9j0',
        global_name: 'Discord User',
      }

      const normalized = normalizeDiscordProfile(rawProfile)

      expect(normalized).toEqual({
        id: '123456789012345678',
        email: 'user@example.com',
        name: 'discorduser',
        avatar: 'https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3d4e5f6g7h8i9j0.png',
        raw: rawProfile,
      })
    })

    it('should handle missing avatar', () => {
      const rawProfile = {
        id: '123456789012345678',
        username: 'discorduser',
      }

      const normalized = normalizeDiscordProfile(rawProfile)

      expect(normalized.avatar).toBeUndefined()
    })

    it('should construct correct avatar CDN URL', () => {
      const rawProfile = {
        id: '987654321098765432',
        username: 'testuser',
        avatar: 'abc123def456',
      }

      const normalized = normalizeDiscordProfile(rawProfile)

      expect(normalized.avatar).toBe(
        'https://cdn.discordapp.com/avatars/987654321098765432/abc123def456.png'
      )
    })

    it('should handle missing optional fields', () => {
      const rawProfile = {
        id: '123456789012345678',
        username: 'discorduser',
      }

      const normalized = normalizeDiscordProfile(rawProfile)

      expect(normalized).toEqual({
        id: '123456789012345678',
        email: undefined,
        name: 'discorduser',
        avatar: undefined,
        raw: rawProfile,
      })
    })

    it('should preserve raw profile data', () => {
      const rawProfile = {
        id: '123456789012345678',
        username: 'discorduser',
        discriminator: '1234',
        verified: true,
        locale: 'en-US',
        mfa_enabled: true,
      }

      const normalized = normalizeDiscordProfile(rawProfile)

      expect(normalized.raw).toEqual(rawProfile)
      expect(normalized.raw).toHaveProperty('discriminator', '1234')
      expect(normalized.raw).toHaveProperty('mfa_enabled', true)
    })
  })
})
