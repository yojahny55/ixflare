/**
 * @fileoverview Route handler type definitions
 * @worker-only
 */

import type { EdgeContext } from './context'

/**
 * Arguments passed to loader functions
 *
 * @template Env - Type of environment bindings
 */
export type LoaderArgs<Env = Record<string, unknown>> = EdgeContext<Env>

/**
 * Arguments passed to action functions
 *
 * @template Env - Type of environment bindings
 */
export type ActionArgs<Env = Record<string, unknown>> = EdgeContext<Env>

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
