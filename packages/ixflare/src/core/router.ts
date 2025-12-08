/**
 * @module core/router
 * @description File-based router for Cloudflare Workers with URLPattern-based param extraction
 * @worker-only
 */

import type { ZodSchema } from 'zod'
import type { EdgeContext } from '@/types/context'
import type { PageLoaderFunction } from '@/types/handlers'
import type { Middleware } from './middleware'
import { createEdgeContext } from '@/types/context'
import { extractParamsFromUrl, parseCatchAllParam, validateParams } from './params'
import { getLoaderErrorResponse } from './layout-loader'
import { compose } from './middleware'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface Route<Env = unknown> {
  path: string
  handler: RouteHandler<Env>
  /** HTTP methods this route handles */
  methods?: HttpMethod[]
  /** Name of catch-all parameter (e.g., 'path' from [...path].tsx) */
  catchAllParam?: string
  /** Zod schema for parameter validation */
  paramsSchema?: ZodSchema
  /** Optional page loader function that runs before handler */
  loader?: PageLoaderFunction<unknown, Env>
  /** Global middleware (from edge.config.ts) */
  globalMiddleware?: Middleware<Env>[]
  /** Directory middleware chain (from _middleware.ts files) */
  directoryMiddleware?: Middleware<Env>[]
  /** Route-specific middleware (from route file) */
  routeMiddleware?: Middleware<Env>[]
}

export type RouteHandler<Env = unknown> = (context: EdgeContext<Env>) => Response | Promise<Response>

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

export class Router<Env = unknown> {
  private routes: Route<Env>[] = []

  /**
   * Add a route to the router
   *
   * @param path - Route pattern (e.g., '/users/:userId')
   * @param handler - Route handler function
   * @param options - Optional route configuration
   * @param options.methods - HTTP methods this route handles (defaults to all methods if not specified)
   * @param options.catchAllParam - Name of catch-all parameter (e.g., 'path' from [...path].tsx)
   * @param options.paramsSchema - Zod schema for automatic parameter validation
   * @param options.loader - Optional page loader function that runs before handler
   * @param options.globalMiddleware - Global middleware from config
   * @param options.directoryMiddleware - Directory-level middleware chain
   * @param options.routeMiddleware - Route-specific middleware
   */
  add(
    path: string,
    handler: RouteHandler<Env>,
    options?: {
      methods?: HttpMethod[]
      catchAllParam?: string
      paramsSchema?: ZodSchema
      loader?: PageLoaderFunction<unknown, Env>
      globalMiddleware?: Middleware<Env>[]
      directoryMiddleware?: Middleware<Env>[]
      routeMiddleware?: Middleware<Env>[]
    }
  ): this {
    this.routes.push({
      path,
      handler,
      methods: options?.methods,
      catchAllParam: options?.catchAllParam,
      paramsSchema: options?.paramsSchema,
      loader: options?.loader,
      globalMiddleware: options?.globalMiddleware,
      directoryMiddleware: options?.directoryMiddleware,
      routeMiddleware: options?.routeMiddleware,
    })
    return this
  }

