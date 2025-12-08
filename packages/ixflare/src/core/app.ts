/**
 * @module core/app
 * @description Application factory that creates a configured router with middleware
 * @worker-only
 *
 * This module bridges the gap between configuration (edge.config.ts) and runtime.
 * It creates an Application instance that:
 * 1. Accepts global middleware from config
 * 2. Registers routes with their middleware chains
 * 3. Handles requests through the full middleware pipeline
 */

import type { Middleware } from './middleware'
import type { Router, RouteHandler, HttpMethod } from './router'
import { createRouter } from './router'
import type { ZodSchema } from 'zod'
import type { PageLoaderFunction } from '@/types/handlers'

export interface AppConfig<Env = unknown> {
  /**
   * Global middleware that runs on every request (from edge.config.ts)
   * These run before any directory or route-specific middleware.
   */
  middleware?: Middleware<Env>[]
}

export interface RouteConfig<Env = unknown> {
  /** HTTP methods this route handles */
  methods?: HttpMethod[]
  /** Name of catch-all parameter */
  catchAllParam?: string
  /** Zod schema for parameter validation */
  paramsSchema?: ZodSchema
  /** Page loader function */
  loader?: PageLoaderFunction<unknown, Env>
  /** Directory middleware chain (from _middleware.ts files, root to innermost) */
  directoryMiddleware?: Middleware<Env>[]
  /** Route-specific middleware (from route file exports) */
  routeMiddleware?: Middleware<Env>[]
}

/**
 * Application class that wraps the router with global middleware configuration
 *
 * @example
 * ```typescript
 * import { createApp } from 'ixflare'
 * import { logging, cors, security } from './middleware'
 *
 * const app = createApp({
 *   middleware: [logging(), cors(), security()],
 * })
 *
 * app.route('/api/users', handler, {
 *   directoryMiddleware: [requireAuth],
 *   routeMiddleware: [rateLimit()],
 * })
 *
 * export default {
 *   fetch: (request, env, ctx) => app.handle(request, env, ctx),
 * }
 * ```
 */
export class App<Env = unknown> {
  private router: Router<Env>
  private globalMiddleware: Middleware<Env>[]

  constructor(config: AppConfig<Env> = {}) {
    this.router = createRouter<Env>()
    this.globalMiddleware = config.middleware || []
  }

  /**
   * Register a route with the application
   *
   * Global middleware from app config is automatically prepended to the chain.
   * Full execution order: global → directory → route → handler
   *
   * @param path - Route path pattern (e.g., '/api/users/:id')
   * @param handler - Route handler function
   * @param options - Route configuration including directory and route middleware
   */
  route(path: string, handler: RouteHandler<Env>, options: RouteConfig<Env> = {}): this {
    this.router.add(path, handler, {
      methods: options.methods,
      catchAllParam: options.catchAllParam,
      paramsSchema: options.paramsSchema,
      loader: options.loader,
      globalMiddleware: this.globalMiddleware,
      directoryMiddleware: options.directoryMiddleware,
      routeMiddleware: options.routeMiddleware,
    })
    return this
  }

  /**
   * Handle an incoming request through the middleware chain and router
   */
  async handle(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    return this.router.handle(request, env, ctx)
  }

  /**
   * Get the underlying router instance (for advanced usage)
   */
  getRouter(): Router<Env> {
    return this.router
  }

  /**
   * Get the configured global middleware (for debugging/testing)
   */
  getGlobalMiddleware(): Middleware<Env>[] {
    return [...this.globalMiddleware]
  }
}

/**
 * Create a new application instance with optional global middleware
 *
 * @param config - Application configuration including global middleware
 * @returns Configured Application instance
 *
 * @example
 * ```typescript
 * // In your worker entry point
 * import { createApp } from 'ixflare'
 * import config from './edge.config'
 *
 * const app = createApp({
 *   middleware: config.middleware,
 * })
 *
 * // Register routes (typically auto-generated from file system)
 * app.route('/api/users', usersHandler)
 * app.route('/api/posts', postsHandler)
 *
 * export default {
 *   fetch: app.handle.bind(app),
 * }
 * ```
 */
export function createApp<Env = unknown>(config: AppConfig<Env> = {}): App<Env> {
  return new App<Env>(config)
}
