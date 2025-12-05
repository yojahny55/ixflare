/**
 * Type Definitions
 * Central type exports for the minimal application
 */

/**
 * Route handler context
 */
export interface RouteContext {
  request: Request
  env: Env
  ctx: ExecutionContext
  params: Record<string, string>
}

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // Database binding
  DB?: D1Database
  // KV cache binding
  CACHE?: KVNamespace
  // Environment variables
  ENVIRONMENT?: string
}

/**
 * Route handler function type
 */
export type RouteHandler = (ctx: RouteContext) => Promise<Response>
