/**
 * @module tests/auth/oauth/validation
 * @description Tests for OAuth redirect URI validation (RFC 9700)
 */

import { describe, it, expect } from 'vitest'
import { validateRedirectUri, preventOpenRedirect, buildCallbackUri } from '@/auth/oauth/validation'
import { OAuthRedirectError } from '@/auth/oauth/errors'

describe('OAuth Redirect URI Validation (RFC 9700)', () => {
  const allowedUris = [
    'https://app.example.com/auth/callback',
    'https://app.example.com/auth/github/callback',
    'http://localhost:3000/auth/callback',
  ]

  describe('validateRedirectUri', () => {
    it('should accept exact matching redirect URI', () => {
      expect(() =>
        validateRedirectUri('https://app.example.com/auth/callback', allowedUris, 'github')
      ).not.toThrow()
    })

    it('should accept localhost with HTTP for development', () => {
      expect(() =>
        validateRedirectUri('http://localhost:3000/auth/callback', allowedUris, 'github')
      ).not.toThrow()
    })

    it('should reject redirect URI not in allowed list', () => {
      expect(() => validateRedirectUri('https://evil.com/callback', allowedUris, 'github')).toThrow(
        OAuthRedirectError
      )
    })

    it('should reject redirect URI with query parameters (RFC 9700)', () => {
      expect(() =>
        validateRedirectUri('https://app.example.com/auth/callback?foo=bar', allowedUris, 'github')
      ).toThrow('Redirect URI must not contain query parameters')
    })

    it('should reject redirect URI with fragment identifiers (RFC 9700)', () => {
      expect(() =>
        validateRedirectUri('https://app.example.com/auth/callback#fragment', allowedUris, 'github')
      ).toThrow('Redirect URI must not contain fragment identifiers')
    })

    it('should reject HTTP for non-localhost domains', () => {
      expect(() =>
        validateRedirectUri('http://app.example.com/auth/callback', allowedUris, 'github')
      ).toThrow('Redirect URI must use HTTPS protocol')
    })

    it('should reject invalid URI format', () => {
      expect(() => validateRedirectUri('not-a-url', allowedUris, 'github')).toThrow(
        'Invalid redirect URI format'
      )
    })

    it('should enforce exact string matching (case-sensitive)', () => {
      expect(() =>
        validateRedirectUri('https://APP.example.com/auth/callback', allowedUris, 'github')
      ).toThrow(OAuthRedirectError)
    })

    it('should reject partial matches', () => {
      expect(() =>
        validateRedirectUri('https://app.example.com/auth', allowedUris, 'github')
      ).toThrow(OAuthRedirectError)
    })

    it('should reject wildcard attempts', () => {
      expect(() =>
        validateRedirectUri('https://app.example.com/auth/*', allowedUris, 'github')
      ).toThrow(OAuthRedirectError)
    })
  })

  describe('Security: Prevent Open Redirector Attacks', () => {
    const trustedDomains = ['example.com', '*.staging.example.com', 'localhost']

    it('should allow redirect to trusted domain', () => {
      expect(() =>
        preventOpenRedirect('https://example.com/callback', trustedDomains, 'github')
      ).not.toThrow()
    })

    it('should allow redirect to trusted subdomain', () => {
      expect(() =>
        preventOpenRedirect('https://app.staging.example.com/callback', trustedDomains, 'github')
      ).not.toThrow()
    })

    it('should allow redirect to localhost', () => {
      expect(() =>
        preventOpenRedirect('http://localhost:3000/callback', trustedDomains, 'github')
      ).not.toThrow()
    })

    it('should reject redirect to untrusted domain', () => {
      expect(() =>
        preventOpenRedirect('https://evil.com/callback', trustedDomains, 'github')
      ).toThrow('Redirect URI domain is not in trusted domains list')
    })

    it('should reject subdomain when parent not in wildcard', () => {
      expect(() =>
        preventOpenRedirect('https://app.example.com/callback', ['*.staging.example.com'], 'github')
      ).toThrow(OAuthRedirectError)
    })

    it('should reject invalid URI format', () => {
      expect(() => preventOpenRedirect('not-a-url', trustedDomains, 'github')).toThrow(
        'Invalid redirect URI format'
      )
    })
  })

  describe('Security: Attack Vector Tests', () => {
    it('should prevent query parameter injection', () => {
      const malicious = 'https://app.example.com/auth/callback?redirect=https://evil.com'
      expect(() => validateRedirectUri(malicious, allowedUris, 'github')).toThrow(
        'Redirect URI must not contain query parameters'
      )
    })

    it('should prevent fragment injection', () => {
      const malicious = 'https://app.example.com/auth/callback#redirect=https://evil.com'
      expect(() => validateRedirectUri(malicious, allowedUris, 'github')).toThrow(
        'Redirect URI must not contain fragment identifiers'
      )
    })

    it('should prevent path traversal attempts', () => {
      const malicious = 'https://app.example.com/auth/../admin/callback'
      expect(() => validateRedirectUri(malicious, allowedUris, 'github')).toThrow(
        OAuthRedirectError
      )
    })

    it('should prevent URL encoding bypass attempts', () => {
      // Try to bypass with URL encoding
      const encoded = encodeURIComponent('https://app.example.com/auth/callback?evil=true')
      expect(() => validateRedirectUri(encoded, allowedUris, 'github')).toThrow(OAuthRedirectError)
    })

    it('should prevent subdomain takeover attacks', () => {
      const malicious = 'https://evil.app.example.com/callback'
      expect(() => validateRedirectUri(malicious, allowedUris, 'github')).toThrow(
        OAuthRedirectError
      )
    })

    it('should prevent homograph attacks', () => {
      // Unicode lookalike characters
      const malicious = 'https://app.exαmple.com/auth/callback' // α instead of a
      expect(() => validateRedirectUri(malicious, allowedUris, 'github')).toThrow(
        OAuthRedirectError
      )
    })

    it('should prevent port number manipulation', () => {
      const malicious = 'https://app.example.com:8080/auth/callback'
      expect(() => validateRedirectUri(malicious, allowedUris, 'github')).toThrow(
        OAuthRedirectError
      )
    })
  })

  describe('buildCallbackUri', () => {
    it('should build callback URI from base URL', () => {
      const uri = buildCallbackUri('https://app.example.com', 'github')
      expect(uri).toBe('https://app.example.com/auth/github/callback')
    })

    it('should handle base URL with path', () => {
      const uri = buildCallbackUri('https://app.example.com/app', 'google')
      expect(uri).toBe('https://app.example.com/auth/google/callback')
    })

    it('should handle base URL with port', () => {
      const uri = buildCallbackUri('http://localhost:3000', 'discord')
      expect(uri).toBe('http://localhost:3000/auth/discord/callback')
    })

    it('should handle base URL with trailing slash', () => {
      const uri = buildCallbackUri('https://app.example.com/', 'github')
      expect(uri).toBe('https://app.example.com/auth/github/callback')
    })
  })

  describe('RFC 9700 Compliance', () => {
    it('should enforce exact string matching per RFC 9700', () => {
      // RFC 9700: "The authorization server MUST require exact string matching"
      const allowed = ['https://app.example.com/callback']

      // Different path - should fail
      expect(() =>
        validateRedirectUri('https://app.example.com/CALLBACK', allowed, 'test')
      ).toThrow()

      // Different protocol - should fail
      expect(() =>
        validateRedirectUri('http://app.example.com/callback', allowed, 'test')
      ).toThrow()

      // With query - should fail
      expect(() =>
        validateRedirectUri('https://app.example.com/callback?', allowed, 'test')
      ).toThrow()

      // Exact match - should pass
      expect(() =>
        validateRedirectUri('https://app.example.com/callback', allowed, 'test')
      ).not.toThrow()
    })

    it('should reject query parameters per RFC 9700', () => {
      // RFC 9700: "The redirect_uri value MUST NOT contain a query parameter"
      const uri = 'https://app.example.com/callback?state=xyz'
      expect(() => validateRedirectUri(uri, [uri], 'test')).toThrow(
        'Redirect URI must not contain query parameters'
      )
    })

    it('should reject fragment identifiers per RFC 9700', () => {
      // RFC 9700: "The redirect_uri value MUST NOT contain a fragment identifier"
      const uri = 'https://app.example.com/callback#token'
      expect(() => validateRedirectUri(uri, [uri], 'test')).toThrow(
        'Redirect URI must not contain fragment identifiers'
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle IPv4 localhost', () => {
      const allowed = ['http://127.0.0.1:3000/callback']
      expect(() =>
        validateRedirectUri('http://127.0.0.1:3000/callback', allowed, 'test')
      ).not.toThrow()
    })

    it('should handle IPv6 localhost', () => {
      const allowed = ['http://[::1]:3000/callback']
      expect(() => validateRedirectUri('http://[::1]:3000/callback', allowed, 'test')).not.toThrow()
    })

    it('should handle custom ports', () => {
      const allowed = ['https://app.example.com:8443/callback']
      expect(() =>
        validateRedirectUri('https://app.example.com:8443/callback', allowed, 'test')
      ).not.toThrow()
    })

    it('should handle deep paths', () => {
      const allowed = ['https://app.example.com/auth/oauth/v2/callback']
      expect(() =>
        validateRedirectUri('https://app.example.com/auth/oauth/v2/callback', allowed, 'test')
      ).not.toThrow()
    })
  })
})
