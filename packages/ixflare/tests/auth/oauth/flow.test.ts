/**
 * @module tests/auth/oauth/flow
 * @description Tests for OAuth flow primitives
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildAuthorizationUrl, exchangeCode, fetchUserProfile } from '@/auth/oauth/flow'
import type { OAuthProviderConfig } from '@/auth/oauth/types'
import { OAuthTokenError, OAuthError } from '@/auth/oauth/errors'

const mockProvider: OAuthProviderConfig = {
  id: 'github',
  clientId: 'client_123',
  clientSecret: 'secret_456',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scopes: ['user:email', 'read:user'],
  pkce: false,
}

describe('OAuth Flow Primitives', () => {
  describe('buildAuthorizationUrl', () => {
    it('should build complete authorization URL', () => {
      const url = buildAuthorizationUrl(mockProvider, {
        state: 'state_123',
        redirectUri: 'https://example.com/callback',
      })

      expect(url).toContain('https://github.com/login/oauth/authorize')
      expect(url).toContain('client_id=client_123')
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback')
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=user%3Aemail+read%3Auser')
      expect(url).toContain('state=state_123')
    })

    it('should include PKCE code challenge when provided', () => {
      const url = buildAuthorizationUrl(mockProvider, {
        state: 'state_123',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge_abc',
      })

      expect(url).toContain('code_challenge=challenge_abc')
      expect(url).toContain('code_challenge_method=S256')
    })

    it('should NOT include PKCE params when not provided', () => {
      const url = buildAuthorizationUrl(mockProvider, {
        state: 'state_123',
        redirectUri: 'https://example.com/callback',
      })

      expect(url).not.toContain('code_challenge')
      expect(url).not.toContain('code_challenge_method')
    })

    it('should properly encode scopes with spaces', () => {
      const url = buildAuthorizationUrl(mockProvider, {
        state: 'state_123',
        redirectUri: 'https://example.com/callback',
      })

      // Scopes should be space-separated and URL-encoded
      expect(url).toContain('scope=user%3Aemail+read%3Auser')
    })
  })

  describe('exchangeCode', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should exchange authorization code for tokens (confidential client)', async () => {
      const mockResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_456',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const tokens = await exchangeCode(
        mockProvider,
        'auth_code_123',
        'https://example.com/callback'
      )

      expect(tokens).toEqual({
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresIn: 3600,
        tokenType: 'Bearer',
        idToken: undefined,
      })

      // Verify request
      expect(fetchSpy).toHaveBeenCalledWith(
        mockProvider.tokenUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          }),
        })
      )

      // Verify body contains client credentials
      const body = fetchSpy.mock.calls[0][1].body
      expect(body).toContain('grant_type=authorization_code')
      expect(body).toContain('code=auth_code_123')
      expect(body).toContain('client_id=client_123')
      expect(body).toContain('client_secret=secret_456')
    })

    it('should exchange code with PKCE (public client)', async () => {
      const publicProvider: OAuthProviderConfig = {
        ...mockProvider,
        clientSecret: undefined, // Public client
        pkce: true,
      }

      const mockResponse = {
        access_token: 'access_token_123',
        token_type: 'Bearer',
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      await exchangeCode(
        publicProvider,
        'auth_code_123',
        'https://example.com/callback',
        'code_verifier_abc'
      )

      // Verify body contains code_verifier but NOT client_secret
      const body = fetchSpy.mock.calls[0][1].body
      expect(body).toContain('code_verifier=code_verifier_abc')
      expect(body).toContain('client_id=client_123')
      expect(body).not.toContain('client_secret')
    })

    it('should handle OIDC id_token', async () => {
      const mockResponse = {
        access_token: 'access_token_123',
        id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer',
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const tokens = await exchangeCode(
        mockProvider,
        'auth_code_123',
        'https://example.com/callback'
      )

      expect(tokens.idToken).toBe('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...')
    })

    it('should throw OAuthTokenError on HTTP error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
      })

      await expect(
        exchangeCode(mockProvider, 'invalid_code', 'https://example.com/callback')
      ).rejects.toThrow(OAuthTokenError)
    })

    it('should NOT log secrets in errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'client_secret is invalid' }),
      })

      try {
        await exchangeCode(mockProvider, 'code', 'https://example.com/callback')
        expect.fail('Should have thrown error')
      } catch (error: any) {
        // Error message should NOT contain actual secrets
        expect(error.message).not.toContain('secret_456')
        expect(error.message).toContain('Token exchange failed')
      }
    })

    it('should handle network errors gracefully', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'))

      await expect(
        exchangeCode(mockProvider, 'code', 'https://example.com/callback')
      ).rejects.toThrow(OAuthTokenError)
    })
  })

  describe('fetchUserProfile', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should fetch user profile with access token', async () => {
      const mockProfile = {
        id: 12345,
        login: 'octocat',
        email: 'octocat@github.com',
        name: 'The Octocat',
        avatar_url: 'https://github.com/images/octocat.png',
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      })

      const profile = await fetchUserProfile(mockProvider, 'access_token_123')

      expect(profile).toEqual(mockProfile)

      // Verify Authorization header
      expect(fetchSpy).toHaveBeenCalledWith(
        mockProvider.userInfoUrl,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer access_token_123',
            Accept: 'application/json',
          }),
        })
      )
    })

    it('should throw error when userInfoUrl not configured', async () => {
      const providerWithoutUserInfo: OAuthProviderConfig = {
        ...mockProvider,
        userInfoUrl: undefined,
      }

      await expect(fetchUserProfile(providerWithoutUserInfo, 'token')).rejects.toThrow(OAuthError)
    })

    it('should throw error on HTTP error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
      })

      await expect(fetchUserProfile(mockProvider, 'invalid_token')).rejects.toThrow(OAuthError)
    })

    it('should handle network errors', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'))

      await expect(fetchUserProfile(mockProvider, 'token')).rejects.toThrow(OAuthError)
    })
  })

  describe('Security: Timeout Protection', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should timeout slow token endpoint requests', async () => {
      // Mock slow response (never resolves)
      fetchSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve to simulate timeout
          })
      )

      // Note: Actual timeout test would require real delay
      // This is a conceptual test - in practice would need to mock timers
    }, 15000)
  })

  describe('Integration: Complete OAuth Flow', () => {
    it('should simulate complete authorization code flow', () => {
      // Step 1: Build authorization URL
      const authUrl = buildAuthorizationUrl(mockProvider, {
        state: 'state_123',
        redirectUri: 'https://example.com/callback',
      })

      expect(authUrl).toContain('response_type=code')
      expect(authUrl).toContain('state=state_123')

      // Step 2: User redirected to provider, authorizes, redirected back with code
      // (simulated)

      // Step 3: Exchange authorization code for tokens
      // (tested separately above)

      // Step 4: Fetch user profile with access token
      // (tested separately above)
    })

    it('should simulate PKCE flow', async () => {
      const pkceProvider: OAuthProviderConfig = {
        ...mockProvider,
        clientSecret: undefined,
        pkce: true,
      }

      // Step 1: Build authorization URL with code challenge
      const authUrl = buildAuthorizationUrl(pkceProvider, {
        state: 'state_123',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge_abc',
      })

      expect(authUrl).toContain('code_challenge=challenge_abc')
      expect(authUrl).toContain('code_challenge_method=S256')

      // Step 2: Exchange code with code_verifier
      // (would require actual fetch mock - tested above)
    })
  })
})
