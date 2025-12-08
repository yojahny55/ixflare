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
  LoaderArgs,
  ActionArgs,
  LoaderFunction,
  ActionFunction,
  RouteHandler,
  MethodHandlers,
  MiddlewareFunction,
  ErrorHandler,
  LayoutLoaderArgs,
  LayoutProps,
  PageLoaderFunction,
  PageProps,
  LayoutLoaderFunction,
  ParseBodyOptions,
} from './handlers'

// Export rate limiter types
export type {
  RateLimitConfig,
  RateLimitWindow,
  RateLimitKeyStrategy,
  RateLimitAlgorithm,
  RateLimitResult,
  RateLimitStore,
} from './rate-limiter'

// Note: Cloudflare Workers types now provided by @cloudflare/workers-types
// Global type augmentation removed to prevent conflicts
