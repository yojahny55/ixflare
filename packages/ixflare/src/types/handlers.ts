/**
 * @fileoverview Route handler type definitions
 * @worker-only
 */

import type { EdgeContext } from './context'
import type { ReactNode } from 'react'

/**
 * Arguments passed to loader functions
 *
 * @template TParams - Type of route parameters (inferred from Zod schema or Record<string, string>)
 * @template Env - Type of environment bindings
 */
export interface LoaderArgs<
  TParams = Record<string, string>,
  Env = Record<string, unknown>
> {
  request: Request
  params: TParams
  env: Env
  ctx: ExecutionContext
  query: URLSearchParams
  url: URL
  method: string
  headers: Headers
}

/**
 * Arguments passed to action functions
 *
 * @template TParams - Type of route parameters (inferred from Zod schema or Record<string, string>)
 * @template Env - Type of environment bindings
 */
export type ActionArgs<
  TParams = Record<string, string>,
  Env = Record<string, unknown>
> = LoaderArgs<TParams, Env>

/**
 * Loader function for GET requests
 *
 * @template Env - Type of environment bindings
 */
export type LoaderFunction<Env = Record<string, unknown>> = (
  context: EdgeContext<Env>
) => Promise<Response> | Response

/**
 * Action function for POST/PUT/PATCH/DELETE requests
 *
 * @template Env - Type of environment bindings
 */
export type ActionFunction<Env = Record<string, unknown>> = (
  context: EdgeContext<Env>
) => Promise<Response> | Response

/**
 * Generic route handler function
 *
 * @template Env - Type of environment bindings
 */
export type RouteHandler<Env = Record<string, unknown>> = (
  context: EdgeContext<Env>
) => Promise<Response> | Response

/**
 * Object-style method handlers for convenience
 *
 * @template Env - Type of environment bindings
 *
 * @example
 * ```typescript
 * const handlers: MethodHandlers = {
 *   GET: async (ctx) => Response.json({ users: [] }),
 *   POST: async (ctx) => Response.json({ created: true }, { status: 201 })
 * }
 * ```
 */
export type MethodHandlers<Env = Record<string, unknown>> = {
  GET?: RouteHandler<Env>
  POST?: RouteHandler<Env>
  PUT?: RouteHandler<Env>
  DELETE?: RouteHandler<Env>
  PATCH?: RouteHandler<Env>
  HEAD?: RouteHandler<Env>
  OPTIONS?: RouteHandler<Env>
}

/**
 * Middleware function that can modify request/response
 *
 * @template Env - Type of environment bindings
 */
export type MiddlewareFunction<Env = Record<string, unknown>> = (
  context: EdgeContext<Env>,
  next: () => Promise<Response>
) => Promise<Response> | Response

/**
 * Error handler function
 *
 * @template Env - Type of environment bindings
 */
export type ErrorHandler<Env = Record<string, unknown>> = (
  error: Error,
  context: EdgeContext<Env>
) => Promise<Response> | Response

/**
 * Arguments passed to layout loader functions
 *
 * @template TParams - Type of route parameters (inferred from Zod schema or Record<string, string>)
 * @template Env - Type of environment bindings
 */
export type LayoutLoaderArgs<
  TParams = Record<string, string>,
  Env = Record<string, unknown>
> = LoaderArgs<TParams, Env>

/**
 * Props passed to layout components
 *
 * @template TData - Type of data returned by layout loader
 *
 * Note: `data`, `params`, and `request` are marked optional for flexibility
 * when layouts don't have loaders or when testing. In runtime, these will
 * always be provided by the layout renderer.
 */
export interface LayoutProps<TData = unknown> {
  /** Child content to render within the layout */
  children: ReactNode
  /** Data from the layout's loader function (undefined if no loader) */
  data?: TData
  /** Route parameters extracted from the URL path */
  params?: Record<string, string>
  /** The original Request object */
  request?: Request
}

/**
 * Loader function signature for page components
 *
 * @template TData - Type of data returned by the loader
 * @template Env - Type of environment bindings
 *
 * Page loaders can return:
 * - Data object (will be passed to component as `data` prop)
 * - Response object (including redirects, errors, etc.)
 *
 * NOTE: PageLoaderFunction allows returning Response (for redirects/errors),
 * while LayoutLoaderFunction does not. This is intentional:
 * - Page loaders are terminal and can redirect or return error responses
 * - Layout loaders provide data for wrapping content; errors are thrown instead
 *
 * @example
 * ```typescript
 * export async function loader({ params, env }: LoaderArgs) {
 *   const user = await User.find(params.userId)
 *   if (!user) {
 *     throw new NotFoundError('User not found')
 *   }
 *   return { user }
 * }
 * ```
 */
export type PageLoaderFunction<
  TData = unknown,
  Env = Record<string, unknown>
> = (args: LoaderArgs<Record<string, string>, Env>) => Promise<TData | Response> | TData | Response

/**
 * Loader function signature for layout components
 *
 * @template TData - Type of data returned by the loader
 * @template Env - Type of environment bindings
 */
export type LayoutLoaderFunction<
  TData = unknown,
  Env = Record<string, unknown>
> = (args: LayoutLoaderArgs<Record<string, string>, Env>) => Promise<TData | Response> | TData | Response

/**
 * Props passed to page components
 *
 * @template TData - Type of data returned by page loader
 *
 * Page components receive data from their loader function along with
 * request context.
 *
 * @example
 * ```typescript
 * export default function UserPage({ data, params }: PageProps<{ user: User }>) {
 *   return <h1>{data.user.name}</h1>
 * }
 * ```
 */
export interface PageProps<TData = unknown> {
  /** Data from the page's loader function */
  data: TData
  /** Route parameters extracted from the URL path */
  params: Record<string, string>
  /** The original Request object */
  request: Request
}

/**
 * Options for parsing request body
 *
 * @example
 * ```typescript
 * const body = await parseBody(request, {
 *   clone: true,  // Clone request before reading
 *   maxSize: 1024 * 1024  // 1MB limit
 * })
 * ```
 */
export interface ParseBodyOptions {
  /** Clone request before reading body (for multiple reads) */
  clone?: boolean
  /** Maximum body size in bytes (default: no limit) */
  maxSize?: number
}
