/**
 * @module middleware/logging
 * @description Request/response logging middleware
 *
 * Logs HTTP requests and responses with method, path, status, and duration.
 * Supports custom logger functions and path exclusion.
 *
 * @example
 * ```typescript
 * import { createApp, logging, requestId } from 'ixflare'
 *
 * const app = createApp({
 *   middleware: [
 *     requestId(), // Add before logging to include request ID
 *     logging({
 *       excludePaths: ['/health', '/metrics']
 *     })
 *   ]
 * })
 * ```
 */

import type { Middleware } from '@/core/middleware'

/**
 * Configuration options for logging middleware
 */
export interface LoggingConfig {
  /**
   * Custom logger function
   *
   * @default console.log
   *
   * @example
   * ```typescript
   * logging({
   *   logger: (message, data) => {
   *     // Send to external logging service
   *     sendToDatadog({ message, ...data })
   *   }
   * })
   * ```
   */
  logger?: (message: string, data?: Record<string, unknown>) => void

  /**
   * Include request/response headers in logs
   *
   * @default false
   */
  includeHeaders?: boolean

  /**
   * Paths to exclude from logging (exact match)
   *
   * @default []
   *
   * @example
   * ```typescript
   * logging({
   *   excludePaths: ['/health', '/metrics', '/favicon.ico']
   * })
   * ```
   */
  excludePaths?: string[]
}

/**
 * Logging middleware factory
 *
 * Logs all HTTP requests and responses with method, path, status, and duration.
 * Integrates with requestId middleware to include correlation IDs.
 *
 * @param config - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Basic usage
 * const middleware = [
 *   requestId(),
 *   logging()
 * ]
 * // Logs:
 * // --> GET /api/users
 * // <-- GET /api/users 200 45ms
 *
 * // With custom logger (production)
 * const middleware = [
 *   requestId(),
 *   logging({
 *     logger: (message, data) => {
 *       console.log(JSON.stringify({
 *         level: 'info',
 *         message,
 *         ...data
 *       }))
 *     }
 *   })
 * ]
 * // Logs structured JSON:
 * // {"level":"info","message":"<-- GET /api/users 200 45ms","method":"GET","path":"/api/users","requestId":"...","status":200,"duration":45,"timestamp":1733311800000}
 *
 * // Exclude health checks
 * const middleware = [
 *   logging({
 *     excludePaths: ['/health', '/metrics']
 *   })
 * ]
 * ```
 */
export function logging(config?: LoggingConfig): Middleware {
  const log = config?.logger ?? console.log
  const excludePaths = config?.excludePaths ?? []

  return async (ctx, next) => {
    const { method, url } = ctx
    const pathname = url.pathname

    // Skip excluded paths
    if (excludePaths.includes(pathname)) {
      return next()
    }

    const startTime = Date.now()

    log(`--> ${method} ${pathname}`, {
      requestId: ctx.requestId,
      timestamp: startTime,
    })

    const response = await next()
    const duration = Date.now() - startTime

    log(`<-- ${method} ${pathname} ${response.status} ${duration}ms`, {
      requestId: ctx.requestId,
      status: response.status,
      duration,
      timestamp: Date.now(),
    })

    return response
  }
}
