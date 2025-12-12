/**
 * @module tests/auth/oauth/define-provider
 * @description Tests for custom OAuth provider factory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineOAuthProvider, discoverOAuthProvider } from '@/auth/oauth/define-provider'

describe('Custom OAuth Provider Factory', () => {
  describe('defineOAuthProvider', () => {
    it('should define valid custom provider', () => {
      const provider = defineOAuthProvider({
        id: 'corporate-sso',
        authorizationUrl: 'https://sso.company.com/authorize',
        tokenUrl: 'https://sso.company.com/token',
        userInfoUrl: 'https://sso.company.com/userinfo',
        scopes: ['openid', 'profile', 'email'],
      })

      expect(provider).toEqual({
        id: 'corporate-sso',
        authorizationUrl: 'https://sso.company.com/authorize',
        tokenUrl: 'https://sso.company.com/token',
        userInfoUrl: 'https://sso.company.com/userinfo',
        scopes: ['openid', 'profile', 'email'],
      })
    })

    it('should accept provider without userInfoUrl', () => {
      const provider = defineOAuthProvider({
        id: 'minimal-provider',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        scopes: ['read'],
      })

      expect(provider.userInfoUrl).toBeUndefined()
    })

    it('should accept PKCE configuration', () => {
      const provider = defineOAuthProvider({
        id: 'pkce-provider',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        scopes: ['read'],
        pkce: true,
      })

      expect(provider.pkce).toBe(true)
    })

    it('should throw error for missing id', () => {
      expect(() =>
        defineOAuthProvider({
          id: '',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          scopes: ['read'],
        })
      ).toThrow('Provider ID is required')
    })

    it('should throw error for missing authorizationUrl', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'test',
          authorizationUrl: '',
          tokenUrl: 'https://auth.example.com/token',
          scopes: ['read'],
        })
      ).toThrow('Authorization URL is required')
    })

    it('should throw error for missing tokenUrl', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'test',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: '',
          scopes: ['read'],
        })
      ).toThrow('Token URL is required')
    })

    it('should throw error for empty scopes', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'test',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          scopes: [],
        })
      ).toThrow('At least one scope is required')
    })

    it('should enforce HTTPS for authorization URL', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'insecure',
          authorizationUrl: 'http://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          scopes: ['read'],
        })
      ).toThrow('Authorization URL must use HTTPS protocol')
    })

    it('should enforce HTTPS for token URL', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'insecure',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'http://auth.example.com/token',
          scopes: ['read'],
        })
      ).toThrow('Token URL must use HTTPS protocol')
    })

    it('should enforce HTTPS for user info URL', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'insecure',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          userInfoUrl: 'http://auth.example.com/userinfo',
          scopes: ['read'],
        })
      ).toThrow('User Info URL must use HTTPS protocol')
    })

    it('should throw error for invalid URL format', () => {
      expect(() =>
        defineOAuthProvider({
          id: 'invalid',
          authorizationUrl: 'not-a-url',
          tokenUrl: 'https://auth.example.com/token',
          scopes: ['read'],
        })
      ).toThrow('Authorization URL is not a valid URL')
    })
  })

  describe('discoverOAuthProvider (OIDC Discovery)', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should discover provider from OIDC metadata', async () => {
      const mockMetadata = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        userinfo_endpoint: 'https://auth.example.com/userinfo',
        jwks_uri: 'https://auth.example.com/jwks',
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockMetadata,
      })

      const provider = await discoverOAuthProvider('https://auth.example.com', 'custom-oidc', [
        'openid',
        'profile',
      ])

      expect(provider).toEqual({
        id: 'custom-oidc',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        userInfoUrl: 'https://auth.example.com/userinfo',
        scopes: ['openid', 'profile'],
        pkce: true,
      })

      // Verify discovery URL
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://auth.example.com/.well-known/openid-configuration'
      )
    })

    it('should handle issuer URL with trailing slash', async () => {
      const mockMetadata = {
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        userinfo_endpoint: 'https://auth.example.com/userinfo',
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockMetadata,
      })

      await discoverOAuthProvider('https://auth.example.com/', 'custom-oidc', ['openid'])

      // Should normalize URL (remove trailing slash)
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://auth.example.com/.well-known/openid-configuration'
      )
    })

    it('should throw error for HTTP issuer URL', async () => {
      await expect(
        discoverOAuthProvider('http://auth.example.com', 'insecure', ['openid'])
      ).rejects.toThrow('Issuer URL must use HTTPS protocol')
    })

    it('should throw error for invalid issuer URL', async () => {
      await expect(discoverOAuthProvider('not-a-url', 'invalid', ['openid'])).rejects.toThrow(
        'Issuer URL is not a valid URL'
      )
    })

    it('should throw error when discovery fails', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
      })

      await expect(
        discoverOAuthProvider('https://auth.example.com', 'missing', ['openid'])
      ).rejects.toThrow('OIDC discovery failed: HTTP 404')
    })

    it('should throw error on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'))

      await expect(
        discoverOAuthProvider('https://auth.example.com', 'network-fail', ['openid'])
      ).rejects.toThrow('OIDC discovery failed: Network error')
    })
  })

  describe('Integration: Custom Provider Usage', () => {
    it('should define corporate SSO provider', () => {
      const corporateSSO = defineOAuthProvider({
        id: 'company-sso',
        authorizationUrl: 'https://sso.company.com/oauth2/authorize',
        tokenUrl: 'https://sso.company.com/oauth2/token',
        userInfoUrl: 'https://sso.company.com/oauth2/userinfo',
        scopes: ['openid', 'profile', 'email', 'groups'],
        pkce: true,
      })

      expect(corporateSSO.id).toBe('company-sso')
      expect(corporateSSO.scopes).toContain('groups')
    })

    it('should define regional OAuth service', () => {
      const regionalProvider = defineOAuthProvider({
        id: 'eu-auth',
        authorizationUrl: 'https://eu.auth.example.com/authorize',
        tokenUrl: 'https://eu.auth.example.com/token',
        scopes: ['read', 'write'],
      })

      expect(regionalProvider.id).toBe('eu-auth')
    })
  })
})
