/**
 * @module core/layout-loader
 * @description Parallel layout loader execution
 * @worker-only
 */

import type { LayoutLoaderArgs } from '../types/handlers'

/**
 * Layout loader function signature
 */
export type LayoutLoaderFunction<TData = unknown, Env = Record<string, unknown>> = (
  args: LayoutLoaderArgs<Record<string, string>, Env>
) => Promise<TData> | TData

/**
 * Execute layout loaders in parallel with page loader
 *
 * This is CRITICAL for performance - running loaders in parallel avoids
 * waterfall delays. Total load time is max(loader times), not sum.
 *
 * @param layoutLoaders - Array of layout loader functions to execute
 * @param pageLoader - Optional page loader function
 * @param args - Arguments to pass to all loaders (request, params, env, etc.)
 * @returns Tuple of [layoutData[], pageData] where layoutData matches order of layoutLoaders
 *
 * @example
 * ```typescript
 * const [layoutData, pageData] = await executeLoaders(
 *   [rootLoader, dashboardLoader],
 *   pageLoader,
 *   { request, params, env, ctx, query, url, method, headers }
 * )
 * // layoutData[0] = root layout data
 * // layoutData[1] = dashboard layout data
 * // pageData = page data
 * ```
 */
export async function executeLoaders<Env = Record<string, unknown>>(
  layoutLoaders: LayoutLoaderFunction<unknown, Env>[],
  pageLoader: LayoutLoaderFunction<unknown, Env> | undefined,
  args: LayoutLoaderArgs<Record<string, string>, Env>
): Promise<[unknown[], unknown]> {
  // Execute ALL loaders in parallel using Promise.all
  const loaderPromises: Promise<unknown>[] = []

  // Add layout loaders
  for (const loader of layoutLoaders) {
    loaderPromises.push(Promise.resolve(loader(args)))
  }

  // Add page loader at the end
  if (pageLoader) {
    loaderPromises.push(Promise.resolve(pageLoader(args)))
  }

  // Wait for all loaders in parallel
  const results = await Promise.all(loaderPromises)

  // Split results: all but last are layout data, last is page data
  const layoutData = results.slice(0, layoutLoaders.length)
  const pageData = pageLoader ? results[layoutLoaders.length] : undefined

  return [layoutData, pageData]
}

/**
 * Execute only layout loaders (no page loader)
 *
 * @param layoutLoaders - Array of layout loader functions to execute
 * @param args - Arguments to pass to all loaders
 * @returns Array of layout data matching order of layoutLoaders
 */
export async function executeLayoutLoaders<Env = Record<string, unknown>>(
  layoutLoaders: LayoutLoaderFunction<unknown, Env>[],
  args: LayoutLoaderArgs<Record<string, string>, Env>
): Promise<unknown[]> {
  const loaderPromises = layoutLoaders.map((loader) => Promise.resolve(loader(args)))
  return Promise.all(loaderPromises)
}
