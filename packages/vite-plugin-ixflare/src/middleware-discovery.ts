/**
 * @module middleware-discovery
 * @description Middleware file discovery and hierarchy tree building
 * @node-only
 */

import { readFile } from 'node:fs/promises'
import { relative, dirname, sep } from 'node:path'
import fg from 'fast-glob'

export interface MiddlewareNode {
  file: string // Relative path: api/_middleware.ts
  parentDir: string // Parent directory: api
  depth: number // Nesting depth: 0 for root, 1+ for nested
  isArray: boolean // True if middleware exports array, false for single
}

/**
 * Detect if middleware export is an array or single middleware
 * Handles both formats:
 * - export const middleware = [...]
 * - export const middleware: Middleware[] = [...]
 * - export const middleware = createMiddleware(...)
 */
function detectArrayExport(content: string): boolean {
  // Match: export const middleware = [...] or export const middleware: Type = [...]
  // Use word boundary to avoid matching middlewareConfig, middlewareFactory, etc.
  const arrayPattern = /export\s+const\s+middleware\b\s*(?::\s*[^=]+)?\s*=\s*\[/
  return arrayPattern.test(content)
}

/**
 * Discover all middleware files in routes directory
 * Middleware are files named _middleware.tsx, _middleware.ts, _middleware.jsx, or _middleware.js
 */
export async function discoverMiddleware(routesDir: string): Promise<MiddlewareNode[]> {
  // Find all _middleware files
  const files = await fg(['**/_middleware.{ts,tsx,js,jsx}'], {
    cwd: routesDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.*'],
    concurrency: 10,
  })

  const middlewares: MiddlewareNode[] = []

  for (const file of files) {
    const relativePath = relative(routesDir, file)
    const parentDir = dirname(relativePath)

    // Calculate depth: count directory separators
    // Root (_middleware.ts) = depth 0
    // api/_middleware.ts = depth 1
    // api/admin/_middleware.ts = depth 2
    const depth = parentDir === '.' ? 0 : parentDir.split(sep).length

    // Detect if middleware exports array or single middleware
    const content = await readFile(file, 'utf-8')
    const isArray = detectArrayExport(content)

    middlewares.push({
      file: relativePath.replace(/\\/g, '/'), // Normalize Windows paths
      parentDir: parentDir === '.' ? '' : parentDir.replace(/\\/g, '/'),
      depth,
      isArray,
    })
  }

  return middlewares
}

/**
 * Extract middleware chain for a specific route
 * Returns middleware files from outermost (root) to innermost
 *
 * @param routeFile - Route file path (relative to routes dir)
 * @param middlewares - All discovered middlewares
 * @returns Array of middleware file paths in nesting order (root → child)
 */
export function extractMiddlewareChain(routeFile: string, middlewares: MiddlewareNode[]): string[] {
  // Normalize the route file path first (convert backslashes to forward slashes)
  const normalizedRouteFile = routeFile.replace(/\\/g, '/')
  const routeDir = dirname(normalizedRouteFile)
  const routeDirSegments = routeDir === '.' ? [] : routeDir.split('/')

  // Find all middlewares that are ancestors of this route
  const applicableMiddlewares = middlewares.filter((middleware) => {
    // Root middleware applies to all routes
    if (middleware.parentDir === '') {
      return true
    }

    // Check if middleware's directory is a parent of route's directory
    const middlewareSegments = middleware.parentDir.split('/')

    // Middleware must not be deeper than route
    if (middlewareSegments.length > routeDirSegments.length) {
      return false
    }

    // Check if all middleware segments match route segments
    return middlewareSegments.every((seg, i) => seg === routeDirSegments[i])
  })

  // Sort by depth (outermost first: root → intermediate → innermost)
  const sortedMiddlewares = applicableMiddlewares.sort((a, b) => a.depth - b.depth)

  return sortedMiddlewares.map((middleware) => middleware.file)
}
