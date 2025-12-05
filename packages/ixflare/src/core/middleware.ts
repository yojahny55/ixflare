/**
 * @module core/middleware
 * @description Middleware composition for request processing
 */

import type { RouteContext, RouteHandler } from './router'

export type Middleware = (
  context: RouteContext,
  next: () => Promise<Response>
) => Response | Promise<Response>

export function createMiddleware(fn: Middleware): Middleware {
  return fn
}

export function compose(...middlewares: Middleware[]): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler): RouteHandler => {
    return async (context: RouteContext): Promise<Response> => {
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
