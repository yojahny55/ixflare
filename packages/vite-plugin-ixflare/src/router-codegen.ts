/**
 * @module router-codegen
 * @description Route discovery and manifest generation
 * @node-only
 */

import { readFile } from 'node:fs/promises'
import { relative, basename } from 'node:path'
import fg from 'fast-glob'

export interface RouteParam {
  name: string
  type: 'static' | 'dynamic' | 'catch-all'
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface Route {
  path: string
  file: string
  params: RouteParam[]
  handlers: HttpMethod[]
  layout?: string
  middleware?: string[]
}

export interface RouteManifest {
  routes: Route[]
  generatedAt: number
  version: string
}

/**
 * Extract dynamic parameters from a file path
 * Examples:
 * - [id].tsx → [{ name: 'id', type: 'dynamic' }]
 * - [...slug].tsx → [{ name: 'slug', type: 'catch-all' }]
 * - blog/[year]/[month]/[slug].tsx → [{ name: 'year', type: 'dynamic' }, ...]
 */
export function extractDynamicParams(filePath: string): RouteParam[] {
  const params: RouteParam[] = []

  // Match [param] and [...param] patterns
  const regex = /\[\.\.\.([^\]]+)\]|\[([^\]]+)\]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(filePath)) !== null) {
    if (match[1]) {
      // Catch-all [...param]
      params.push({
        name: match[1],
        type: 'catch-all',
      })
    } else if (match[2]) {
      // Dynamic [param]
      params.push({
        name: match[2],
        type: 'dynamic',
      })
    }
  }

  return params
}

/**
 * Parse a route file to extract path, params, and handlers
 */
export async function parseRouteFile(filePath: string, routesDir: string): Promise<Route> {
  const relativePath = relative(routesDir, filePath)

  // Reject files starting with underscore (layouts, middleware)
  if (basename(filePath).startsWith('_')) {
    throw new Error(`Files starting with underscore are not routes: ${relativePath}`)
  }

  // Read file content to detect handlers
  const content = await readFile(filePath, 'utf-8')

  // Detect exported HTTP method handlers
  const handlers: HttpMethod[] = []
  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

  for (const method of methods) {
    const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, 'g')
    if (regex.test(content)) {
      handlers.push(method)
    }
  }

  // Extract dynamic params
  const params = extractDynamicParams(relativePath)

  // Convert file path to route path
  let routePath = relativePath
    .replace(/\\/g, '/') // Normalize Windows paths
    .replace(/\.(tsx?|jsx?)$/, '') // Remove extension
    .replace(/\/index$/, '') // Remove /index
    .replace(/^index$/, '') // Remove standalone index
    .replace(/\[\.\.\.([^\]]+)\]/g, '*') // [...param] → *
    .replace(/\[([^\]]+)\]/g, ':$1') // [param] → :param

  // Ensure proper leading slash
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath
  }

  // Ensure root route is just '/'
  if (routePath === '') {
    routePath = '/'
  }

  return {
    path: routePath,
    file: relativePath,
    params,
    handlers,
  }
}

/**
 * Discover all route files in a directory using fast-glob
 */
export async function discoverRoutes(routesDir: string): Promise<Route[]> {
  // Find all .ts, .tsx, .js, .jsx files, excluding:
  // - Files starting with underscore (_layout, _middleware)
  // - node_modules
  // - Dot files (.gitignore, etc.)
  const files = await fg(['**/*.{ts,tsx,js,jsx}'], {
    cwd: routesDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/_*', '**/.*'],
    concurrency: 10, // High concurrency for performance
  })

  const routes: Route[] = []

  for (const file of files) {
    try {
      const route = await parseRouteFile(file, routesDir)
      routes.push(route)
    } catch (error) {
      // Only ignore expected errors (underscore-prefixed files)
      // Re-throw unexpected errors to aid debugging
      if (error instanceof Error && error.message.includes('underscore')) {
        continue
      }
      // Log unexpected errors but continue processing other files
      console.warn(`[vite-plugin-ixflare] Failed to parse route file: ${file}`, error)
      continue
    }
  }

  return routes
}

/**
 * Normalize a route path by replacing dynamic segments with a placeholder
 * This allows detecting conflicts between routes with different param names
 * but same structure (e.g., /blog/:id and /blog/:slug)
 */
function normalizeRoutePath(path: string): string {
  return path
    .replace(/:[^/]+/g, ':param') // Replace all :param with :param
    .replace(/\*/g, '*') // Keep catch-all as-is
}

/**
 * Detect conflicting routes (same path from different files)
 */
export function detectRouteConflicts(routes: Route[]): void {
  const pathMap = new Map<string, Route[]>()

  // Group routes by normalized path
  for (const route of routes) {
    const normalizedPath = normalizeRoutePath(route.path)
    const existing = pathMap.get(normalizedPath) || []
    existing.push(route)
    pathMap.set(normalizedPath, existing)
  }

  // Check for conflicts
  for (const [, routesForPath] of pathMap) {
    if (routesForPath.length > 1) {
      const path = routesForPath[0].path
      const fileList = routesForPath.map(r => `  • ${r.file}`).join('\n')
      throw new Error(
        `Route conflict detected!\nBoth files resolve to ${path}:\n${fileList}\nSolution: Remove one of these files.`
      )
    }
  }
}

/**
 * Generate route manifest from discovered routes
 */
export function generateRouteManifest(routes: Route[]): RouteManifest {
  return {
    routes,
    generatedAt: Date.now(),
    version: '1.0.0',
  }
}
