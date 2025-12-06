/**
 * @module ixflare
 * @description Edge-native fullstack framework for Cloudflare Workers
 * @packageDocumentation
 */

// Core exports
export { createRouter, Router } from './core/router'
export type { HttpMethod } from './core/router'
export { createMiddleware, compose } from './core/middleware'
export { createContext, type Context } from './core/context'
export { json, html, redirect, notFound } from './core/helpers'
export {
  extractParamsFromUrl,
  parseCatchAllParam,
  validateParams,
  matchRouteWithParams,
} from './core/params'

// Layout exports moved to 'ixflare/ssr' to avoid React dependency in API-only apps
// Use: import { useLayoutData, executeLoaders } from 'ixflare/ssr'
export { executeLoaders, executeLayoutLoaders, getLoaderErrorResponse, LayoutLoaderError } from './core/layout-loader'
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
export { AppError, AuthError, ValidationError, NotFoundError, ForbiddenError, ConflictError, InfraError, HttpError } from './errors'

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
export type { LoaderArgs, ActionArgs, LayoutLoaderArgs, LayoutProps, PageProps, PageLoaderFunction } from './types'

// Utility exports
export { redactSecrets, redactString, isSensitiveKey } from './utils/redact'
