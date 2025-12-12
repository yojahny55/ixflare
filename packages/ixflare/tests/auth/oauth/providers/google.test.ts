/**
 * @module tests/auth/oauth/providers/google
 * @description Tests for Google OAuth provider adapter
 */

import { describe, it, expect } from 'vitest'
import { googleProvider, normalizeGoogleProfile } from '@/auth/oauth/providers/google'

describe('Google OAuth Provider', () => {
  describe('Provider Configuration', () => {
    it('should have correct OAuth endpoints', () => {
      expect(googleProvider.id).toBe('google')
      expect(googleProvider.authorizationUrl).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(googleProvider.tokenUrl).toBe('https://oauth2.googleapis.com/token')
      expect(googleProvider.userInfoUrl).toBe('https://www.googleapis.com/oauth2/v3/userinfo')
    })

    it('should have OIDC scopes', () => {
      expect(googleProvider.scopes).toEqual(['openid', 'email', 'profile'])
    })

    it('should support PKCE', () => {
      expect(googleProvider.pkce).toBe(true)
    })
  })

  describe('Profile Normalization', () => {
    it('should normalize complete Google profile', () => {
      const rawProfile = {
        sub: '1234567890',
        email: 'user@example.com',
        email_verified: true,
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://lh3.googleusercontent.com/a/abc123',
        locale: 'en',
      }

      const normalized = normalizeGoogleProfile(rawProfile)

      expect(normalized).toEqual({
        id: '1234567890',
        email: 'user@example.com',
        name: 'John Doe',
        avatar: 'https://lh3.googleusercontent.com/a/abc123',
        raw: rawProfile,
      })
    })

    it('should handle missing optional fields', () => {
      const rawProfile = {
        sub: '1234567890',
      }

      const normalized = normalizeGoogleProfile(rawProfile)

      expect(normalized).toEqual({
        id: '1234567890',
        email: undefined,
        name: undefined,
        avatar: undefined,
        raw: rawProfile,
      })
    })

    it('should use "sub" as user ID (OIDC standard)', () => {
      const rawProfile = {
        sub: 'google-user-123',
      }

      const normalized = normalizeGoogleProfile(rawProfile)

      expect(normalized.id).toBe('google-user-123')
    })

    it('should preserve raw profile data', () => {
      const rawProfile = {
        sub: '1234567890',
        email_verified: true,
        hd: 'example.com', // Hosted domain
      }

      const normalized = normalizeGoogleProfile(rawProfile)

      expect(normalized.raw).toEqual(rawProfile)
      expect(normalized.raw).toHaveProperty('email_verified', true)
      expect(normalized.raw).toHaveProperty('hd', 'example.com')
    })
  })
})
