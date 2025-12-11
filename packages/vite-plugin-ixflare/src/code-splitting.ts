/**
 * @module code-splitting
 * @description Route-based code splitting configuration for Vite/Rollup
 * @node-only
 *
 * Creates a manualChunks function that splits routes into separate chunks
 * for optimal loading performance and caching.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { ixflare } from 'vite-plugin-ixflare'
 * import { createRouteChunks } from 'vite-plugin-ixflare/code-splitting'
 *
 * export default defineConfig({
 *   plugins: [ixflare()],
 *   build: {
 *     rollupOptions: {
 *       output: {
 *         manualChunks: createRouteChunks('src/routes')
 *       }
 *     }
 *   }
 * })
 * ```
 */

import type { ManualChunksOption, GetManualChunk } from 'rollup'

/**
 * Type for the manualChunks function
 * Takes a module ID and returns a chunk name or undefined
 * Compatible with Rollup's GetManualChunk type
 */
export type ManualChunksFunction = GetManualChunk

/**
 * Create a manualChunks function for route-based code splitting
 *
 * This function analyzes module IDs during the build and assigns them
 * to named chunks based on their location:
 * - Route files → route-specific chunks (e.g., 'route-index', 'route-about')
 * - React/React-DOM → 'react-vendor' chunk (stable for caching)
 * - Other node_modules → 'vendor' chunk
 * - Framework code → default chunk
 *
 * @param routesDir - Routes directory path (e.g., 'src/routes')
 * @returns manualChunks function for Vite/Rollup configuration
 *
 * @example
 * ```typescript
 * const manualChunks = createRouteChunks('src/routes')
 *
 * // Module assignment examples:
 * manualChunks('/project/src/routes/index.tsx') // → 'route-index'
 * manualChunks('/project/src/routes/about.tsx') // → 'route-about'
 * manualChunks('/project/src/routes/blog/[slug].tsx') // → 'route-blog-_slug_'
 * manualChunks('/project/node_modules/react-dom/...') // → 'react-vendor'
 * manualChunks('/project/node_modules/zod/...') // → 'vendor'
 * ```
 */
export function createRouteChunks(routesDir: string): ManualChunksFunction {
  // Normalize routes directory path for cross-platform compatibility
  const normalizedRoutesDir = routesDir.replace(/\\/g, '/')

  return (id: string, _meta): string | undefined => {
    // Normalize module ID for cross-platform compatibility
    const normalizedId = id.replace(/\\/g, '/')

    // Vendor chunks - stable for long-term caching
    if (normalizedId.includes('node_modules')) {
      // Separate React chunk for better caching
      // React/React-DOM rarely change, so they get their own chunk
      if (normalizedId.includes('react-dom') || normalizedId.includes('react/')) {
        return 'react-vendor'
      }

      // All other dependencies in vendor chunk
      return 'vendor'
    }

    // Route chunks - one chunk per route file
    if (normalizedId.includes(normalizedRoutesDir)) {
      // Extract relative path from routes directory
      const parts = normalizedId.split(normalizedRoutesDir)
      if (parts.length < 2) {
        return undefined
      }

      const relativePath = parts[1]

      // Clean path for chunk name:
      // - Remove leading slash
      // - Remove file extension
      // - Replace path separators with dashes
      // - Convert dynamic segments: [id] → _id_, [...slug] → _slug_
      const chunkName = relativePath
        .replace(/^\//, '') // Remove leading slash
        .replace(/\.\w+$/, '') // Remove extension (.tsx, .ts, etc.)
        .replace(/[/\\]/g, '-') // Path separators → dashes
        .replace(/\[\.\.\.([^\]]+)\]/g, '_$1_') // [...param] → _param_
        .replace(/\[([^\]]+)\]/g, '_$1_') // [param] → _param_

      // Return chunk name with 'route-' prefix
      // Handle index files specially
      return `route-${chunkName || 'index'}`
    }

    // Everything else goes to default chunk
    return undefined
  }
}

/**
 * Options for code splitting configuration
 */
export interface CodeSplittingOptions {
  /** Routes directory for chunk splitting (default: 'src/routes') */
  routesDir?: string
  /** Enable code splitting (default: true) */
  enabled?: boolean
  /** Custom manualChunks function to merge with route-based splitting */
  customChunks?: ManualChunksOption
}

/**
 * Create complete Rollup configuration with code splitting
 *
 * This is a convenience function that generates the full rollupOptions
 * configuration including manualChunks for route-based splitting.
 *
 * @param options - Code splitting configuration options
 * @returns Rollup configuration object
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * export default defineConfig({
 *   plugins: [ixflare()],
 *   build: {
 *     rollupOptions: createRollupConfig({
 *       routesDir: 'src/routes',
 *       enabled: true
 *     })
 *   }
 * })
 * ```
 */
export function createRollupConfig(options: CodeSplittingOptions = {}) {
  const { routesDir = 'src/routes', enabled = true, customChunks } = options

  // If disabled, return empty config or just custom chunks
  if (!enabled) {
    return customChunks ? { output: { manualChunks: customChunks } } : {}
  }

  const routeChunks = createRouteChunks(routesDir)

  // Merge custom chunks with route-based chunks
  const manualChunks: ManualChunksFunction =
    typeof customChunks === 'function'
      ? (id: string, meta) => {
          // Try custom chunks first, fall back to route chunks
          const customChunk = customChunks(id, meta)
          return customChunk || routeChunks(id, meta)
        }
      : routeChunks

  return {
    output: {
      manualChunks,
      // Add content hash to chunk names for cache busting
      chunkFileNames: 'chunks/[name]-[hash].js',
      // Add content hash to entry file names
      entryFileNames: 'entries/[name]-[hash].js',
    },
  }
}
