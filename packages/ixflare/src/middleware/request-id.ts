/**
 * @module middleware/request-id
 * @description Request ID middleware for correlation tracking
 *
 * Adds a unique request ID to each request for distributed tracing and debugging.
 * The ID is:
 * - Generated if not present (using crypto.randomUUID)
 * - Preserved if already present in request header (from upstream service)
 * - Added to context for downstream middleware/handlers
 * - Included in response headers
 *
 * @example
 * ```typescript
 * import { createApp, requestId } from 'ixflare'
 *
 * const app = createApp({
 *   middleware: [
 *     requestId(), // Default config
 *     // or with custom config:
 *     requestId({
 *       header: 'X-Correlation-ID',
 *       generator: () => `req-${Date.now()}`
 *     })
 *   ]
 * })
 * ```
 */

import type { Middleware } from '@/core/middleware'

/**
 * Configuration options for request ID middleware
 */
export interface RequestIdConfig {
  /**
   * Header name for the request ID
   * @default 'X-Request-ID'
   */
  header?: string

  /**
   * Custom ID generator function
   * @default () => crypto.randomUUID()
   */
  generator?: () => string
}

/**
 * Request ID middleware factory
 *
 * Adds a unique identifier to each request for distributed tracing and debugging.
 * The ID can be used for correlating logs, errors, and metrics across services.
 *
 * @param config - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const middleware = [
 *   requestId()
 * ]
 *
 * // Custom header and generator
 * const middleware = [
 *   requestId({
 *     header: 'X-Correlation-ID',
 *     generator: () => `custom-${crypto.randomUUID()}`
 *   })
 * ]
 *
 * // Access in route handler
 * export async function GET(ctx: EdgeContext) {
 *   console.log('Request ID:', ctx.requestId)
 *   return Response.json({ id: ctx.requestId })
 * }
 * ```
 */
export function requestId(config?: RequestIdConfig): Middleware {
  const headerName = config?.header ?? 'X-Request-ID'
  const generate = config?.generator ?? (() => crypto.randomUUID())

  return async (ctx, next) => {
    // Use existing ID from header or generate new one
    const id = ctx.request.headers.get(headerName) ?? generate()

    // Set on context for downstream middleware/handlers
    ctx.requestId = id

    const response = await next()

    // Add to response headers
    response.headers.set(headerName, id)
    return response
  }
}
