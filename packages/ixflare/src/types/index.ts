/**
 * @fileoverview Shared type definitions and exports
 * @universal
 */

// Export EdgeContext and helpers
export type { EdgeContext } from './context'
export { createEdgeContext } from './context'

// Export request helpers
export {
  parseJson,
  parseFormData,
  parseText,
  getQueryParam,
  getQueryParams,
  getParam,
} from './request'

// Export response helpers
export type { ResponseInit } from './response'
export {
  json,
  text,
  html,
  redirect,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from './response'

// Export handler types
export type {
  LoaderFunction,
  ActionFunction,
  RouteHandler,
  MiddlewareFunction,
  ErrorHandler,
} from './handlers'

// Legacy exports for backward compatibility
import type { Context } from '../core/context'

export interface Env {
  DB?: D1Database
  CACHE?: KVNamespace
  [key: string]: unknown
}

export interface LoaderArgs<E = Env> {
  request: Request
  context: Context<E>
  params: Record<string, string>
  env: E
}

export interface ActionArgs<E = Env> extends LoaderArgs<E> {
  formData: () => Promise<FormData>
}

export type Middleware<E = Env> = (
  args: LoaderArgs<E>,
  next: () => Promise<Response>
) => Response | Promise<Response>

// Note: Cloudflare Workers types now provided by @cloudflare/workers-types
// Global type augmentation removed to prevent conflicts
