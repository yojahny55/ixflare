/**
 * @module tests/auth/oauth/providers/github
 * @description Tests for GitHub OAuth provider adapter
 */

import { describe, it, expect } from 'vitest'
import { githubProvider, normalizeGitHubProfile } from '@/auth/oauth/providers/github'

describe('GitHub OAuth Provider', () => {
  describe('Provider Configuration', () => {
    it('should have correct OAuth endpoints', () => {
      expect(githubProvider.id).toBe('github')
      expect(githubProvider.authorizationUrl).toBe('https://github.com/login/oauth/authorize')
      expect(githubProvider.tokenUrl).toBe('https://github.com/login/oauth/access_token')
      expect(githubProvider.userInfoUrl).toBe('https://api.github.com/user')
    })

    it('should have default scopes', () => {
      expect(githubProvider.scopes).toEqual(['user:email'])
    })

    it('should support PKCE (S256 only since July 2025)', () => {
      expect(githubProvider.pkce).toBe(true)
    })
  })

  describe('Profile Normalization', () => {
    it('should normalize complete GitHub profile', () => {
      const rawProfile = {
        id: 12345,
        login: 'octocat',
        email: 'octocat@github.com',
        name: 'The Octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        bio: 'GitHub mascot',
        company: 'GitHub',
      }

      const normalized = normalizeGitHubProfile(rawProfile)

      expect(normalized).toEqual({
        id: '12345',
        email: 'octocat@github.com',
        name: 'The Octocat',
        avatar: 'https://avatars.githubusercontent.com/u/12345',
        raw: rawProfile,
      })
    })

    it('should handle missing optional fields', () => {
      const rawProfile = {
        id: 12345,
        login: 'octocat',
      }

      const normalized = normalizeGitHubProfile(rawProfile)

      expect(normalized).toEqual({
        id: '12345',
        email: undefined,
        name: undefined,
        avatar: undefined,
        raw: rawProfile,
      })
    })

    it('should preserve raw profile data', () => {
      const rawProfile = {
        id: 12345,
        login: 'octocat',
        custom_field: 'custom_value',
      }

      const normalized = normalizeGitHubProfile(rawProfile)

      expect(normalized.raw).toEqual(rawProfile)
      expect(normalized.raw).toHaveProperty('custom_field', 'custom_value')
    })

    it('should convert numeric ID to string', () => {
      const rawProfile = {
        id: 12345,
      }

      const normalized = normalizeGitHubProfile(rawProfile)

      expect(normalized.id).toBe('12345')
      expect(typeof normalized.id).toBe('string')
    })
  })
})