  async handle(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    // Create a minimal ExecutionContext if not provided (for backwards compatibility)
    const executionContext: ExecutionContext = ctx || {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: {} as ExecutionContext['props'],
    }

    const url = new URL(request.url)
    const method = request.method.toUpperCase() as HttpMethod

    // Find all routes that match the path
    const matchingRoutes: Array<{ route: Route<Env>; params: Record<string, string | string[]> }> = []

    for (const route of this.routes) {
      const params = this.matchRoute(route.path, url.pathname, route.catchAllParam)
      if (params !== null) {
        matchingRoutes.push({ route, params })
      }
    }

    // No matching path found
    if (matchingRoutes.length === 0) {
      return new Response('Not Found', { status: 404 })
    }

    // Collect all supported methods for this path
    const allMethods = new Set<HttpMethod>()
    let matchedHandler: RouteHandler<Env> | null = null
    let matchedParams: Record<string, string | string[]> | null = null
    let matchedSchema: ZodSchema | undefined
    let matchedLoader: PageLoaderFunction<unknown, Env> | undefined
    let matchedGlobalMiddleware: Middleware<Env>[] | undefined
    let matchedDirectoryMiddleware: Middleware<Env>[] | undefined
    let matchedRouteMiddleware: Middleware<Env>[] | undefined

    for (const { route, params } of matchingRoutes) {
      // If route has no method restrictions, it supports all methods
      const routeMethods = route.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

      for (const m of routeMethods) {
        allMethods.add(m)
      }

      // Check if this route handles the current method
      if (!route.methods || route.methods.includes(method)) {
        matchedHandler = route.handler
        matchedParams = params
        matchedSchema = route.paramsSchema
        matchedLoader = route.loader
        matchedGlobalMiddleware = route.globalMiddleware
        matchedDirectoryMiddleware = route.directoryMiddleware
        matchedRouteMiddleware = route.routeMiddleware
      }
    }

    // Auto-generate HEAD handler if we have GET but not explicit HEAD
    if (method === 'HEAD' && !matchedHandler && allMethods.has('GET')) {
      // Find the GET handler
      for (const { route, params } of matchingRoutes) {
        if (!route.methods || route.methods.includes('GET')) {
          const getHandler = route.handler
          matchedParams = params
          matchedSchema = route.paramsSchema
          matchedLoader = route.loader
          matchedGlobalMiddleware = route.globalMiddleware
          matchedDirectoryMiddleware = route.directoryMiddleware
          matchedRouteMiddleware = route.routeMiddleware

          // Create HEAD handler that calls GET and removes body
          matchedHandler = async (context: EdgeContext<Env>) => {
            const getResponse = await getHandler(context)
            return new Response(null, {
              status: getResponse.status,
              statusText: getResponse.statusText,
              headers: getResponse.headers,
            })
          }
          break
        }
      }
      allMethods.add('HEAD')
    }

    // Auto-generate OPTIONS handler if not explicitly defined
    if (method === 'OPTIONS' && !matchedHandler) {
      allMethods.add('OPTIONS')
      // Auto-add HEAD if GET exists
      if (allMethods.has('GET')) {
        allMethods.add('HEAD')
      }
      return new Response(null, {
        status: 204,
        headers: {
          'Allow': Array.from(allMethods).sort().join(', '),
        },
      })
    }

    // Method not allowed - return 405
    if (!matchedHandler) {
      // Auto-add HEAD and OPTIONS to the Allow header
      if (allMethods.has('GET')) {
        allMethods.add('HEAD')
      }
      allMethods.add('OPTIONS')

      return new Response(
        JSON.stringify({
          error: {
            code: 'ROUTING.METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed. Allowed: ${Array.from(allMethods).sort().join(', ')}`,
            status: 405,
            timestamp: Date.now(),
          },
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Allow': Array.from(allMethods).sort().join(', '),
          },
        }
      )
    }

    // Create EdgeContext with validated params
    let finalParams: Record<string, string> = matchedParams as Record<string, string>

    if (matchedSchema && matchedParams) {
      try {
        finalParams = validateParams(matchedParams, matchedSchema) as Record<string, string>
      } catch (error) {
        // Check if it's a ZodError (Zod v4 uses 'issues' array)
        if (isZodError(error)) {
          return formatValidationErrorResponse(error)
        }
        // Re-throw unexpected errors
        throw error
      }
    }

    const edgeContext = createEdgeContext(request, env, executionContext, finalParams)

    // Execute loader if present (before handler)
    if (matchedLoader) {
      try {
        const loaderArgs = {
          request: edgeContext.request,
          params: edgeContext.params,
          env: edgeContext.env,
          ctx: edgeContext.ctx,
          query: edgeContext.query,
          url: edgeContext.url,
          method: edgeContext.method,
          headers: edgeContext.headers,
        }

        const loaderResult = await matchedLoader(loaderArgs)

        // If loader returned a Response (redirect, error, etc.), return it directly
        if (loaderResult instanceof Response) {
          return loaderResult
        }

        // Attach loader data to context for handler/SSR to use
        edgeContext.loaderData = loaderResult
      } catch (error) {
        // Handle thrown Response (e.g., throw redirect())
        if (error instanceof Response) {
          return error
        }

        // Handle typed errors using existing error handler
        if (error instanceof Error) {
          return getLoaderErrorResponse(error)
        }

        // Unknown error type
        throw error
      }
    }

    // Build and apply middleware chain: global → directory → route → handler
    const middlewareChain: Middleware<Env>[] = [
      ...(matchedGlobalMiddleware || []),
      ...(matchedDirectoryMiddleware || []),
      ...(matchedRouteMiddleware || []),
    ]

    // If there's middleware, compose it with the handler
    if (middlewareChain.length > 0) {
      const wrappedHandler = compose(...middlewareChain)(matchedHandler)
      return await wrappedHandler(edgeContext)
    }

    // No middleware, call handler directly
    return await matchedHandler(edgeContext)
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { '0': _, ...restParams } = params
      return { ...restParams, [catchAllParam]: parsedPath }
    }

    return params
  }
}

export function createRouter<Env = unknown>(): Router<Env> {
  return new Router<Env>()
}
