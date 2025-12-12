/**
 * @module auth/oauth/state
 * @description OAuth state parameter management with RFC 9700 compliance
 *
 * Security requirements:
 * - 128-bit entropy (crypto.randomUUID)
 * - Session-bound (prevents CSRF)
 * - Single-use (prevents replay attacks per RFC 9700)
 * - Short-lived (10-minute TTL)
 */

import type { OAuthState } from './types'

const STATE_PREFIX = 'oauth:state:'
const STATE_TTL = 60 * 10 // 10 minutes (RFC 9700: short-lived)

/**
 * Generate cryptographically secure state parameter
 * Uses crypto.randomUUID() for 128-bit entropy
 */
export function generateState(): string {
  return crypto.randomUUID() // 128-bit entropy
}

/**
 * Store OAuth state in KV with expiration
 * @param kv - KV namespace for state storage
 * @param state - OAuth state object to store
 */
export async function storeState(kv: KVNamespace, state: OAuthState): Promise<void> {
  await kv.put(`${STATE_PREFIX}${state.state}`, JSON.stringify(state), {
    expirationTtl: STATE_TTL,
  })
}

/**
 * Consume OAuth state - retrieve and delete (single-use per RFC 9700)
 * @param kv - KV namespace for state storage
 * @param stateParam - State parameter from OAuth callback
 * @returns OAuth state or null if not found/expired
 */
export async function consumeState(
  kv: KVNamespace,
  stateParam: string
): Promise<OAuthState | null> {
  const key = `${STATE_PREFIX}${stateParam}`
  const data = await kv.get(key)
  if (!data) return null

  // CRITICAL: Delete immediately (single-use per RFC 9700)
  await kv.delete(key)

  return JSON.parse(data) as OAuthState
}

/**
 * Create OAuth state object with metadata
 * @param provider - OAuth provider ID
 * @param redirectUri - Callback redirect URI
 * @param options - Optional metadata (sessionId, codeVerifier for PKCE)
 */
export function createOAuthState(
  provider: string,
  redirectUri: string,
  options?: { sessionId?: string; codeVerifier?: string }
): OAuthState {
  return {
    state: generateState(),
    provider,
    redirectUri,
    sessionId: options?.sessionId,
    codeVerifier: options?.codeVerifier,
    createdAt: Date.now(),
  }
}
