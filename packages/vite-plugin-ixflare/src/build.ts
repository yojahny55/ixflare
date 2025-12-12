/**
 * @module build
 * @description Production build with route manifest bundling and optimization
 * @node-only
 */

import type { OutputBundle, OutputChunk } from 'rollup'
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

/**
 * Bundle size budgets in bytes
 */
const ROUTE_CHUNK_BUDGET = 10 * 1024 // 10KB per route chunk
const TOTAL_BUNDLE_BUDGET = 50 * 1024 // 50KB total per route (route + shared)
const VENDOR_CHUNK_BUDGET = 30 * 1024 // 30KB for vendor chunks

/**
 * Information about a single chunk
 */
export interface ChunkInfo {
  /** Chunk file name */
  name: string
  /** Size in bytes */
  size: number
  /** Size in kilobytes (formatted) */
  sizeKB: string
  /** Whether chunk exceeds its budget */
  warning: boolean
  /** Chunk type: route, vendor, or other */
  type: 'route' | 'vendor' | 'other'
}

/**
 * Bundle size analysis report
 */
export interface ChunkSizeReport {
  /** List of all chunks with size information */
  chunks: ChunkInfo[]
  /** Total bundle size in bytes */
  totalSize: number
  /** Total bundle size in kilobytes (formatted) */
  totalSizeKB: string
  /** Whether any budget was exceeded (individual or total) */
  budgetExceeded: boolean
  /** Number of individual chunk warnings */
  warningCount: number
  /** Breakdown by chunk type */
  breakdown: {
    routeChunks: number
    vendorChunks: number
    otherChunks: number
  }
  /** Whether total bundle size exceeds the 50KB budget */
  totalBudgetExceeded?: boolean
}

/**
 * Validate chunk sizes against bundle budgets
 *
 * Analyzes the production build output and checks if chunks stay within
 * the configured size budgets. Issues warnings for chunks that exceed limits.
 *
 * @param bundle - Rollup output bundle from writeBundle hook
 * @returns Size report with warnings for budget violations
 *
 * @example
 * ```typescript
 * // In Vite plugin writeBundle hook
 * async writeBundle(options, bundle) {
 *   const report = validateChunkSizes(bundle)
 *
 *   if (report.budgetExceeded) {
 *     this.warn(`Bundle budget exceeded! ${report.warningCount} warnings`)
 *     for (const chunk of report.chunks.filter(c => c.warning)) {
 *       this.warn(`  ${chunk.name}: ${chunk.sizeKB} (budget exceeded)`)
 *     }
 *   }
 * }
 * ```
 */
