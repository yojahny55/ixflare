/**
 * @module core/router
 * @description File-based router for Cloudflare Workers with URLPattern-based param extraction
 * @worker-only
 */

import { extractParamsFromUrl, parseCatchAllParam } from './params'

export interface Route {
  path: string
  handler: RouteHandler
  hasCatchAll?: boolean
}

export type RouteHandler = (context: RouteContext) => Response | Promise<Response>

export interface RouteContext {
  request: Request
  params: Record<string, string | string[]>
  env: unknown
}

export class Router {
  private routes: Route[] = []

  add(path: string, handler: RouteHandler, hasCatchAll = false): this {
    this.routes.push({ path, handler, hasCatchAll })
    return this
  }

  async handle(request: Request, env: unknown): Promise<Response> {
    const url = new URL(request.url)

    for (const route of this.routes) {
      const params = this.matchRoute(route.path, url.pathname, route.hasCatchAll)
      if (params !== null) {
        return route.handler({ request, params, env })
      }
    }

    return new Response('Not Found', { status: 404 })
  }

  private matchRoute(
    pattern: string,
    pathname: string,
    hasCatchAll = false
  ): Record<string, string | string[]> | null {
    // Use URLPattern-based extraction for better pattern matching
    const params = extractParamsFromUrl(pattern, pathname)

    if (params === null) {
      return null
    }

    // Handle catch-all routes - convert catch-all string to array
    if (hasCatchAll && params['0']) {
      // URLPattern stores catch-all in group '0'
      const catchAllPath = params['0']
      const parsedPath = parseCatchAllParam(catchAllPath)
      // Create new object with correct type
      return { ...params, '0': parsedPath }
    }

    return params
  }
}

export function createRouter(): Router {
  return new Router()
}
