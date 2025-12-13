/**
 * @module auth/rbac/session-integration
 * @description Integration between RBAC and session management
 * Story 5-4: Authorization with RBAC + Policies
 */

import type { Middleware } from '@/core/middleware'
import type { SessionData } from '@/auth/session/types'
import type { User } from './types'

/**
 * Extract user with roles from session data
 *
 * Handles both single role (from SessionData.role) and multiple roles
 * Future sessions may include roles array directly
 *
 * @param session - Session data from session manager
 * @returns User object with roles array
 *
 * @example
 * ```typescript
 * const session = await sessionManager.get(request)
 * const user = extractUserFromSession(session)
 * // user = { id: '123', roles: ['admin'] }
 * ```
 */
export function extractUserFromSession(session: SessionData): User {
  // Support both singular role (current) and future roles array
  const roles = Array.isArray((session as any).roles)
    ? (session as any).roles
    : session.role
      ? [session.role]
      : []

  return {
    id: session.userId,
    roles,
    // Include other session data for policy checks
    ...session,
  }
}

/**
 * Middleware to inject user from session into context
 *
 * This middleware should be placed AFTER session middleware in the chain
 * It extracts the user from session and makes it available to downstream
 * middleware and route handlers
 *
 * @param sessionKey - Key where session is stored in context (default: 'session')
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Global middleware setup
 * import { sessionMiddleware } from 'ixflare/session'
 * import { injectUser } from 'ixflare/auth'
 *
 * export const middleware = [
 *   sessionMiddleware({ strategy: 'jwt', ... }),
 *   injectUser(),
 * ]
 * ```
 *
 * @example
 * ```typescript
 * // Route-level usage
 * import { requireRole } from 'ixflare/auth'
 *
 * export const middleware = [
 *   injectUser(),
 *   requireRole('admin'),
 * ]
 *
 * export const GET: RouteHandler = async (ctx) => {
 *   const user = ctx.user  // Available here
 *   return Response.json(user)
 * }
 * ```
 */
export function injectUser(sessionKey: string = 'session'): Middleware {
  return async (ctx, next) => {
    // Get session from context (set by session middleware)
    const session = (ctx as any)[sessionKey] as SessionData | undefined

    if (session) {
      // Extract user with roles from session
      const user = extractUserFromSession(session)

      // Inject user into context for downstream middleware
      ;(ctx as any).user = user
    }

    return next()
  }
}

/**
 * Declare module augmentation for EdgeContext
 * This makes user and session properties available with type safety
 */
declare module 'ixflare' {
  interface EdgeContext {
    /** User object with roles (injected by injectUser middleware) */
    user?: User
    /** Session data (injected by session middleware) */
    session?: SessionData
  }
}
