/**
 * @module build
 * @description Production build with route manifest bundling and optimization
 * @node-only
 */

import {
  discoverRoutes,
  detectRouteConflicts,
  generateRouteManifest,
  type RouteManifest,
  type Route,
} from './router-codegen'
// SSG pre-rendering utilities are available via import from './ssg-prerender'
// They require manual integration with a module loader (e.g., Vite's ssrLoadModule)
// See: packages/vite-plugin-ixflare/src/ssg-prerender.ts
import type { SSGManifest, PrerenderResult } from './ssg-prerender'

export interface BuildConfig {
  routesDir: string
  outputDir: string
  sourceMaps?: boolean
}

export interface BuildResult {
  manifest: RouteManifest
  success: boolean
  sourceMaps?: boolean
  ssgManifest?: SSGManifest
  ssgResults?: PrerenderResult[]
}

/**
 * Build routes for production
 * Discovers routes, detects conflicts, and generates manifest
 */
export async function buildRoutes(config: BuildConfig): Promise<BuildResult> {
  // Discover all routes
  const routes = await discoverRoutes(config.routesDir)

  // Detect conflicts - throws on conflict
  detectRouteConflicts(routes)

  // Generate manifest
  const manifest = generateRouteManifest(routes)

  return {
    manifest,
    success: true,
    sourceMaps: config.sourceMaps,
  }
}

/**
 * Bundle route manifest as importable JavaScript/TypeScript module
 * Generates code that can be imported by the worker
 */
export function bundleManifest(manifest: RouteManifest): string {
  const manifestJson = JSON.stringify(manifest, null, 0)

  return `/**
 * Generated Route Manifest
 * Auto-generated during build - DO NOT EDIT
 */

export const routeManifest = ${manifestJson} as const
`
}

/**
 * Optimize routes for production
 * - Removes duplicates
 * - Sorts by specificity (more specific routes first)
 */
export function optimizeRoutes(manifest: RouteManifest): RouteManifest {
  // Remove duplicates by path
  const uniqueRoutes = new Map<string, Route>()
  for (const route of manifest.routes) {
    uniqueRoutes.set(route.path, route)
  }

  // Sort by specificity
  const sortedRoutes = Array.from(uniqueRoutes.values()).sort((a, b) => {
    // Split paths into segments
    const aSegments = a.path.split('/').filter((s) => s)
    const bSegments = b.path.split('/').filter((s) => s)

    // Longer paths (more segments) come first (more specific)
    if (aSegments.length !== bSegments.length) {
      return bSegments.length - aSegments.length
    }

    // For equal length paths, compare segment by segment
    for (let i = 0; i < aSegments.length; i++) {
      const aSeg = aSegments[i]
      const bSeg = bSegments[i]

      const aStatic = !aSeg.startsWith(':') && aSeg !== '*'
      const bStatic = !bSeg.startsWith(':') && bSeg !== '*'
      const aDynamic = aSeg.startsWith(':')
      const bDynamic = bSeg.startsWith(':')
      const aCatchAll = aSeg === '*'
      const bCatchAll = bSeg === '*'

      // Static segments come before dynamic
      if (aStatic && !bStatic) return -1
      if (!aStatic && bStatic) return 1

      // Dynamic segments come before catch-all
      if (aDynamic && bCatchAll) return -1
      if (aCatchAll && bDynamic) return 1

      // If both static, alphabetical order
      if (aStatic && bStatic && aSeg !== bSeg) {
        return aSeg.localeCompare(bSeg)
      }
    }

    // Alphabetical order as final tiebreaker
    return a.path.localeCompare(b.path)
  })

  return {
    ...manifest,
    routes: sortedRoutes,
  }
}
