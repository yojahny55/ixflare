/**
 * Type Definitions
 * Central type exports for the application
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
 * Generic API error response
 */
export interface ApiError {
  error: {
    code: string
    message: string
    status: number
    rayId?: string
    timestamp: number
    details?: unknown
  }
}

/**
 * Async state discriminated union
 */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Common HTTP method type
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

/**
 * Route handler function type
 */
export type RouteHandler = (ctx: RouteContext) => Promise<Response>

/**
 * Middleware function type
 */
export type Middleware = (ctx: RouteContext, next: () => Promise<Response>) => Promise<Response>
