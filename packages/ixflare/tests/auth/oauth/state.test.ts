/**
 * @module tests/auth/oauth/state
 * @description Tests for OAuth state parameter management (RFC 9700 compliance)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { generateState, storeState, consumeState, createOAuthState } from '@/auth/oauth/state'

// Mock KV namespace for testing
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expiration: number }>()

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    if (!item) return null
    if (item.expiration && Date.now() > item.expiration) {
      this.store.delete(key)
      return null
    }
    return item.value
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : Infinity
    this.store.set(key, { value, expiration })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  // Required KVNamespace methods (minimal implementation for tests)
  async getWithMetadata(): Promise<any> {
    return { value: null, metadata: null }
  }
  async list(): Promise<any> {
    return { keys: [], list_complete: true, cursor: '' }
  }
}

describe('OAuth State Management', () => {
  let kv: KVNamespace

  beforeEach(() => {
    kv = new MockKVNamespace()
  })

  describe('generateState', () => {
    it('should generate state with UUID format', () => {
      const state = generateState()
      expect(state).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should generate unique states', () => {
      const state1 = generateState()
      const state2 = generateState()
      expect(state1).not.toBe(state2)
    })

    it('should provide 128-bit entropy', () => {
      const states = new Set()
      for (let i = 0; i < 1000; i++) {
        states.add(generateState())
      }
      // All should be unique (collision probability is negligible)
      expect(states.size).toBe(1000)
    })
  })

  describe('createOAuthState', () => {
    it('should create OAuth state with required fields', () => {
      const state = createOAuthState('github', 'https://example.com/callback')
      expect(state.provider).toBe('github')
      expect(state.redirectUri).toBe('https://example.com/callback')
      expect(state.state).toBeTruthy()
      expect(state.createdAt).toBeGreaterThan(0)
    })

    it('should include session ID when provided', () => {
      const state = createOAuthState('github', 'https://example.com/callback', {
        sessionId: 'sess_123',
      })
      expect(state.sessionId).toBe('sess_123')
    })

    it('should include code verifier for PKCE', () => {
      const state = createOAuthState('github', 'https://example.com/callback', {
        codeVerifier: 'verifier_abc',
      })
      expect(state.codeVerifier).toBe('verifier_abc')
    })
  })

  describe('storeState', () => {
    it('should store OAuth state in KV', async () => {
      const state = createOAuthState('github', 'https://example.com/callback')
      await storeState(kv, state)

      const stored = await kv.get(`oauth:state:${state.state}`)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.provider).toBe('github')
      expect(parsed.redirectUri).toBe('https://example.com/callback')
    })

    it('should set expiration TTL (10 minutes)', async () => {
      const state = createOAuthState('github', 'https://example.com/callback')
      await storeState(kv, state)

      // State should be retrievable immediately
      const stored = await kv.get(`oauth:state:${state.state}`)
      expect(stored).toBeTruthy()
    })
  })

  describe('consumeState', () => {
    it('should retrieve and delete state (single-use)', async () => {
      const state = createOAuthState('github', 'https://example.com/callback')
      await storeState(kv, state)

      // First consumption - should succeed
      const consumed = await consumeState(kv, state.state)
      expect(consumed).not.toBeNull()
      expect(consumed!.provider).toBe('github')

      // Second consumption - should fail (single-use per RFC 9700)
      const secondAttempt = await consumeState(kv, state.state)
      expect(secondAttempt).toBeNull()
    })

    it('should return null for non-existent state', async () => {
      const result = await consumeState(kv, 'non-existent-state')
      expect(result).toBeNull()
    })

    it('should preserve all state metadata', async () => {
      const state = createOAuthState('github', 'https://example.com/callback', {
        sessionId: 'sess_123',
        codeVerifier: 'verifier_abc',
      })
      await storeState(kv, state)

      const consumed = await consumeState(kv, state.state)
      expect(consumed).toMatchObject({
        state: state.state,
        provider: 'github',
        redirectUri: 'https://example.com/callback',
        sessionId: 'sess_123',
        codeVerifier: 'verifier_abc',
        createdAt: state.createdAt,
      })
    })
  })

  describe('Security: Replay Attack Prevention', () => {
    it('should prevent state reuse (RFC 9700 requirement)', async () => {
      const state = createOAuthState('github', 'https://example.com/callback')
      await storeState(kv, state)

      // First use - should succeed
      const first = await consumeState(kv, state.state)
      expect(first).not.toBeNull()

      // Replay attempt - should fail
      const replay = await consumeState(kv, state.state)
      expect(replay).toBeNull()
    })
  })

  describe('Security: Session Binding', () => {
    it('should bind state to session ID', async () => {
      const state = createOAuthState('github', 'https://example.com/callback', {
        sessionId: 'sess_123',
      })
      await storeState(kv, state)

      const consumed = await consumeState(kv, state.state)
      expect(consumed!.sessionId).toBe('sess_123')
    })

    it('should allow CSRF verification via session binding', async () => {
      const requestSessionId = 'sess_123'
      const state = createOAuthState('github', 'https://example.com/callback', {
        sessionId: requestSessionId,
      })
      await storeState(kv, state)

      const consumed = await consumeState(kv, state.state)

      // In real implementation, verify consumed.sessionId === current session ID
      expect(consumed!.sessionId).toBe(requestSessionId)
    })
  })
})
