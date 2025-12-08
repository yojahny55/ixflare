/**
 * @fileoverview Edge context types for route handlers
 * @worker-only
 *
 * @example Module Augmentation for Type-Safe Context Extensions
 * ```typescript
 * // In your middleware file or types file:
 * import type { User, Session } from '@/types'
 *
 * declare module 'ixflare' {
 *   interface EdgeContext {
 *     user?: User
 *     session?: Session
 *     customData?: Record<string, unknown>
 *   }
 * }
 *
 * // Now middleware can safely extend context:
 * const auth = createMiddleware(async (ctx, next) => {
 *   ctx.user = await authenticateUser(ctx)  // Type-safe!
 *   return next()
 * })
 *
 * // And handlers get the extended types automatically:
 * export async function GET(ctx: EdgeContext) {
 *   const user = ctx.user  // TypeScript knows about this property
 *   return Response.json(user)
 * }
 * ```
 */

/**
 * EdgeContext provides all request information and execution context for route handlers
 *
 * @template Env - Type of environment bindings (D1, KV, R2, DO, etc.)
 *
 * @remarks
 * You can extend EdgeContext with additional properties using module augmentation.
 * See the module-level JSDoc example for details.
 */
export interface EdgeContext<Env = Record<string, unknown>> {
  /** The incoming Request object */
  request: Request

  /** Environment bindings (D1, KV, R2, DO, etc.) */
  env: Env

  /** Execution context for async operations */
  ctx: ExecutionContext

  /** Dynamic route parameters (e.g., /users/:id) */
  params: Record<string, string>

  /** Parsed URL search parameters */
  query: URLSearchParams

  /** Parsed URL object */
  url: URL

  /** HTTP method (GET, POST, etc.) */
  method: string

  /** Request headers */
  headers: Headers

  /** Data from page loader (if loader was executed) */
  loaderData?: unknown

  /**
   * Unique request ID for correlation tracking
   *
   * Set by requestId() middleware
   *
   * @see {@link requestId} middleware
   */
  requestId?: string
}

/**
 * Create an EdgeContext from a Request
 *
 * @param request - The incoming request
 * @param env - Environment bindings
 * @param ctx - Execution context
 * @param params - Route parameters
 * @returns EdgeContext instance
 */
export function createEdgeContext<Env = Record<string, unknown>>(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params: Record<string, string> = {}
): EdgeContext<Env> {
  const url = new URL(request.url)
  const query = new URLSearchParams(url.search)

  return {
    request,
    env,
    ctx,
    params,
    query,
    url,
    method: request.method,
    headers: request.headers,
  }
}