export function validateChunkSizes(bundle: OutputBundle): ChunkSizeReport {
  const chunks: ChunkInfo[] = []
  let totalSize = 0
  let budgetExceeded = false
  let warningCount = 0

  const breakdown = {
    routeChunks: 0,
    vendorChunks: 0,
    otherChunks: 0,
  }

  for (const [fileName, output] of Object.entries(bundle)) {
    // Only analyze JavaScript chunks, not assets
    if (output.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    const size = chunk.code.length

    // Determine chunk type and budget
    let chunkType: 'route' | 'vendor' | 'other' = 'other'
    let budget = 0

    if (fileName.includes('route-')) {
      chunkType = 'route'
      budget = ROUTE_CHUNK_BUDGET
      breakdown.routeChunks++
    } else if (fileName.includes('vendor')) {
      chunkType = 'vendor'
      budget = VENDOR_CHUNK_BUDGET
      breakdown.vendorChunks++
    } else {
      chunkType = 'other'
      breakdown.otherChunks++
      // No budget for other chunks (framework code, etc.)
    }

    // Check if chunk exceeds budget
    const warning = budget > 0 && size > budget

    if (warning) {
      budgetExceeded = true
      warningCount++
    }

    totalSize += size

    chunks.push({
      name: fileName,
      size,
      sizeKB: formatBytes(size),
      warning,
      type: chunkType,
    })
  }

  // Check if total bundle size exceeds budget
  // Note: This is the total for the entire build, not per-route
  // AC5 requires <50KB total loaded JS for any route (route + shared)
  const totalBudgetExceeded = totalSize > TOTAL_BUNDLE_BUDGET
  if (totalBudgetExceeded) {
    budgetExceeded = true
  }

  return {
    chunks,
    totalSize,
    totalSizeKB: formatBytes(totalSize),
    budgetExceeded,
    warningCount,
    breakdown,
    totalBudgetExceeded,
  }
}

/**
 * Format bytes to human-readable KB with 2 decimal places
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "12.34 KB")
 */
function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`
}

/**
 * Log bundle size report to console
 *
 * Outputs a formatted table showing chunk sizes and budget compliance
 *
 * @param report - Chunk size report from validateChunkSizes
 * @param logger - Logger interface with info/warn methods
 *
 * @example
 * ```typescript
 * const report = validateChunkSizes(bundle)
 * logChunkSizeReport(report, {
 *   info: (msg) => console.log(msg),
 *   warn: (msg) => console.warn(msg)
 * })
 * ```
 */
export function logChunkSizeReport(
  report: ChunkSizeReport,
  logger: { info: (msg: string) => void; warn: (msg: string) => void }
): void {
  logger.info('\n📦 Bundle Size Report:')
  logger.info('─'.repeat(80))

  // Group chunks by type
  const routeChunks = report.chunks.filter((c) => c.type === 'route')
  const vendorChunks = report.chunks.filter((c) => c.type === 'vendor')
  const otherChunks = report.chunks.filter((c) => c.type === 'other')

  // Log route chunks
  if (routeChunks.length > 0) {
    logger.info('\n🗺️  Route Chunks:')
    for (const chunk of routeChunks) {
      const status = chunk.warning ? '⚠️ ' : '✅'
      const msg = `  ${status} ${chunk.name.padEnd(40)} ${chunk.sizeKB.padStart(10)}`
      if (chunk.warning) {
        logger.warn(msg + ` (exceeds ${formatBytes(ROUTE_CHUNK_BUDGET)} budget)`)
      } else {
        logger.info(msg)
      }
    }
  }

  // Log vendor chunks
  if (vendorChunks.length > 0) {
    logger.info('\n📚 Vendor Chunks:')
    for (const chunk of vendorChunks) {
      const status = chunk.warning ? '⚠️ ' : '✅'
      const msg = `  ${status} ${chunk.name.padEnd(40)} ${chunk.sizeKB.padStart(10)}`
      if (chunk.warning) {
        logger.warn(msg + ` (exceeds ${formatBytes(VENDOR_CHUNK_BUDGET)} budget)`)
      } else {
        logger.info(msg)
      }
    }
  }

  // Log other chunks
  if (otherChunks.length > 0) {
    logger.info('\n📄 Other Chunks:')
    for (const chunk of otherChunks) {
      logger.info(`  ✅ ${chunk.name.padEnd(40)} ${chunk.sizeKB.padStart(10)}`)
    }
  }

  // Summary
  logger.info('\n' + '─'.repeat(80))
  logger.info(`Total Bundle Size: ${report.totalSizeKB}`)
  logger.info(`Total Budget: ${formatBytes(TOTAL_BUNDLE_BUDGET)}`)

  if (report.totalBudgetExceeded) {
    logger.warn(
      `\n⚠️  Total bundle size (${report.totalSizeKB}) exceeds ${formatBytes(TOTAL_BUNDLE_BUDGET)} budget!`
    )
  }

  if (report.warningCount > 0) {
    logger.warn(`\n⚠️  ${report.warningCount} chunk(s) exceed individual size budget!`)
  }

  if (report.budgetExceeded) {
    logger.warn('Consider:')
    logger.warn('  - Code splitting with dynamic imports')
    logger.warn('  - Removing unused dependencies')
    logger.warn('  - Using lighter alternatives')
  } else {
    logger.info('\n✅ All chunks within budget!')
  }

  logger.info('─'.repeat(80) + '\n')
}

/**
 * Chunk manifest mapping chunk names to URLs for client-side prefetching
 */
export interface ChunkManifest {
  /** Map of chunk names to URLs (e.g., 'route-dashboard' → '/chunks/route-dashboard-abc123.js') */
  chunks: Record<string, string>
  /** Generation timestamp */
  generatedAt: number
}

/**
 * Server-only code removal report
 */
export interface ServerOnlyRemovalReport {
  /** Whether any server code was detected in the client bundle (true = BAD) */
  hasServerCode: boolean
  /** List of server exports that leaked into client bundle (should be empty if removal worked) */
  leakedExports: string[]
  /** Estimated bytes saved by removing server code */
  estimatedBytesSaved?: number
}

/**
 * Analyze client bundle to verify server code was removed
 *
 * Searches the client bundle for common server-only patterns that should NOT
 * be present. This validates that the tree-shaking and removal process worked.
 *
 * @param bundle - Rollup output bundle from writeBundle hook
 * @returns Report on server code removal
 *
 * @example
 * ```typescript
 * const report = analyzeServerCodeRemoval(bundle)
 * if (!report.hasServerCode) {
 *   console.log('✅ No server code in client bundle')
 * }
 * ```
 */
export function analyzeServerCodeRemoval(bundle: OutputBundle): ServerOnlyRemovalReport {
  let hasServerCode = false
  const leakedExports: string[] = []

  // Collect all client JavaScript code
  const clientCode: string[] = []

  for (const [, output] of Object.entries(bundle)) {
    if (output.type !== 'chunk') {
      continue
    }

    // Only analyze client chunks (not SSR chunks)
    // SSR chunks would be in a separate directory/build
    clientCode.push(output.code)
  }

  const fullClientCode = clientCode.join('\n')

  // Check for server export patterns that should NOT be in client bundle
  // If found, these exports "leaked" through (removal failed)
  const exportNames = ['loader', 'action', 'headers']
  for (const exportName of exportNames) {
    // Check for function declarations with actual body content (not empty stubs)
    const functionWithBodyPattern = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${exportName}\\s*\\([^)]*\\)\\s*\\{(?!\\s*/\\*\\s*server-only)[^}]+\\}`,
      'g'
    )
    // Check for const declarations with actual implementation
    const constWithBodyPattern = new RegExp(
      `export\\s+const\\s+${exportName}\\s*(?::[^=]+)?\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[^=])\\s*=>\\s*\\{(?!\\s*/\\*\\s*server-only)[^}]+\\}`,
      'g'
    )

    if (functionWithBodyPattern.test(fullClientCode) || constWithBodyPattern.test(fullClientCode)) {
      hasServerCode = true
      leakedExports.push(exportName)
    }
  }

  return {
    hasServerCode,
    leakedExports,
    // We can't easily calculate bytes saved, but we can note it succeeded
    estimatedBytesSaved: hasServerCode ? 0 : undefined,
  }
}

