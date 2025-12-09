/**
 * @module ixflare
 * @description Edge-native fullstack framework for Cloudflare Workers
 * @packageDocumentation
 */

// Core exports
export { createRouter, Router } from './core/router'
export type { HttpMethod } from './core/router'
export { createMiddleware, defineMiddleware, compose, withErrorBoundary } from './core/middleware'
export type { Middleware, MiddlewareContext } from './core/middleware'
export { createApp, App } from './core/app'
export type { AppConfig, RouteConfig } from './core/app'

// Request/Response transformation utilities
export {
  cloneRequest,
  cloneResponse,
  withRequestHeaders,
  withResponseHeaders,
} from './core/request-helpers'

// Middleware
export { requestId, type RequestIdConfig } from './middleware/request-id'
export { logging, type LoggingConfig } from './middleware/logging'
export { timing, type TimingConfig } from './middleware/timing'
export { errorHandler, type ErrorHandlerConfig } from './middleware/error-handler'

// Rate limiting exports
export {
  rateLimit,
  parseWindow,
  calculateReset,
  extractIpKey,
  extractUserKey,
  extractApiKeyKey,
  resolveKeyBy,
} from './core/rate-limiter'
export { MemoryRateLimitStore, KVRateLimitStore, createKVStore } from './core/rate-limiter-store'
export type {
  RateLimitConfig,
  RateLimitWindow,
  RateLimitKeyStrategy,
  RateLimitAlgorithm,
  RateLimitResult,
  RateLimitStore,
} from './types/rate-limiter'
export { createContext, type Context } from './core/context'
export {
  json,
  html,
  htmlResponse,
  redirect,
  notFound,
  text,
  stream,
  eventStream,
  type SSEEvent,
} from './core/helpers'
export {
  extractParamsFromUrl,
  parseCatchAllParam,
  validateParams,
  matchRouteWithParams,
} from './core/params'

// Body parsing utilities with Zod validation
// Note: parseJsonWithSchema/parseFormDataWithSchema include Zod validation
// The simpler parseJson/parseFormData from ./types do NOT require Zod
export {
  parseBody,
  parseJson as parseJsonWithSchema,
  parseFormData as parseFormDataWithSchema,
  getFile,
  getFiles,
  validateFile,
  formatZodErrors,
  type ParseBodyOptions,
  type FileValidationOptions,
} from './core/body-parser'

// Query parameter parsing with Zod validation
export { parseQuery } from './core/query-parser'

// Layout exports moved to 'ixflare/ssr' to avoid React dependency in API-only apps
// Use: import { useLayoutData, executeLoaders } from 'ixflare/ssr'
export {
  executeLoaders,
  executeLayoutLoaders,
  getLoaderErrorResponse,
  LayoutLoaderError,
} from './core/layout-loader'
export type { LayoutLoaderFunction } from './core/layout-loader'

// Config exports (primary API)
export { defineConfig } from './config/define-config'
export { ConfigError } from './config/errors'

// Config type exports
export type {
  IxflareConfig,
  IxflareConfigInput,
  DatabaseConfig,
  CacheConfig,
  SecurityConfig,
  HooksConfig,
  CommandConfig,
  EnvConfig,
  PostBuildContext,
  PreDeployContext,
  PostDeployContext,
  PreBuildHook,
  PostBuildHook,
  PreDeployHook,
  PostDeployHook,
  HookContext,
} from './config/types'

// Error exports
export {
  AppError,
  AuthError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  InfraError,
  HttpError,
} from './errors'

// Type exports (new EdgeContext-based types)
export type {
  EdgeContext,
  LoaderFunction,
  ActionFunction,
  RouteHandler as EdgeRouteHandler,
  MethodHandlers,
  MiddlewareFunction,
  ErrorHandler,
  ResponseInit,
} from './types'

export {
  createEdgeContext,
  parseJson,
  parseFormData,
  parseText,
  getQueryParam,
  getQueryParams,
  getParam,
} from './types'

// Handler type aliases (backward compatibility)
// Note: ParseBodyOptions is exported from ./core/body-parser above
export type {
  LoaderArgs,
  ActionArgs,
  LayoutLoaderArgs,
  LayoutProps,
  PageProps,
  PageLoaderFunction,
} from './types'

// Utility exports
export { redactSecrets, redactString, isSensitiveKey } from './utils/redact'

// EdgeRecord ORM exports
export * from './edge-record'
