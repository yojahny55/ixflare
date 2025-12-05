/**
 * @module core/router
 * @description File-based router for Cloudflare Workers with URLPattern-based param extraction
 * @worker-only
 */

import type { ZodSchema } from 'zod'
import { extractParamsFromUrl, parseCatchAllParam, validateParams } from './params'

export interface Route {
  path: string
  handler: RouteHandler
  /** Name of catch-all parameter (e.g., 'path' from [...path].tsx) */
  catchAllParam?: string
  /** Zod schema for parameter validation */
  paramsSchema?: ZodSchema
}

export type RouteHandler = (context: RouteContext) => Response | Promise<Response>

export interface RouteContext {
  request: Request
  /** Route params - may include coerced types (number, boolean) after Zod validation */
  params: Record<string, unknown>
  env: unknown
}

/** Zod v4 error issue structure */
interface ZodIssue {
  path: (string | number)[]
  message: string
}

/** Type guard to check if error is a ZodError (Zod v4 compatible) */
function isZodError(error: unknown): error is { name: string; issues: ZodIssue[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'ZodError' &&
    'issues' in error &&
    Array.isArray((error as { issues: unknown }).issues)
  )
}

/**
 * Format ZodError into API error response (per architecture spec)
 */
function formatValidationErrorResponse(error: { issues: ZodIssue[] }): Response {
  const details: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'value'
    if (!details[path]) {
      details[path] = []
    }
    details[path].push(issue.message)
  }

  return new Response(
    JSON.stringify({
      error: {
        code: 'VALIDATION.INVALID_PARAMS',
        message: 'Parameter validation failed',
        status: 400,
        details,
        timestamp: Date.now(),
      },
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

export class Router {
  private routes: Route[] = []

  /**
   * Add a route to the router
   *
   * @param path - Route pattern (e.g., '/users/:userId')
   * @param handler - Route handler function
   * @param options - Optional route configuration
   * @param options.catchAllParam - Name of catch-all parameter (e.g., 'path' from [...path].tsx)
   * @param options.paramsSchema - Zod schema for automatic parameter validation
   */
  add(
    path: string,
    handler: RouteHandler,
    options?: { catchAllParam?: string; paramsSchema?: ZodSchema }
  ): this {
    this.routes.push({
      path,
      handler,
      catchAllParam: options?.catchAllParam,
      paramsSchema: options?.paramsSchema,
    })
    return this
  }

  async handle(request: Request, env: unknown): Promise<Response> {
    const url = new URL(request.url)

    for (const route of this.routes) {
      const params = this.matchRoute(route.path, url.pathname, route.catchAllParam)
      if (params !== null) {
        // If route has a params schema, validate and coerce
        if (route.paramsSchema) {
          try {
            const validatedParams = validateParams(params, route.paramsSchema) as Record<string, unknown>
            return route.handler({ request, params: validatedParams, env })
          } catch (error) {
            // Check if it's a ZodError (Zod v4 uses 'issues' array)
            if (isZodError(error)) {
              return formatValidationErrorResponse(error)
            }
            // Re-throw unexpected errors
            throw error
          }
        }

        return route.handler({ request, params, env })
      }
    }

    return new Response('Not Found', { status: 404 })
  }

  private matchRoute(
    pattern: string,
    pathname: string,
    catchAllParam?: string
  ): Record<string, string | string[]> | null {
    // Use URLPattern-based extraction for better pattern matching
    const params = extractParamsFromUrl(pattern, pathname)

    if (params === null) {
      return null
    }

    // Handle catch-all routes - convert catch-all string to array
    // Map from URLPattern's '0' group to the named param from file (e.g., 'path')
    if (catchAllParam && params['0'] !== undefined) {
      const catchAllPath = params['0']
      const parsedPath = parseCatchAllParam(catchAllPath)
      // Remove '0' and add named param
      const { '0': _, ...restParams } = params
      return { ...restParams, [catchAllParam]: parsedPath }
    }

    return params
  }
}

export function createRouter(): Router {
  return new Router()
}
