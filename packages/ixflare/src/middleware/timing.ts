/**
 * @module middleware/timing
 * @description Response time measurement middleware
 *
 * Measures request processing duration and adds it to response headers.
 * Useful for performance monitoring and debugging slow requests.
 *
 * @example
 * ```typescript
 * import { createApp, timing } from 'ixflare'
 *
 * const app = createApp({
 *   middleware: [
 *     timing() // Adds X-Response-Time header
 *   ]
 * })
 * ```
 */

import type { Middleware } from '@/core/middleware'

/**
 * Configuration options for timing middleware
 */
export interface TimingConfig {
  /**
   * Header name for response time
   *
   * @default 'X-Response-Time'
   */
  header?: string
}

/**
 * Timing middleware factory
 *
 * Measures the time taken to process a request and adds it to response headers.
 * Time is measured from when the middleware is called until the response is returned.
 *
 * @param config - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Basic usage (default header: X-Response-Time)
 * const middleware = [
 *   timing()
 * ]
 * // Response will include: X-Response-Time: 45ms
 *
 * // Custom header name
 * const middleware = [
 *   timing({ header: 'X-Processing-Time' })
 * ]
 * // Response will include: X-Processing-Time: 45ms
 *
 * // Combined with other middleware
 * const middleware = [
 *   requestId(),
 *   logging(),
 *   timing() // Should be after logging to exclude logging overhead
 * ]
 * ```
 */
export function timing(config?: TimingConfig): Middleware {
  const headerName = config?.header ?? 'X-Response-Time'

  return async (ctx, next) => {
    const start = Date.now()
    const response = await next()
    const duration = Date.now() - start

    response.headers.set(headerName, `${duration}ms`)
    return response
  }
}
