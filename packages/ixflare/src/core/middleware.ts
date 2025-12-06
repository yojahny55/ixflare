/**
 * @module core/middleware
 * @description Middleware composition for request processing
 */

import type { RouteHandler } from './router'
import type { EdgeContext } from '@/types/context'

export type Middleware<Env = unknown> = (
  context: EdgeContext<Env>,
  next: () => Promise<Response>
) => Response | Promise<Response>

export function createMiddleware<Env = unknown>(fn: Middleware<Env>): Middleware<Env> {
  return fn
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
