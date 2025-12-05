/**
 * @module core/router
 * @description File-based router for Cloudflare Workers
 */

export interface Route {
  path: string
  handler: RouteHandler
}

export type RouteHandler = (context: RouteContext) => Response | Promise<Response>

export interface RouteContext {
  request: Request
  params: Record<string, string>
  env: unknown
}

export class Router {
  private routes: Route[] = []

  add(path: string, handler: RouteHandler): this {
    this.routes.push({ path, handler })
    return this
  }

  async handle(request: Request, env: unknown): Promise<Response> {
    const url = new URL(request.url)

    for (const route of this.routes) {
      const params = this.matchRoute(route.path, url.pathname)
      if (params !== null) {
        return route.handler({ request, params, env })
      }
    }

    return new Response('Not Found', { status: 404 })
  }

  private matchRoute(pattern: string, pathname: string): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean)
    const pathParts = pathname.split('/').filter(Boolean)

    if (patternParts.length !== pathParts.length) {
      return null
    }

    const params: Record<string, string> = {}

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]

      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = pathPart
      } else if (patternPart !== pathPart) {
        return null
      }
    }

    return params
  }
}

export function createRouter(): Router {
  return new Router()
}
