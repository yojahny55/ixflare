/**
 * @fileoverview Edge context types for route handlers
 * @worker-only
 */

/**
 * EdgeContext provides all request information and execution context for route handlers
 *
 * @template Env - Type of environment bindings (D1, KV, R2, DO, etc.)
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
