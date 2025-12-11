/**
 * @module utils/chunk-naming
 * @description Shared utilities for consistent chunk naming between build and client
 *
 * This module provides a unified chunk naming strategy that ensures the chunk names
 * generated during build (from file paths) match those requested during client-side
 * prefetching (from URL paths).
 *
 * @example
 * ```typescript
 * // Build-time (from file path)
 * filePathToChunkName('/project/src/routes/users/[id].tsx', 'src/routes')
 * // → 'route-users-_id_'
 *
 * // Client-side (from URL path)
 * routePathToChunkName('/users/:id')
 * // → 'route-users-_id_'
 * ```
 */

/**
 * Convert a file path from the routes directory to a chunk name.
 * Used during build-time by the Vite/Rollup manualChunks function.
 *
 * @param filePath - Full path to the route file (e.g., '/project/src/routes/about.tsx')
 * @param routesDir - Routes directory path (e.g., 'src/routes')
 * @returns Chunk name (e.g., 'route-about') or undefined if not a route file
 *
 * @example
 * ```typescript
 * filePathToChunkName('/project/src/routes/index.tsx', 'src/routes')
 * // → 'route-index'
 *
 * filePathToChunkName('/project/src/routes/blog/[slug].tsx', 'src/routes')
 * // → 'route-blog-_slug_'
 * ```
 */
export function filePathToChunkName(filePath: string, routesDir: string): string | undefined {
  // Normalize both paths for cross-platform compatibility
  const normalizedPath = filePath.replace(/\\/g, '/')
  const normalizedRoutesDir = routesDir.replace(/\\/g, '/')

  // Check if this is a route file
  if (!normalizedPath.includes(normalizedRoutesDir)) {
    return undefined
  }

  // Extract relative path from routes directory
  const parts = normalizedPath.split(normalizedRoutesDir)
  if (parts.length < 2) {
    return undefined
  }

  const relativePath = parts[1]

  // Transform path to chunk name
  const baseName = relativePath
    .replace(/^\//, '') // Remove leading slash
    .replace(/\.\w+$/, '') // Remove extension (.tsx, .ts, etc.)

  return pathSegmentsToChunkName(baseName)
}

/**
 * Convert a URL route path to a chunk name.
 * Used during client-side prefetching to find the correct chunk.
 *
 * Supports both file-based route syntax and URL parameter syntax:
 * - File-based: `/users/[id]` → `route-users-_id_`
 * - URL params: `/users/:id` → `route-users-_id_`
 * - Catch-all: `/docs/[...slug]` or `/docs/*` → `route-docs-_slug_` or `route-docs-_`
 *
 * @param routePath - Route path (e.g., '/dashboard', '/users/:id')
 * @returns Chunk name (e.g., 'route-dashboard', 'route-users-_id_')
 *
 * @example
 * ```typescript
 * routePathToChunkName('/dashboard')
 * // → 'route-dashboard'
 *
 * routePathToChunkName('/users/:id')
 * // → 'route-users-_id_'
 *
 * routePathToChunkName('/blog/[slug]')
 * // → 'route-blog-_slug_'
 * ```
 */
export function routePathToChunkName(routePath: string): string {
  // Remove leading slash and transform URL param syntax to internal format
  const baseName = routePath
    .replace(/^\//, '') // Remove leading slash
    .replace(/:([^/]+)/g, '[$1]') // :param → [param] (normalize URL syntax)
    .replace(/\*/g, '[...]') // * → [...] (normalize catch-all)

  return pathSegmentsToChunkName(baseName)
}

/**
 * Internal function to convert path segments to chunk name.
 * Handles the common transformations for both file paths and URL paths.
 *
 * @param baseName - Path segments without leading slash or extension
 * @returns Chunk name with 'route-' prefix
 *
 * @internal
 */
function pathSegmentsToChunkName(baseName: string): string {
  const chunkName = baseName
    .replace(/[/\\]/g, '-') // Path separators → dashes
    .replace(/\[\.\.\.([^\]]+)\]/g, '_$1_') // [...param] → _param_
    .replace(/\[\.\.\.\]/g, '_') // [...] → _ (anonymous catch-all)
    .replace(/\[([^\]]+)\]/g, '_$1_') // [param] → _param_

  // Return chunk name with 'route-' prefix
  // Handle index files specially
  return `route-${chunkName || 'index'}`
}
