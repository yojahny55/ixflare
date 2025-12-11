/**
 * @module ssr/ssg
 * @description SSG (Static Site Generation) and ISR (Incremental Static Regeneration) utilities
 * @packageDocumentation
 *
 * Note: This module provides the runtime utilities for SSG/ISR.
 * Build-time pre-rendering is handled by vite-plugin-ixflare.
 */

import type { RouteConfig } from './types'
import { renderToString } from './render'
import type { RenderOptions } from './types'

/**
 * Serialize params object with stable key ordering for consistent cache keys.
 * JSON.stringify doesn't guarantee key order, so we sort keys first.
 * @param params Route parameters
 * @returns Stable JSON string
 */
function stableStringify(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const sortedObj: Record<string, string> = {}
  for (const key of sortedKeys) {
    sortedObj[key] = params[key]
  }
  return JSON.stringify(sortedObj)
}

/**
 * Cache key generator for ISR
 * @param routePath Route path
 * @param params Route parameters
 * @returns Cache key for KV storage
 */
export function generateISRCacheKey(routePath: string, params?: Record<string, string>): string {
  const paramStr = params ? stableStringify(params) : ''
  return `isr:${routePath}:${paramStr}`
}

/**
 * Pre-render a route to static HTML
 * Used at build time for SSG routes
 * @param component React component to render
 * @param options Render options
 * @returns HTML string
 * @example
 * ```typescript
 * const html = await prerenderRoute(<BlogPost slug="hello" />, {
 *   title: 'Hello World',
 *   meta: { description: 'First post' }
 * })
 * ```
 */
export async function prerenderRoute(
  component: React.ReactElement,
  options?: RenderOptions
): Promise<string> {
  return renderToString(component, options)
}

/**
 * Store pre-rendered HTML in KV cache (ISR)
 * @param env Cloudflare environment bindings
 * @param cacheKey Cache key
 * @param html Pre-rendered HTML
 * @param ttl Time-to-live in seconds (from config.revalidate)
 * @example
 * ```typescript
 * await storeISRCache(env, 'isr:/blog/hello:{}', html, 3600)
 * ```
 */
export async function storeISRCache(
  env: { KV?: KVNamespace },
  cacheKey: string,
  html: string,
  ttl: number
): Promise<void> {
  if (!env.KV) {
    console.warn('[SSG/ISR] KV namespace not available, skipping cache storage')
    return
  }

  await env.KV.put(cacheKey, html, {
    expirationTtl: ttl,
  })
}

/**
 * Retrieve pre-rendered HTML from KV cache (ISR)
 * @param env Cloudflare environment bindings
 * @param cacheKey Cache key
 * @returns Cached HTML or null if not found/expired
 * @example
 * ```typescript
 * const html = await getISRCache(env, 'isr:/blog/hello:{}')
 * if (html) {
 *   return new Response(html, { headers: { 'Content-Type': 'text/html' } })
 * }
 * ```
 */
export async function getISRCache(
  env: { KV?: KVNamespace },
  cacheKey: string
): Promise<string | null> {
  if (!env.KV) {
    return null
  }

  return env.KV.get(cacheKey, 'text')
}

/**
 * ISR request handler
 * Serves from cache or regenerates if expired
 * @param env Cloudflare environment bindings
 * @param cacheKey Cache key
 * @param regenerate Function to regenerate HTML
 * @param config Route configuration
 * @returns Response with HTML
 * @example
 * ```typescript
 * export async function GET(ctx: EdgeContext) {
 *   const cacheKey = generateISRCacheKey('/blog/[slug]', { slug: ctx.params.slug })
 *   return handleISRRequest(
 *     ctx.env,
 *     cacheKey,
 *     async () => renderToString(<BlogPost slug={ctx.params.slug} />),
 *     { rendering: 'ssg', revalidate: 3600 }
 *   )
 * }
 * ```
 */
export async function handleISRRequest(
  env: { KV?: KVNamespace },
  cacheKey: string,
  regenerate: () => Promise<string>,
  config: RouteConfig
): Promise<Response> {
  // Try to serve from cache
  const cached = await getISRCache(env, cacheKey)

  if (cached) {
    // Cache hit - serve immediately
    return new Response(cached, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-ISR-Cache': 'HIT',
      },
    })
  }

  // Cache miss - regenerate
  const html = await regenerate()

  // Store in cache for next request
  if (config.revalidate) {
    // Fire-and-forget cache update (don't await)
    storeISRCache(env, cacheKey, html, config.revalidate).catch((err) => {
      console.error('[ISR] Failed to store cache:', err)
    })
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-ISR-Cache': 'MISS',
    },
  })
}

/**
 * Check if route should use SSG/ISR
 * @param config Route configuration
 * @returns True if route uses SSG/ISR
 */
export function isSSGRoute(config?: RouteConfig): boolean {
  return config?.rendering === 'ssg'
}

/**
 * Validate SSG configuration
 * @param config Route configuration
 * @throws Error if SSG config is invalid
 */
export function validateSSGConfig(config: RouteConfig): void {
  if (config.rendering !== 'ssg') {
    return
  }

  if (config.revalidate !== undefined && config.revalidate < 0) {
    throw new Error(`Invalid revalidate value: ${config.revalidate}. Must be >= 0`)
  }
}
