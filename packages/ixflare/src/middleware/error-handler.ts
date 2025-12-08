/**
 * @module middleware/error-handler
 * @description Global error handling middleware
 *
 * Catches all errors thrown by downstream middleware and handlers,
 * converting them to properly formatted HTTP responses. Handles both
 * AppError subclasses and unexpected errors with appropriate status codes
 * and sanitized messages.
 *
 * @example
 * ```typescript
 * import { createApp, errorHandler, requestId } from 'ixflare'
 *
 * const app = createApp({
 *   middleware: [
 *     errorHandler(), // FIRST - catches all errors
 *     requestId(),
 *     // ... other middleware
 *   ]
 * })
 * ```
 */

import type { Middleware } from '@/core/middleware'
import { AppError } from '@/errors'
import type { EdgeContext } from '@/types'

/**
 * Configuration options for error handler middleware
 */
export interface ErrorHandlerConfig {
  /**
   * Whether to include stack traces in error responses
   *
   * @default false
   *
   * @example
   * ```typescript
   * errorHandler({
   *   includeStackTrace: process.env.NODE_ENV === 'development'
   * })
   * ```
   */
  includeStackTrace?: boolean

  /**
   * Custom error transformer
   *
   * If provided and returns a Response, that response is used.
   * If returns void, default error handling continues.
   *
   * @param error - The caught error
   * @param ctx - Edge context
   * @returns Custom response or void to use default handling
   *
   * @example
   * ```typescript
   * errorHandler({
   *   onError: (error, ctx) => {
   *     // Send to monitoring service
   *     sendToSentry(error, { requestId: ctx.requestId })
   *
   *     // Custom response for specific errors
   *     if (error.message.includes('database')) {
   *       return Response.json({
   *         error: {
   *           code: 'DB_ERROR',
   *           message: 'Database temporarily unavailable'
   *         }
   *       }, { status: 503 })
   *     }
   *   }
   * })
   * ```
   */
  onError?: (error: Error, ctx: EdgeContext<any>) => Response | void

  /**
   * Logger function for errors
   *
   * @default console.error
   *
   * @example
   * ```typescript
   * errorHandler({
   *   logger: (error, ctx) => {
   *     console.error(JSON.stringify({
   *       level: 'error',
   *       requestId: ctx.requestId,
   *       error: error.message,
   *       stack: error.stack
   *     }))
   *   }
   * })
   * ```
   */
  logger?: (error: Error, ctx: EdgeContext<any>) => void

  /**
   * Header name for request ID in error responses
   *
   * Should match the header configured in requestId() middleware.
   *
   * @default 'X-Request-ID'
   *
   * @example
   * ```typescript
   * // If using custom header in requestId middleware:
   * const middleware = [
   *   errorHandler({ requestIdHeader: 'X-Correlation-ID' }),
   *   requestId({ header: 'X-Correlation-ID' }),
   * ]
   * ```
   */
  requestIdHeader?: string
}

/**
 * Error handler middleware factory
 *
 * Catches all errors from downstream middleware and handlers, converting them
 * to properly formatted HTTP error responses. Should be the FIRST middleware
 * in the chain to catch all errors.
 *
 * Error Response Format:
 * - AppError subclasses → appropriate status code with error details
 * - Unexpected errors → 500 with sanitized message
 * - Stack traces only included when configured (never in production)
 *
 * @param config - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Basic usage (FIRST in middleware chain)
 * const middleware = [
 *   errorHandler(),
 *   requestId(),
 *   logging()
 * ]
 *
 * // Development mode with stack traces
 * const middleware = [
 *   errorHandler({
 *     includeStackTrace: true
 *   })
 * ]
 *
 * // Production with custom error monitoring
 * const middleware = [
 *   errorHandler({
 *     logger: (error, ctx) => {
 *       sendToDatadog({
 *         error: error.message,
 *         stack: error.stack,
 *         requestId: ctx.requestId,
 *         path: ctx.url.pathname
 *       })
 *     }
 *   })
 * ]
 *
 * // With custom error transformations
 * const middleware = [
 *   errorHandler({
 *     onError: (error, ctx) => {
 *       if (error instanceof DatabaseError) {
 *         return Response.json({
 *           error: {
 *             code: 'SERVICE_UNAVAILABLE',
 *             message: 'Database temporarily unavailable',
 *             status: 503
 *           }
 *         }, { status: 503 })
 *       }
 *     }
 *   })
 * ]
 * ```
 */
export function errorHandler<Env = unknown>(config?: ErrorHandlerConfig): Middleware<Env> {
  const includeStack = config?.includeStackTrace ?? false
  const requestIdHeader = config?.requestIdHeader ?? 'X-Request-ID'
  const log =
    config?.logger ??
    ((error: Error, ctx: EdgeContext<Env>) => {
      console.error(`[Error] ${ctx.requestId ?? 'no-id'}:`, error)
    })

  return async (ctx, next) => {
    try {
      return await next()
    } catch (error) {
      // Custom handler can return a response
      if (config?.onError) {
        const customResponse = config.onError(error as Error, ctx)
        if (customResponse) return customResponse
      }

      // Log the error
      log(error as Error, ctx)

      // Handle AppError and subclasses
      if (error instanceof AppError) {
        const response = Response.json(
          {
            error: {
              code: error.code,
              message: error.message,
              status: error.status,
              timestamp: Date.now(),
              ...(ctx.requestId && { rayId: ctx.requestId }),
            },
          },
          { status: error.status }
        )

        // Add request ID header if available
        if (ctx.requestId) {
          response.headers.set(requestIdHeader, ctx.requestId)
        }

        return response
      }

      // Unexpected error - sanitize for production
      const response = Response.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            status: 500,
            timestamp: Date.now(),
            ...(ctx.requestId && { rayId: ctx.requestId }),
            ...(includeStack &&
              error instanceof Error && {
                stack: error.stack,
              }),
          },
        },
        { status: 500 }
      )

      // Add request ID header if available
      if (ctx.requestId) {
        response.headers.set(requestIdHeader, ctx.requestId)
      }

      return response
    }
  }
}
