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

// Config exports
export { defineConfig } from './config/define-config'
export type { IxflareConfig } from './config/types'

// Error exports
export { AppError, AuthError, ValidationError, NotFoundError, ForbiddenError, ConflictError, InfraError, HttpError } from './errors'

// Type exports
export type { RouteHandler, Middleware, LoaderArgs, ActionArgs, Env } from './types'
