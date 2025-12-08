/**
 * @module core/rate-limiter
 * @description Rate limiting middleware for Cloudflare Workers
 *
 * @example Basic usage
 * ```typescript
 * import { rateLimit } from 'ixflare'
 *
 * // IP-based, 100 requests per 15 minutes
 * export const middleware = [
 *   rateLimit({ max: 100, window: '15m' })
 * ]
 * ```
 *
 * @example User-based rate limiting
 * ```typescript
 * // Requires auth middleware first
 * export const middleware = [
 *   requireAuth,
 *   rateLimit({ max: 1000, window: '1h', keyBy: 'user' })
 * ]
 * ```
 *
 * @example Custom key function
 * ```typescript
 * export const middleware = [
 *   rateLimit({
 *     max: 50,
 *     window: '1m',
 *     keyBy: (ctx) => ctx.request.headers.get('X-Tenant-ID')
 *   })
 * ]
 * ```
 */

import type { Middleware } from './middleware'
import type { EdgeContext } from '@/types/context'
import type {
  RateLimitConfig,
  RateLimitWindow,
  RateLimitKeyStrategy,
  RateLimitStore,
  RateLimitAlgorithm,
} from '@/types/rate-limiter'
import { createKVStore } from './rate-limiter-store'

/**
 * Parse rate limit window string to seconds
 *
 * @param window - Window format ('10s', '1m', '15m', '1h', '1d') or number
 * @returns Window duration in seconds
 *
 * @example
 * ```typescript
 * parseWindow('15m') // 900
 * parseWindow('1h')  // 3600
 * parseWindow(60)    // 60
 * ```
 */
export function parseWindow(window: RateLimitWindow): number {
  if (typeof window === 'number') {
    return window
  }

  const match = window.match(/^(\d+)(s|m|h|d)$/)
  if (!match) {
    throw new Error(
      `Invalid window format: ${window}. Expected formats: '10s', '1m', '15m', '1h', '1d', or number`
    )
  }

  const [, value, unit] = match
  const numValue = parseInt(value, 10)

  switch (unit) {
    case 's':
      return numValue
    case 'm':
      return numValue * 60
    case 'h':
      return numValue * 60 * 60
    case 'd':
      return numValue * 60 * 60 * 24
    default:
      throw new Error(`Invalid time unit: ${unit}`)
  }
}

/**
 * Calculate Unix timestamp (seconds) when the rate limit will reset
 *
 * @param windowSeconds - Window duration in seconds
 * @returns Unix timestamp in seconds
 */
export function calculateReset(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000) + windowSeconds
}

/**
 * Extract IP address from request context
 *
 * Prioritizes Cloudflare's CF-Connecting-IP header, falls back to X-Forwarded-For
 *
 * @param ctx - Edge context
 * @returns IP-based key or null if no IP found
 */
export function extractIpKey(ctx: EdgeContext): string | null {
  // Cloudflare provides CF-Connecting-IP header (most reliable)
  const cfIp = ctx.request.headers.get('CF-Connecting-IP')
  if (cfIp) return `ip:${cfIp}`

  // Fallback to X-Forwarded-For (first IP only)
  const xff = ctx.request.headers.get('X-Forwarded-For')
  if (xff) {
    const firstIp = xff.split(',')[0].trim()
    return `ip:${firstIp}`
  }

  return null // Skip rate limiting if no IP
}

/**
 * Extract authenticated user ID from context
 *
 * Requires auth middleware to set ctx.user
 *
 * @param ctx - Edge context
 * @returns User-based key or null if unauthenticated
 */
export function extractUserKey(ctx: EdgeContext): string | null {
  // Check for user extension on context (set by auth middleware)
  const user = (ctx as EdgeContext & { user?: { id: string } }).user
  if (user?.id) return `user:${user.id}`

  return null // Skip rate limiting for unauthenticated requests
}

/**
 * Extract API key from Authorization header or X-API-Key
 *
 * @param ctx - Edge context
 * @returns API key-based key or null if no key found
 */
export function extractApiKeyKey(ctx: EdgeContext): string | null {
  // From Authorization: Bearer <key>
  const auth = ctx.request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const key = auth.slice(7)
    // Use first 16 chars for privacy (don't store full key)
    return `apiKey:${key.slice(0, 16)}`
  }

  // Alternative: X-API-Key header
  const apiKey = ctx.request.headers.get('X-API-Key')
  if (apiKey) return `apiKey:${apiKey.slice(0, 16)}`

  return null
}

