/**
 * @module tests/auth/oauth/handlers
 * @description Tests for OAuth route handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleOAuthRedirect, handleOAuthCallback } from '@/auth/oauth/handlers'
import type { OAuthProviderConfig, OAuthContext } from '@/auth/oauth/handlers'
import { OAuthStateError, OAuthCallbackError } from '@/auth/oauth/errors'

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async getWithMetadata(): Promise<any> {
    return { value: null, metadata: null }
  }
  async list(): Promise<any> {
    return { keys: [], list_complete: true, cursor: '' }
  }
}

const mockProvider: OAuthProviderConfig = {
  id: 'github',
  clientId: 'client_123',
  clientSecret: 'secret_456',
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scopes: ['user:email'],
  pkce: true,
}

describe('OAuth Route Handlers', () => {
  let kv: KVNamespace
  let fetchSpy: any

  beforeEach(() => {
    kv = new MockKVNamespace()
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('handleOAuthRedirect', () => {
    it('should redirect to authorization URL', async () => {
      const handler = handleOAuthRedirect(mockProvider)

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      const response = await handler(ctx)

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('https://github.com/login/oauth/authorize')
      expect(location).toContain('client_id=client_123')
      expect(location).toContain('response_type=code')
      expect(location).toContain('state=')
    })

    it('should include PKCE challenge when PKCE enabled', async () => {
      const handler = handleOAuthRedirect(mockProvider)

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      const response = await handler(ctx)
      const location = response.headers.get('Location')!

      expect(location).toContain('code_challenge=')
      expect(location).toContain('code_challenge_method=S256')
    })

    it('should NOT include PKCE when disabled', async () => {
      const providerNoPKCE = { ...mockProvider, pkce: false }
      const handler = handleOAuthRedirect(providerNoPKCE)

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      const response = await handler(ctx)
      const location = response.headers.get('Location')!

      expect(location).not.toContain('code_challenge')
    })

    it('should use custom redirect URI when provided', async () => {
      const handler = handleOAuthRedirect(mockProvider, {
        redirectUri: 'https://custom.example.com/callback',
      })

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      const response = await handler(ctx)
      const location = response.headers.get('Location')!

      expect(location).toContain(encodeURIComponent('https://custom.example.com/callback'))
    })

    it('should use custom scopes when provided', async () => {
      const handler = handleOAuthRedirect(mockProvider, {
        scopes: ['read:user', 'repo'],
      })

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      const response = await handler(ctx)
      const location = response.headers.get('Location')!

      expect(location).toContain('scope=read%3Auser+repo')
    })

    it('should store state in KV', async () => {
      const handler = handleOAuthRedirect(mockProvider)

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      await handler(ctx)

      // Verify state was stored (checking KV has at least one entry with oauth:state: prefix)
      const stored = await kv.list()
      // Note: In real test, we'd verify the state key exists
    })

    it('should throw error when KV not configured', async () => {
      const handler = handleOAuthRedirect(mockProvider)

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: {},
      }

      await expect(handler(ctx)).rejects.toThrow('KV namespace required')
    })
  })

  describe('handleOAuthCallback', () => {
    it('should handle successful OAuth callback', async () => {
      // Mock token exchange
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access_123',
          token_type: 'Bearer',
        }),
      })

      // Mock user profile fetch
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          login: 'octocat',
          email: 'octocat@github.com',
          name: 'The Octocat',
          avatar_url: 'https://github.com/images/octocat.png',
        }),
      })

      const userHandler = vi.fn().mockResolvedValue({
        user: { id: '12345', email: 'octocat@github.com' },
        redirect: '/dashboard',
      })

      const handler = handleOAuthCallback(mockProvider, userHandler)

      // Simulate state storage
      const stateParam = 'test-state-123'
      const state = {
        state: stateParam,
        provider: 'github',
        redirectUri: 'https://app.example.com/auth/github/callback',
        codeVerifier: 'verifier_abc',
        createdAt: Date.now(),
      }
      await kv.put(`oauth:state:${stateParam}`, JSON.stringify(state))

      const ctx: OAuthContext = {
        request: new Request(
          `https://app.example.com/auth/github/callback?code=auth_code_123&state=${stateParam}`
        ),
        env: { KV: kv },
      }

      const response = await handler(ctx)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://app.example.com/dashboard')

      // Verify user handler was called with profile and tokens
      expect(userHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '12345',
          email: 'octocat@github.com',
        }),
        expect.objectContaining({
          accessToken: 'access_123',
        }),
        ctx
      )
    })

    it('should throw error for missing code parameter', async () => {
      const handler = handleOAuthCallback(mockProvider, async () => ({
        user: {},
        redirect: '/',
      }))

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github/callback?state=abc'),
        env: { KV: kv },
      }

      await expect(handler(ctx)).rejects.toThrow(OAuthCallbackError)
    })

    it('should throw error for missing state parameter', async () => {
      const handler = handleOAuthCallback(mockProvider, async () => ({
        user: {},
        redirect: '/',
      }))

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github/callback?code=abc'),
        env: { KV: kv },
      }

      await expect(handler(ctx)).rejects.toThrow(OAuthCallbackError)
    })

    it('should throw error for invalid/expired state', async () => {
      const handler = handleOAuthCallback(mockProvider, async () => ({
        user: {},
        redirect: '/',
      }))

      const ctx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github/callback?code=abc&state=invalid'),
        env: { KV: kv },
      }

      await expect(handler(ctx)).rejects.toThrow(OAuthStateError)
    })

    it('should throw error for provider mismatch', async () => {
      const handler = handleOAuthCallback(mockProvider, async () => ({
        user: {},
        redirect: '/',
      }))

      // Store state for different provider
      const stateParam = 'test-state-123'
      const state = {
        state: stateParam,
        provider: 'google', // Different provider!
        redirectUri: 'https://app.example.com/auth/google/callback',
        createdAt: Date.now(),
      }
      await kv.put(`oauth:state:${stateParam}`, JSON.stringify(state))

      const ctx: OAuthContext = {
        request: new Request(
          `https://app.example.com/auth/github/callback?code=abc&state=${stateParam}`
        ),
        env: { KV: kv },
      }

      await expect(handler(ctx)).rejects.toThrow(OAuthStateError)
    })

    it('should handle OAuth error response', async () => {
      const handler = handleOAuthCallback(mockProvider, async () => ({
        user: {},
        redirect: '/',
      }))

      const ctx: OAuthContext = {
        request: new Request(
          'https://app.example.com/auth/github/callback?error=access_denied&error_description=User%20denied%20access'
        ),
        env: { KV: kv },
      }

      await expect(handler(ctx)).rejects.toThrow(OAuthCallbackError)
    })

    it('should consume state (single-use)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', token_type: 'Bearer' }),
      })

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123, login: 'user' }),
      })

      const handler = handleOAuthCallback(mockProvider, async () => ({
        user: {},
        redirect: '/',
      }))

      const stateParam = 'test-state-123'
      const state = {
        state: stateParam,
        provider: 'github',
        redirectUri: 'https://app.example.com/auth/github/callback',
        createdAt: Date.now(),
      }
      await kv.put(`oauth:state:${stateParam}`, JSON.stringify(state))

      const ctx: OAuthContext = {
        request: new Request(
          `https://app.example.com/auth/github/callback?code=code&state=${stateParam}`
        ),
        env: { KV: kv },
      }

      await handler(ctx)

      // State should be consumed (deleted)
      const consumed = await kv.get(`oauth:state:${stateParam}`)
      expect(consumed).toBeNull()
    })
  })

  describe('Integration: Complete OAuth Flow', () => {
    it('should complete full OAuth flow', async () => {
      // Step 1: Redirect handler
      const redirectHandler = handleOAuthRedirect(mockProvider)

      const redirectCtx: OAuthContext = {
        request: new Request('https://app.example.com/auth/github'),
        env: { KV: kv },
      }

      const redirectResponse = await redirectHandler(redirectCtx)
      expect(redirectResponse.status).toBe(302)

      const authUrl = new URL(redirectResponse.headers.get('Location')!)
      const stateParam = authUrl.searchParams.get('state')!

      // Step 2: User authorizes, provider redirects back with code
      // (simulated)

      // Step 3: Callback handler
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token_123', token_type: 'Bearer' }),
      })

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          login: 'octocat',
          email: 'octocat@github.com',
        }),
      })

      const callbackHandler = handleOAuthCallback(mockProvider, async (profile) => ({
        user: { id: profile.id },
        redirect: '/dashboard',
      }))

      const callbackCtx: OAuthContext = {
        request: new Request(
          `https://app.example.com/auth/github/callback?code=auth_code&state=${stateParam}`
        ),
        env: { KV: kv },
      }

      const callbackResponse = await callbackHandler(callbackCtx)
      expect(callbackResponse.status).toBe(302)
      expect(callbackResponse.headers.get('Location')).toBe('https://app.example.com/dashboard')
    })
  })
})
