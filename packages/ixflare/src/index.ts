/**
 * @module ixflare
 * @description Edge-native fullstack framework for Cloudflare Workers
 * @packageDocumentation
 */

// Core exports
export { createRouter, Router } from './core/router'
export { createMiddleware, compose } from './core/middleware'
export { createContext, type Context } from './core/context'
export { json, html, redirect, notFound } from './core/helpers'

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
} from './config/types'

// Error exports
export { AppError, AuthError, ValidationError, NotFoundError, ForbiddenError, ConflictError, InfraError, HttpError } from './errors'

// Type exports (new EdgeContext-based types)
export type {
  EdgeContext,
  LoaderFunction,
  ActionFunction,
  RouteHandler as EdgeRouteHandler,
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

// Legacy type exports (backward compatibility)
export type { Middleware, LoaderArgs, ActionArgs, Env } from './types'
