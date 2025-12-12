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
 * Validate state parameter format (UUID v4)
 * Prevents timing-based enumeration attacks by validating format before KV lookup
 */
const STATE_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Consume OAuth state - retrieve and delete (single-use per RFC 9700)
 * @param kv - KV namespace for state storage
 * @param stateParam - State parameter from OAuth callback
 * @returns OAuth state or null if not found/expired/invalid format
 */
export async function consumeState(
  kv: KVNamespace,
  stateParam: string
): Promise<OAuthState | null> {
  // Validate state format before KV lookup to prevent timing-based enumeration attacks
  if (!STATE_FORMAT_REGEX.test(stateParam)) {
    return null
  }

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
