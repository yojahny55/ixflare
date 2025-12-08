/**
 * @module core/layout-loader
 * @description Parallel layout loader execution
 * @worker-only
 */

import type { LayoutLoaderArgs } from '@/types/handlers'
import { NotFoundError, AuthError, ForbiddenError, ValidationError, AppError } from '@/errors'

/**
 * Layout loader function signature
 */
export type LayoutLoaderFunction<TData = unknown, Env = Record<string, unknown>> = (
  args: LayoutLoaderArgs<Record<string, string>, Env>
) => Promise<TData> | TData

/**
 * Error thrown during layout loader execution
 * Preserves the original error and adds context about which layout failed
 */
export class LayoutLoaderError extends AppError {
  constructor(
    public readonly layoutIndex: number,
    public readonly layoutFile: string | undefined,
    public readonly originalError: Error
  ) {
    super(
      'LAYOUT.LOADER_FAILED',
      `Layout loader failed${layoutFile ? ` (${layoutFile})` : ` at index ${layoutIndex}`}: ${originalError.message}`,
      originalError instanceof AppError ? originalError.status : 500
    )
    this.name = 'LayoutLoaderError'
  }
}

/**
 * Convert known error types to appropriate HTTP responses
 * This integrates with the typed error classes from the architecture
 *
 * Error response format per architecture spec:
 * { error: { code, message, status, timestamp } }
 */
export function getLoaderErrorResponse(error: Error): Response {
  if (error instanceof NotFoundError) {
    return Response.json(
      { error: { code: error.code, message: error.message, status: 404, timestamp: Date.now() } },
      { status: 404 }
    )
  }
  if (error instanceof AuthError) {
    return Response.json(
      { error: { code: error.code, message: error.message, status: 401, timestamp: Date.now() } },
      { status: 401 }
    )
  }
  if (error instanceof ForbiddenError) {
    return Response.json(
      { error: { code: error.code, message: error.message, status: 403, timestamp: Date.now() } },
      { status: 403 }
    )
  }
  // ValidationError must come before AppError since it extends AppError
  if (error instanceof ValidationError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          status: 422,
          timestamp: Date.now(),
          errors: error.errors,
        },
      },
      { status: 422 }
    )
  }
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
          timestamp: Date.now(),
        },
      },
      { status: error.status }
    )
  }
  // Unknown error - return 500
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500,
        timestamp: Date.now(),
      },
    },
    { status: 500 }
  )
}

/**
 * Execute layout loaders in parallel with page loader
 *
 * This is CRITICAL for performance - running loaders in parallel avoids
 * waterfall delays. Total load time is max(loader times), not sum.
 *
 * @param layoutLoaders - Array of layout loader functions to execute
 * @param pageLoader - Optional page loader function
 * @param args - Arguments to pass to all loaders (request, params, env, etc.)
 * @param layoutFiles - Optional array of layout file paths for error context
 * @returns Tuple of [layoutData[], pageData] where layoutData matches order of layoutLoaders
 * @throws LayoutLoaderError if any loader fails (preserves original error type for handling)
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
  args: LayoutLoaderArgs<Record<string, string>, Env>,
  layoutFiles?: string[]
): Promise<[unknown[], unknown]> {
  // Execute ALL loaders in parallel using Promise.all
  const loaderPromises: Promise<unknown>[] = []

  // Add layout loaders with error wrapping for better context
  for (let i = 0; i < layoutLoaders.length; i++) {
    const loader = layoutLoaders[i]
    const layoutFile = layoutFiles?.[i]
    loaderPromises.push(
      Promise.resolve(loader(args)).catch((error: Error) => {
        throw new LayoutLoaderError(i, layoutFile, error)
      })
    )
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