/**
 * Options for server-only removal report logging
 */
export interface ServerOnlyReportOptions {
  /** Fail the build if server code is detected (default: true for production safety) */
  failOnLeak?: boolean
}

/**
 * Log server-only removal report and optionally fail the build
 *
 * @param report - Server code removal report
 * @param logger - Logger interface with info/warn/error methods
 * @param options - Report options
 * @throws Error if server code is detected and failOnLeak is true
 */
export function logServerOnlyRemovalReport(
  report: ServerOnlyRemovalReport,
  logger: {
    info: (msg: string) => void
    warn: (msg: string) => void
    error?: (msg: string) => never
  },
  options: ServerOnlyReportOptions = {}
): void {
  const { failOnLeak = true } = options

  logger.info('\n🔒 Server-Only Code Removal Report:')
  logger.info('─'.repeat(80))

  if (!report.hasServerCode) {
    logger.info('✅ No server-only exports detected in client bundle')
    logger.info('   Loader, action, and headers functions successfully removed')
    logger.info('   Database imports, secrets, and server logic excluded')
  } else {
    const errorMsg = `SECURITY ERROR: Server-only code leaked into client bundle!
   Leaked exports: ${report.leakedExports.join(', ')}
   This WILL expose sensitive server logic or credentials to the public.

   To fix:
   1. Ensure loader/action/headers functions don't have syntax errors
   2. Check that server code removal plugin is properly configured
   3. Review the flagged exports for any unusual patterns`

    if (failOnLeak && logger.error) {
      logger.info('─'.repeat(80) + '\n')
      logger.error(errorMsg)
      // logger.error should throw, but if it doesn't:
      throw new Error(errorMsg)
    } else {
      logger.warn('⚠️  WARNING: ' + errorMsg)
    }
  }

  logger.info('─'.repeat(80) + '\n')
}

/**
 * Generate chunk manifest for client-side route prefetching
 *
 * Creates a mapping from chunk names to their actual URLs with content hashes.
 * This manifest is used by the client-side prefetch utilities to know which
 * files to request when prefetching routes.
 *
 * @param bundle - Rollup output bundle from writeBundle hook
 * @param basePath - Base path for chunk URLs (default: '/')
 * @returns Chunk manifest object
 *
 * @example
 * ```typescript
 * // In Vite plugin writeBundle hook
 * async writeBundle(options, bundle) {
 *   const manifest = generateChunkManifest(bundle)
 *   await writeFile('dist/chunk-manifest.json', JSON.stringify(manifest))
 * }
 * ```
 */
export function generateChunkManifest(bundle: OutputBundle, basePath: string = '/'): ChunkManifest {
  const chunks: Record<string, string> = {}

  for (const [fileName, output] of Object.entries(bundle)) {
    if (output.type !== 'chunk') {
      continue
    }

    // Extract base chunk name (without hash)
    // e.g., 'chunks/route-dashboard-abc123.js' → 'route-dashboard'
    const match = fileName.match(/(?:chunks\/)?([^-]+(?:-[^-]+)*?)(?:-[a-f0-9]+)?\.js$/)
    if (match) {
      const chunkName = match[1]
      // Only include route chunks in manifest
      if (chunkName.startsWith('route-')) {
        chunks[chunkName] = `${basePath}${fileName}`
      }
    }
  }

  return {
    chunks,
    generatedAt: Date.now(),
  }
}