/**
 * Resolve key extraction strategy to a function
 *
 * @param keyBy - Strategy name or custom function
 * @returns Key extraction function
 */
export function resolveKeyBy<Env = unknown>(
  keyBy?: RateLimitKeyStrategy | ((ctx: EdgeContext<Env>) => string | null)
): (ctx: EdgeContext<Env>) => string | null {
  // Default to IP-based
  if (!keyBy) return extractIpKey as (ctx: EdgeContext<Env>) => string | null

  // Custom function
  if (typeof keyBy === 'function') return keyBy

  // Built-in strategies
  switch (keyBy) {
    case 'ip':
      return extractIpKey as (ctx: EdgeContext<Env>) => string | null
    case 'user':
      return extractUserKey as (ctx: EdgeContext<Env>) => string | null
    case 'apiKey':
      return extractApiKeyKey as (ctx: EdgeContext<Env>) => string | null
    default:
      throw new Error(`Unknown key strategy: ${keyBy}`)
  }
}

/**
 * Create rate limiting middleware
 *
 * @template Env - Environment bindings type
 * @param config - Rate limit configuration
 * @returns Middleware function
 *
 * @example IP-based rate limiting
 * ```typescript
 * export const middleware = [
 *   rateLimit({ max: 100, window: '15m' })
 * ]
 * ```
 *
 * @example User-based rate limiting
 * ```typescript
 * export const middleware = [
 *   requireAuth,
 *   rateLimit({ max: 1000, window: '1h', keyBy: 'user' })
 * ]
 * ```
 *
 * @example Custom response on limit
 * ```typescript
 * export const middleware = [
 *   rateLimit({
 *     max: 100,
 *     window: '15m',
 *     onLimit: (ctx) => Response.json({
 *       error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Upgrade to premium!' }
 *     }, { status: 429 })
 *   })
 * ]
 * ```
 */
export function rateLimit<Env = unknown>(config: RateLimitConfig<Env>): Middleware<Env> {
  // Validate and parse configuration
  const windowSeconds = parseWindow(config.window)
  const windowMs = windowSeconds * 1000
  const keyExtractor = resolveKeyBy(config.keyBy)
  const algorithm: RateLimitAlgorithm = config.algorithm || 'sliding-window'

  // Store will be validated at runtime when first request comes in
  // This allows store to be provided later or use default KV store

  return async (ctx: EdgeContext<Env>, next) => {
    // Extract rate limit key
    const key = keyExtractor(ctx)

    // Skip rate limiting if no key (e.g., no IP found, user not authenticated)
    if (!key) {
      return next()
    }

    // Get or create store, passing algorithm config
    const store: RateLimitStore = config.store || createDefaultStore(ctx.env, algorithm)

    // Check rate limit
    const result = await store.increment(key, windowMs)

    // Check if limit exceeded
    const isLimited = result.count > config.max

    // Always set rate limit headers (even if not limited)
    const response = isLimited ? await handleRateLimited(ctx, config, result) : await next()

    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', String(config.max))
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.max - result.count)))
    response.headers.set('X-RateLimit-Reset', String(result.resetAt))

    return response
  }
}

/**
 * Handle rate limit exceeded response
 */
async function handleRateLimited<Env = unknown>(
  ctx: EdgeContext<Env>,
  config: RateLimitConfig<Env>,
  result: { retryAfter: number }
): Promise<Response> {
  // Use custom handler if provided
  if (config.onLimit) {
    return config.onLimit(ctx)
  }

  // Default 429 response with standard error envelope format
  // Architecture pattern: { error: { code, message, status, timestamp, ... } }
  return Response.json(
    {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        status: 429,
        timestamp: Date.now(),
        retryAfter: result.retryAfter,
      },
    },
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
      },
    }
  )
}

/**
 * Create default KV-based store with specified algorithm
 *
 * @param env - Environment bindings containing KV namespace
 * @param algorithm - Rate limiting algorithm ('sliding-window' | 'fixed-window')
 * @returns Configured KV rate limit store
 */
function createDefaultStore(
  env: unknown,
  algorithm: RateLimitAlgorithm = 'sliding-window'
): RateLimitStore {
  return createKVStore(env as Record<string, unknown>, 'RATE_LIMIT_KV', algorithm)
}
