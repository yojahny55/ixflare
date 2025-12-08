/**
 * @module core/middleware
 * @description Middleware composition for request processing
 *
 * @example
 * ```typescript
 * import { createMiddleware } from 'ixflare'
 *
 * // Simple middleware
 * const logger = createMiddleware(async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.url.pathname}`)
 *   return next()
 * })
 *
 * // Context extension with type safety
 * declare module 'ixflare' {
 *   interface EdgeContext {
 *     user?: { id: string; name: string }
 *   }
 * }
 *
 * const auth = createMiddleware(async (ctx, next) => {
 *   ctx.user = { id: '123', name: 'Jordan' }  // Now type-safe!
 *   return next()
 * })
 *
 * // Response interception
 * const timing = createMiddleware(async (ctx, next) => {
 *   const start = Date.now()
 *   const response = await next()
 *   response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
 *   return response
 * })
 * ```
 */

import type { RouteHandler } from './router'
import type { EdgeContext } from '@/types/context'

/**
 * Middleware function signature
 *
 * @template Env - Environment bindings type
 * @param context - Edge context with request, env, params, etc.
 * @param next - Function to call next middleware or final handler
 * @returns Response or Promise<Response>
 *
 * @example
 * ```typescript
 * const middleware: Middleware = async (ctx, next) => {
 *   // Pre-processing
 *   console.log('Before handler')
 *
 *   const response = await next()
 *
 *   // Post-processing
 *   console.log('After handler')
 *   return response
 * }
 * ```
 */
export type Middleware<Env = unknown> = (
  context: EdgeContext<Env>,
  next: () => Promise<Response>
) => Response | Promise<Response>

/**
 * Create a type-safe middleware function
 *
 * @template Env - Environment bindings type
 * @param fn - Middleware implementation
 * @returns Typed middleware function
 *
 * @example
 * ```typescript
 * const logRequest = createMiddleware(async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.url.pathname}`)
 *   return next()
 * })
 * ```
 */
export function createMiddleware<Env = unknown>(fn: Middleware<Env>): Middleware<Env> {
  return fn
}

/**
 * Helper type for defining middleware with context extensions
 *
 * Use this with module augmentation to add type-safe properties to EdgeContext
 *
 * @template Env - Environment bindings type
 * @template Extensions - Additional context properties
 *
 * @example
 * ```typescript
 * // Declare context extension
 * declare module 'ixflare' {
 *   interface EdgeContext {
 *     user?: User
 *     session?: Session
 *   }
 * }
 *
 * // Middleware automatically gets extended types
 * const auth = createMiddleware(async (ctx, next) => {
 *   ctx.user = await getUserFromToken(ctx.headers.get('Authorization'))
 *   return next()
 * })
 * ```
 */
export type MiddlewareContext<Env = unknown, Extensions = Record<string, unknown>> = EdgeContext<Env> & Extensions

/**
 * Define a middleware with enhanced type inference
 *
 * Alias for createMiddleware for better developer experience
 *
 * @template Env - Environment bindings type
 * @param fn - Middleware implementation
 * @returns Typed middleware function
 *
 * @example
 * ```typescript
 * const logger = defineMiddleware(async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.url.pathname}`)
 *   return next()
 * })
 * ```
 */
export const defineMiddleware = createMiddleware

/**
 * Wrap middleware with error boundary for automatic error handling
 *
 * Catches all errors thrown by middleware and converts them to appropriate HTTP responses.
 * Uses AppError hierarchy for error-to-status mapping.
 *
 * @template Env - Environment bindings type
 * @param middleware - The middleware to wrap
 * @returns Wrapped middleware with error handling
 *
 * @example
 * ```typescript
 * import { withErrorBoundary, createMiddleware } from 'ixflare'
 * import { AuthError } from '@/errors'
 *
 * const auth = withErrorBoundary(
 *   createMiddleware(async (ctx, next) => {
 *     const token = ctx.headers.get('Authorization')
 *     if (!token) {
 *       throw new AuthError('UNAUTHORIZED', 'Missing authorization header')
 *     }
 *     // Error is automatically caught and converted to 401 response
 *     return next()
 *   })
 * )
 * ```
 */
export function withErrorBoundary<Env = unknown>(
  middleware: Middleware<Env>
): Middleware<Env> {
  return async (ctx, next) => {
    try {
      return await middleware(ctx, next)
    } catch (error) {
      // Import AppError dynamically to avoid circular dependencies
      const { AppError } = await import('@/errors')

      if (error instanceof AppError) {
        // Use AppError's toJSON method for consistent error format
        const errorResponse = error.toJSON()
        return Response.json(errorResponse, { status: error.status })
      }

      // Unexpected error - log and return generic 500
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Middleware Error]', error)
      }

      return Response.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          status: 500,
          timestamp: Date.now(),
        }
      }, { status: 500 })
    }
  }
}

export function compose<Env = unknown>(...middlewares: Middleware<Env>[]): (handler: RouteHandler<Env>) => RouteHandler<Env> {
  return (handler: RouteHandler<Env>): RouteHandler<Env> => {
    return async (context: EdgeContext<Env>): Promise<Response> => {
      let index = -1

      const dispatch = async (i: number): Promise<Response> => {
        if (i <= index) {
          throw new Error('next() called multiple times')
        }
        index = i

        const middleware = middlewares[i]
        if (!middleware) {
          return handler(context)
        }

        return middleware(context, () => dispatch(i + 1))
      }

      return dispatch(0)
    }
  }
}
