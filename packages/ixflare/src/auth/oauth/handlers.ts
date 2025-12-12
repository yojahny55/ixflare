/**
 * @module auth/oauth/handlers
 * @description OAuth route handler helpers for authorization and callback flows
 *
 * Usage:
 * ```typescript
 * // GET /auth/github
 * export const GET = handleOAuthRedirect('github', options)
 *
 * // GET /auth/github/callback
 * export const GET = handleOAuthCallback('github', async (profile, tokens) => {
 *   // Handle authentication
 *   return { user, redirect: '/dashboard' }
 * })
 * ```
 */

import type { OAuthProviderConfig, OAuthProfile, OAuthTokens } from './types'
import { createOAuthState, storeState, consumeState } from './state'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { buildAuthorizationUrl, exchangeCode, fetchUserProfile } from './flow'
import { validateRedirectUri } from './validation'
import { OAuthStateError, OAuthCallbackError, OAuthError } from './errors'
import { getProfileNormalizer } from './providers'

/**
 * OAuth handler context provided to route handlers
 */
export interface OAuthContext {
  request: Request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: Record<string, any>
  kv?: KVNamespace
}

/**
 * OAuth redirect handler options
 */
export interface OAuthRedirectOptions {
  scopes?: string[]
  redirectUri?: string
}

/**
 * OAuth callback handler result
 */
export interface OAuthCallbackResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: Record<string, any>
  redirect: string
}

/**
 * Create OAuth redirect handler (GET /auth/{provider})
 * Initiates OAuth flow by redirecting to provider's authorization page
 *
 * @param provider - Provider configuration
 * @param options - Redirect options
 */
export function handleOAuthRedirect(
  provider: OAuthProviderConfig,
  options: OAuthRedirectOptions = {}
) {
  return async (ctx: OAuthContext): Promise<Response> => {
    const kv = ctx.env.KV || ctx.kv
    if (!kv) {
      throw new OAuthError(
        'KV_NOT_CONFIGURED',
        'KV namespace required for OAuth state storage',
        provider.id
      )
    }

    // Determine redirect URI
    const redirectUri = options.redirectUri || buildDefaultRedirectUri(ctx.request, provider.id)

    // Validate redirect URI if configured
    if (provider.redirectUri) {
      validateRedirectUri(redirectUri, [provider.redirectUri], provider.id)
    }

    // Generate PKCE parameters if enabled
    let codeChallenge: string | undefined
    let codeVerifier: string | undefined
    if (provider.pkce) {
      codeVerifier = generateCodeVerifier()
      codeChallenge = await generateCodeChallenge(codeVerifier)
    }

    // Create and store OAuth state
    const state = createOAuthState(provider.id, redirectUri, {
      codeVerifier,
      // Could add sessionId here for session binding if session is available
    })
    await storeState(kv, state)

    // Build authorization URL
    const scopes = options.scopes || provider.scopes
    const authUrl = buildAuthorizationUrl(
      { ...provider, scopes },
      {
        state: state.state,
        redirectUri,
        codeChallenge,
      }
    )

    // Redirect to authorization page
    return Response.redirect(authUrl, 302)
  }
}

/**
 * OAuth callback handler type
 */
export type OAuthCallbackHandler = (
  profile: OAuthProfile,
  tokens: OAuthTokens,
  ctx: OAuthContext
) => Promise<OAuthCallbackResult>

/**
 * Create OAuth callback handler (GET /auth/{provider}/callback)
 * Handles OAuth callback, exchanges code for tokens, and calls user handler
 *
 * @param provider - Provider configuration
 * @param handler - User callback handler
 */
export function handleOAuthCallback(provider: OAuthProviderConfig, handler: OAuthCallbackHandler) {
  return async (ctx: OAuthContext): Promise<Response> => {
    const kv = ctx.env.KV || ctx.kv
    if (!kv) {
      throw new OAuthError(
        'KV_NOT_CONFIGURED',
        'KV namespace required for OAuth state storage',
        provider.id
      )
    }

    const url = new URL(ctx.request.url)

    // Check for OAuth errors
    const error = url.searchParams.get('error')
    if (error) {
      throw new OAuthCallbackError(provider.id, error)
    }

    // Extract callback parameters
    const code = url.searchParams.get('code')
    const stateParam = url.searchParams.get('state')

    if (!code || !stateParam) {
      throw new OAuthCallbackError(provider.id, 'invalid_request')
    }

    // Consume and validate state (single-use, CSRF protection)
    const state = await consumeState(kv, stateParam)
    if (!state) {
      throw new OAuthStateError(provider.id)
    }

    // Verify state matches provider
    if (state.provider !== provider.id) {
      throw new OAuthStateError(provider.id)
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCode(provider, code, state.redirectUri, state.codeVerifier)

    // Fetch user profile
    const rawProfile = await fetchUserProfile(provider, tokens.accessToken)

    // Normalize profile using provider-specific normalizer
    const normalizer = getProfileNormalizer(provider.id)
    const profile = normalizer ? normalizer(rawProfile) : createDefaultProfile(rawProfile)

    // Call user handler
    const result = await handler(profile, tokens, ctx)

    // Redirect to user-specified URL (convert relative to absolute if needed)
    const redirectUrl = result.redirect.startsWith('/')
      ? new URL(result.redirect, ctx.request.url).toString()
      : result.redirect

    return Response.redirect(redirectUrl, 302)
  }
}

/**
 * Build default redirect URI from request
 */
function buildDefaultRedirectUri(request: Request, providerId: string): string {
  const url = new URL(request.url)
  return `${url.origin}/auth/${providerId}/callback`
}

/**
 * Create default profile when no normalizer available
 */
function createDefaultProfile(raw: Record<string, unknown>): OAuthProfile {
  return {
    id: String(raw.id || raw.sub || raw.user_id),
    email: raw.email as string | undefined,
    name: (raw.name || raw.username || raw.login) as string | undefined,
    avatar: (raw.avatar || raw.avatar_url || raw.picture) as string | undefined,
    raw,
  }
}
