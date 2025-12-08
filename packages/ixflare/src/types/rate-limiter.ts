/**
 * @module types/rate-limiter
 * @description Type definitions for rate limiting functionality
 * @worker-only
 */

import type { EdgeContext } from './context'

/**
 * Rate limit window duration formats
 *
 * Supports common time window patterns:
 * - '10s' = 10 seconds
 * - '1m' = 1 minute
 * - '15m' = 15 minutes
 * - '1h' = 1 hour
 * - '1d' = 1 day
 * - Number = seconds as integer
 */
export type RateLimitWindow = '10s' | '1m' | '15m' | '1h' | '1d' | number

/**
 * Built-in key extraction strategies for rate limiting
 *
 * - 'ip': Rate limit by IP address (CF-Connecting-IP or X-Forwarded-For)
 * - 'user': Rate limit by authenticated user ID (requires ctx.user.id)
 * - 'apiKey': Rate limit by API key from Authorization header or X-API-Key
 */
export type RateLimitKeyStrategy = 'ip' | 'user' | 'apiKey'

/**
 * Rate limiting algorithm types
 *
 * - 'fixed-window': Simple counter that resets at fixed intervals
 * - 'sliding-window': More accurate, prevents burst at window boundaries
 */
export type RateLimitAlgorithm = 'fixed-window' | 'sliding-window'

/**
 * Result from rate limit check
 */
export interface RateLimitResult {
  /** Current request count in the window */
  count: number

  /** Unix timestamp (seconds) when the limit will reset */
  resetAt: number

  /** Seconds until the limit resets */
  retryAfter: number

  /** Whether the rate limit has been exceeded */
  limited: boolean
}

/**
 * Storage backend interface for rate limiting
 *
 * Implement this interface to create custom storage backends
 * (KV, Durable Objects, in-memory, etc.)
 */
export interface RateLimitStore {
  /**
   * Increment the counter for a given key and window
   *
   * @param key - The rate limit key (e.g., "ip:1.2.3.4")
   * @param windowMs - Window duration in milliseconds
   * @returns Rate limit result with count and timing info
   */
  increment(key: string, windowMs: number): Promise<RateLimitResult>

  /**
   * Reset the counter for a given key (optional)
   *
   * @param key - The rate limit key to reset
   */
  reset?(key: string): Promise<void>
}

/**
 * Configuration for rate limiting middleware
 *
 * @template Env - Environment bindings type
 *
 * @example Basic IP-based rate limiting
 * ```typescript
 * const config: RateLimitConfig = {
 *   max: 100,
 *   window: '15m'
 * }
 * ```
 *
 * @example User-based with custom response
 * ```typescript
 * const config: RateLimitConfig = {
 *   max: 1000,
 *   window: '1h',
 *   keyBy: 'user',
 *   onLimit: (ctx) => Response.json({
 *     error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Please upgrade!' }
 *   }, { status: 429 })
 * }
 * ```
 *
 * @example Custom key function
 * ```typescript
 * const config: RateLimitConfig = {
 *   max: 50,
 *   window: '1m',
 *   keyBy: (ctx) => ctx.request.headers.get('X-Tenant-ID')
 * }
 * ```
 */
export interface RateLimitConfig<Env = unknown> {
  /**
   * Maximum number of requests allowed in the window
   */
  max: number

  /**
   * Time window for rate limiting
   *
   * Accepts string formats ('10s', '1m', '15m', '1h', '1d') or number of seconds
   */
  window: RateLimitWindow

  /**
   * Key extraction strategy or custom function
   *
   * - Built-in strategies: 'ip' (default), 'user', 'apiKey'
   * - Custom function: Return string for rate limit key, or null to skip limiting
   *
   * @default 'ip'
   */
  keyBy?: RateLimitKeyStrategy | ((ctx: EdgeContext<Env>) => string | null)

  /**
   * Rate limiting algorithm
   *
   * @default 'sliding-window'
   */
  algorithm?: RateLimitAlgorithm

  /**
   * Custom handler for rate limit exceeded
   *
   * If not provided, returns standard 429 error response
   */
  onLimit?: (ctx: EdgeContext<Env>) => Response | Promise<Response>

  /**
   * Custom storage backend
   *
   * If not provided, uses KV-based store (requires env.RATE_LIMIT_KV)
   * For testing or single-instance, use MemoryRateLimitStore
   */
  store?: RateLimitStore
}
