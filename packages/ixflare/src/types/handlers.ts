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
