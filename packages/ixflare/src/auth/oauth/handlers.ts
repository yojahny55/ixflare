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
 *
 * Session Binding (CSRF Protection per RFC 9700):
 * The OAuth state is automatically bound to the current session (if configured).
 * This prevents login CSRF attacks where an attacker initiates OAuth with their
 * account and tricks a victim into completing the flow.
 */

import type { OAuthProviderConfig, OAuthProfile, OAuthTokens } from './types'
import { createOAuthState, storeState, consumeState } from './state'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { buildAuthorizationUrl, exchangeCode, fetchUserProfile } from './flow'
import { validateRedirectUri } from './validation'
import { OAuthStateError, OAuthCallbackError, OAuthError } from './errors'
import { getProfileNormalizer } from './providers'
import { session } from '@/auth/session'

/**
 * OAuth handler context provided to route handlers
 * @template Env - Environment bindings type
 */
export interface OAuthContext<Env extends Record<string, unknown> = Record<string, unknown>> {
  request: Request
  env: Env
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
  user: Record<string, unknown>
  redirect: string
  /**
   * Response with session cookie (from session.regenerateFromRequest)
   * SECURITY: Required for session fixation prevention per Epic 5 requirements
   * If not provided, handler will redirect without session - caller must handle session separately
   */
  sessionResponse?: Response
}

/**
 * Create OAuth redirect handler (GET /auth/{provider})
 * Initiates OAuth flow by redirecting to provider's authorization page
 *
 * @param provider - Provider configuration
 * @param options - Redirect options
 * @template Env - Environment bindings type
 */
export function handleOAuthRedirect<Env extends Record<string, unknown> = Record<string, unknown>>(
  provider: OAuthProviderConfig,
  options: OAuthRedirectOptions = {}
) {
  return async (ctx: OAuthContext<Env>): Promise<Response> => {
    const kv = ((ctx.env as Record<string, unknown>).KV as KVNamespace | undefined) || ctx.kv
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

    // Extract current session ID for session binding (CSRF protection per RFC 9700)
    // If session manager is configured and user has a session, bind state to it
    const sessionId = await getSessionIdFromRequest(ctx.request)

    // Create and store OAuth state with session binding
    const state = createOAuthState(provider.id, redirectUri, {
      codeVerifier,
      sessionId, // Session-bound state prevents login CSRF
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
 *
 * SECURITY: Your handler MUST call session.regenerateFromRequest() after successful OAuth
 * and pass the response as sessionResponse to prevent session fixation attacks.
 *
 * @example
 * ```typescript
 * export const GET = handleOAuthCallback(githubProvider, async (profile, tokens, ctx) => {
 *   let user = await User.where({ githubId: profile.id }).first()
 *   if (!user) {
 *     user = await User.create({ email: profile.email, githubId: profile.id })
 *   }
 *
 *   // REQUIRED: Regenerate session to prevent session fixation
 *   const sessionResponse = await session.regenerateFromRequest(ctx.request, {
 *     userId: user.id,
 *     provider: 'github',
 *   })
 *
 *   return { user, redirect: '/dashboard', sessionResponse }
 * })
 * ```
 */
export type OAuthCallbackHandler<Env extends Record<string, unknown> = Record<string, unknown>> = (
  profile: OAuthProfile,
  tokens: OAuthTokens,
  ctx: OAuthContext<Env>
) => Promise<OAuthCallbackResult>

/**
 * Create OAuth callback handler (GET /auth/{provider}/callback)
 * Handles OAuth callback, exchanges code for tokens, and calls user handler
 *
 * SECURITY: Your handler MUST call session.regenerateFromRequest() and return
 * the sessionResponse to prevent session fixation attacks.
 *
 * @param provider - Provider configuration
 * @param handler - User callback handler
 * @template Env - Environment bindings type
 */
export function handleOAuthCallback<Env extends Record<string, unknown> = Record<string, unknown>>(
  provider: OAuthProviderConfig,
  handler: OAuthCallbackHandler<Env>
) {
  return async (ctx: OAuthContext<Env>): Promise<Response> => {
    const kv = ((ctx.env as Record<string, unknown>).KV as KVNamespace | undefined) || ctx.kv
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

    // Verify session binding (CSRF protection per RFC 9700)
    // If state was bound to a session, verify the current session matches
    if (state.sessionId) {
      const currentSessionId = await getSessionIdFromRequest(ctx.request)
      if (currentSessionId !== state.sessionId) {
        // Session mismatch - possible login CSRF attack
        throw new OAuthError(
          'OAUTH_SESSION_MISMATCH',
          'OAuth state session binding mismatch - possible CSRF attack',
          provider.id
        )
      }
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

    // SECURITY: Session fixation prevention (Epic 5 requirement)
    // If sessionResponse is provided (from session.regenerateFromRequest),
    // copy session cookies to redirect response
    if (result.sessionResponse) {
      const sessionCookie = result.sessionResponse.headers.get('Set-Cookie')
      if (sessionCookie) {
        // Create new response with session cookie
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectUrl,
            'Set-Cookie': sessionCookie,
          },
        })
      }
    }

    // WARNING: Redirecting without session regeneration
    // Caller should use session.regenerateFromRequest() in their handler
    // to prevent session fixation attacks
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

/**
 * Extract current session ID from request (for session binding)
 * Returns undefined if session manager is not configured or no valid session exists
 *
 * @param request - Request with potential session cookie
 * @returns Session ID or undefined
 */
async function getSessionIdFromRequest(request: Request): Promise<string | undefined> {
  try {
    // Attempt to get current session from session manager
    const currentSession = await session.get(request)
    return currentSession?.sessionId
  } catch {
    // Session manager not configured or other error - no session binding
    // This is expected if the user hasn't called session.configure()
    return undefined
  }
}
