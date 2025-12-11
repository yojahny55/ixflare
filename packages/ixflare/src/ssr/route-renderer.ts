/**
 * @module ssr/route-renderer
 * @description Strategy-based rendering dispatcher for routes
 * @packageDocumentation
 */

import type { RouteConfig, CacheConfig, RenderOptions } from './types'
import { renderToString, renderToStream } from './render'

/**
 * Generate Cache-Control headers from cache config
 * @param cache Cache configuration
 * @returns Headers object with Cache-Control
 * @example
 * ```typescript
 * const headers = generateCacheHeaders({
 *   maxAge: 60,
 *   staleWhileRevalidate: 300
 * })
 * // Returns: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
 * ```
 */
export function generateCacheHeaders(cache: CacheConfig): Record<string, string> {
  const directives: string[] = ['public']

  if (cache.maxAge !== undefined && cache.maxAge >= 0) {
    directives.push(`max-age=${cache.maxAge}`)
  }

  if (cache.staleWhileRevalidate !== undefined && cache.staleWhileRevalidate >= 0) {
    directives.push(`stale-while-revalidate=${cache.staleWhileRevalidate}`)
  }

  return {
    'Cache-Control': directives.join(', '),
  }
}

/**
 * Render component with SSR strategy
 * Uses existing renderToString or renderToStream based on options
 * @param component React component to render
 * @param options Rendering options
 * @param config Route configuration (for cache headers)
 * @returns Response with rendered HTML
 * @example
 * ```typescript
 * const response = await renderSSR(
 *   <App />,
 *   { bootstrapData: { user: { id: 1 } } },
 *   { rendering: 'ssr', cache: { maxAge: 60 } }
 * )
 * ```
 */
export async function renderSSR(
  component: React.ReactElement,
  options: RenderOptions = {},
  config?: RouteConfig
): Promise<Response> {
  // Determine if streaming is requested
  const useStreaming = options.streaming ?? false

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
  }

  // Add cache headers if config specifies caching
  if (config?.cache) {
    const cacheHeaders = generateCacheHeaders(config.cache)
    Object.assign(headers, cacheHeaders)
  }

  if (useStreaming) {
    // Use streaming SSR (returns ReadableStream directly)
    const stream = renderToStream(component, options)

    return new Response(stream, {
      status: 200,
      headers,
    })
  } else {
    // Use string SSR (returns string directly)
    const html = await renderToString(component, options)

    return new Response(html, {
      status: 200,
      headers,
    })
  }
}

/**
 * Render component based on route config strategy
 * Dispatcher that delegates to appropriate rendering function
 * @param component React component to render
 * @param options Rendering options
 * @param config Route configuration
 * @returns Response with rendered content
 * @throws Error if rendering strategy is not implemented
 * @example
 * ```typescript
 * // SSR with cache
 * const response = await renderWithStrategy(
 *   <App />,
 *   { streaming: true },
 *   { rendering: 'ssr', cache: { maxAge: 60 } }
 * )
 *
 * // CSR (handled elsewhere, throws in this function)
 * const response = await renderWithStrategy(<App />, {}, { rendering: 'csr' })
 * // Throws: CSR rendering should be handled by CSR shell generator
 * ```
 */
export async function renderWithStrategy(
  component: React.ReactElement,
  options: RenderOptions = {},
  config?: RouteConfig
): Promise<Response> {
  const strategy = config?.rendering ?? 'ssr'

  switch (strategy) {
    case 'ssr':
      return renderSSR(component, options, config)

    case 'csr':
      throw new Error(
        'CSR rendering should be handled by CSR shell generator, not renderWithStrategy'
      )

    case 'ssg':
      throw new Error('SSG rendering should be handled at build time, not at runtime')

    default:
      throw new Error(`Unknown rendering strategy: ${strategy}`)
  }
}
