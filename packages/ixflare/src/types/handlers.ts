/**
 * @fileoverview Route handler type definitions
 * @worker-only
 */

import type { EdgeContext } from './context'

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
 */
export interface LayoutProps<TData = unknown> {
  children: React.ReactNode
  data?: TData
  params?: Record<string, unknown>
  request?: Request
}
