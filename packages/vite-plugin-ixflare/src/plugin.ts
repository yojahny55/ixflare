/**
 * @module plugin
 * @description Main Vite plugin for file-based routing
 *
 * This plugin focuses on file-based route discovery and manifest generation.
 * Workers runtime (D1, KV, R2, workerd) is handled by @cloudflare/vite-plugin.
 *
 * Usage:
 * ```typescript
 * import { cloudflare } from '@cloudflare/vite-plugin'
 * import { ixflare } from 'vite-plugin-ixflare'
 *
 * export default defineConfig({
 *   plugins: [
 *     cloudflare(),  // Workers runtime
 *     ixflare(),     // File-based routing
 *   ],
 * })
 * ```
 *
 * See: docs/architecture/adr-001-cloudflare-vite-plugin-integration.md
 */

import { join } from 'node:path'
import { writeFile, mkdir, access, readdir } from 'node:fs/promises'
import type { Plugin, ViteDevServer, ModuleNode } from 'vite'
import type { IxflarePluginOptions } from './types'
import {
  discoverRoutes,
  detectRouteConflicts,
  generateRouteManifest,
  type RouteManifest,
} from './router-codegen'
import { createDevServer, type DevServer } from './dev-server'
import {
  bundleManifest,
  optimizeRoutes,
  validateChunkSizes,
  logChunkSizeReport,
  generateChunkManifest,
  analyzeServerCodeRemoval,
  logServerOnlyRemovalReport,
} from './build'
import {
  setupHMR,
  handleRouteHMR,
  handleIslandHMR,
  handleServerComponentHMR,
} from './hmr'
import { discoverIslands, type DiscoveredIsland } from './island-discovery'
import {
  generateHydrationManifest,
  serializeHydrationManifest,
  type HydrationManifest,
} from './hydration-manifest'
import { createRouteChunks } from './code-splitting'
import {
  transformServerExports,
} from './server-only-removal'

/**
 * Check if a directory contains frontend route files (*.tsx)
 * Used to auto-detect if code splitting should be enabled
 */
async function hasFrontendRoutes(routesDir: string): Promise<boolean> {
  try {
    await access(routesDir)
  } catch {
    // Directory doesn't exist
    return false
  }

  // Recursively check for .tsx files (frontend routes)
  async function checkDir(dir: string): Promise<boolean> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const hasRoutes = await checkDir(join(dir, entry.name))
          if (hasRoutes) return true
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          // Found a .tsx file - this is a frontend route
          return true
        }
      }
    } catch {
      // Ignore errors reading directory
    }
    return false
  }

  return checkDir(routesDir)
}

const VIRTUAL_MODULE_ID = 'virtual:ixflare-routes'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

const VIRTUAL_ISLANDS_ID = 'virtual:ixflare-islands'
const RESOLVED_ISLANDS_ID = '\0' + VIRTUAL_ISLANDS_ID

/**
 * Extracts route path from a file path for HMR targeting.
 *
 * Handles various route file patterns:
 * - /src/routes/index.tsx → /
 * - /src/routes/dashboard/index.tsx → /dashboard
 * - /src/routes/about.tsx → /about
 * - /src/routes/users/[id].tsx → /users/[id]
 * - /src/routes/users/[id]/posts.tsx → /users/[id]/posts
 *
 * @param file - Full file path
 * @param routesDir - Routes directory name (e.g., 'src/routes')
 * @returns Route path (e.g., '/dashboard')
 */
function extractRoutePathFromFile(file: string, routesDir: string): string {
  // Normalize path separators to forward slashes
  const normalizedFile = file.replace(/\\/g, '/')
  const normalizedRoutesDir = routesDir.replace(/\\/g, '/')

  // Split both paths into segments for proper matching
  const fileSegments = normalizedFile.split('/')
  const routesDirSegments = normalizedRoutesDir.split('/').filter(Boolean)

  // Find where routesDir ends in the file path by matching segments
  let routesDirEndIndex = -1

  for (let i = 0; i <= fileSegments.length - routesDirSegments.length; i++) {
    let match = true
    for (let j = 0; j < routesDirSegments.length; j++) {
      if (fileSegments[i + j] !== routesDirSegments[j]) {
        match = false
        break
      }
    }
    if (match) {
      routesDirEndIndex = i + routesDirSegments.length
      break
    }
  }

  if (routesDirEndIndex === -1) {
    return '/'
  }

  // Get segments after routes directory
  const routeSegments = fileSegments.slice(routesDirEndIndex)

  if (routeSegments.length === 0) {
    return '/'
  }

  // Process the last segment (remove extension)
  let lastSegment = routeSegments[routeSegments.length - 1]
  const extIndex = lastSegment.lastIndexOf('.')
  if (extIndex > 0) {
    lastSegment = lastSegment.slice(0, extIndex)
  }
  routeSegments[routeSegments.length - 1] = lastSegment

  // Handle index files - remove 'index' from the path
  if (lastSegment === 'index') {
    routeSegments.pop()
  }

  // Build route path
  if (routeSegments.length === 0) {
    return '/'
  }

  return '/' + routeSegments.join('/')
}

export function ixflarePlugin(options: IxflarePluginOptions = {}): Plugin {
  const routesDir = options.routesDir || 'src/routes'
  const componentsDir = options.componentsDir || 'src/components'
  const hmrEnabled = options.hmr !== false
  // Default to 'auto' - only enable code splitting if frontend routes exist
  const codeSplittingOption = options.codeSplitting ?? 'auto'

  let devServer: DevServer | null = null
  let viteServer: ViteDevServer | null = null
  let routeManifest: RouteManifest | null = null
  let resolvedRoutesDir: string = ''
  let resolvedComponentsDir: string = ''
  let projectRoot: string = ''
  let discoveredIslands: DiscoveredIsland[] = []
  let hydrationManifest: HydrationManifest | null = null
  // Track whether code splitting is actually enabled (resolved from 'auto')
  let codeSplittingEnabled: boolean = false
  // Track build command for transform hook
  let isBuildCommand: boolean = false

  return {
    name: 'vite-plugin-ixflare',

    async config(config, { command }) {
      // Store build command for transform hook
      isBuildCommand = command === 'build'

      // Resolve project root early to check for frontend routes
      const root = config.root || process.cwd()
      const fullRoutesDir = join(root, routesDir)

      // Determine if code splitting should be enabled
      if (codeSplittingOption === 'auto') {
        // Auto-detect: enable only if frontend routes (.tsx files) exist
        codeSplittingEnabled = await hasFrontendRoutes(fullRoutesDir)
        if (!codeSplittingEnabled && command === 'build') {
          // Log for visibility during build
          console.log('[ixflare] No frontend routes detected - code splitting disabled')
        }
      } else {
        codeSplittingEnabled = codeSplittingOption === true
      }

      // Prepare rollupOptions with code splitting if enabled
      const rollupOptions = codeSplittingEnabled
        ? {
            output: {
              manualChunks: createRouteChunks(routesDir),
              // Add content hash to chunk names for cache busting
              chunkFileNames: 'chunks/[name]-[hash].js',
              // Add content hash to entry file names
              entryFileNames: 'entries/[name]-[hash].js',
            },
          }
        : {}

      return {
        ...config,
        build: {
          ...config.build,
          target: 'esnext',
          rollupOptions: {
            ...config.build?.rollupOptions,
            ...rollupOptions,
            output: {
              ...config.build?.rollupOptions?.output,
              ...rollupOptions.output,
            },
          },
        },
      }
    },

    configResolved(config) {
      // Store project root for both dev and build modes
      projectRoot = config.root
      resolvedRoutesDir = join(config.root, routesDir)
      resolvedComponentsDir = join(config.root, componentsDir)
    },

    // Resolve virtual module ID
    resolveId(source, importer) {
      if (source === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
      if (source === VIRTUAL_ISLANDS_ID) {
        return RESOLVED_ISLANDS_ID
      }

      // Server-only boundary enforcement (only during build)
      if (isBuildCommand) {
        // Handle server-only package imports
        if (source === 'server-only') {
          return '\0server-only'
        }

        // Check for .server file imports in client code
        if (source.includes('.server') && importer) {
          const ssr = (this as any).environment?.name === 'ssr' || (this as any).ssr

          // Only enforce boundary during client build
          if (!ssr) {
            const normalizedImporter = importer.replace(/\\/g, '/')

            // Check if the importer is also a server file - that's allowed
            const importerIsServerFile =
              normalizedImporter.includes('.server.ts') ||
              normalizedImporter.includes('.server.tsx') ||
              normalizedImporter.includes('/.server/') ||
              normalizedImporter.includes('\\.server\\')

            if (!importerIsServerFile) {
              // Client code trying to import server-only code - this is an error!
              const importerPath = importer.replace(projectRoot || process.cwd(), '.')

              this.error({
                message: `Cannot import server-only module "${source}" from client code`,
                id: importerPath,
                meta: {
                  suggestion:
                    'Move this import to a loader function or .server.ts file, or mark the importing file with .server.ts extension',
                },
              })
            }
          }
        }
      }

      return null
    },

    // Load virtual module content
    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        if (routeManifest) {
          return bundleManifest(routeManifest)
        }
        // Return empty manifest if not yet initialized
        return `export const routeManifest = { routes: [], generatedAt: ${Date.now()}, version: "1.0.0" };`
      }

      if (id === RESOLVED_ISLANDS_ID) {
        // Generate island registry code with dynamic imports
        if (discoveredIslands.length === 0) {
          return `import { setIslandRegistry } from 'ixflare/client'\nsetIslandRegistry({})`
        }

        const imports = discoveredIslands
          .map((island, index) => `const island_${index} = () => import('${island.filePath}')`)
          .join('\n')

        const registry = discoveredIslands
          .map((island, index) => `  '${island.id}': island_${index}`)
          .join(',\n')

        return `import { setIslandRegistry } from 'ixflare/client'\n\n${imports}\n\nsetIslandRegistry({\n${registry}\n})`
      }

      // Handle server-only module (only during build)
      if (isBuildCommand && id === '\0server-only') {
        const ssr = (this as any).environment?.name === 'ssr' || (this as any).ssr

        // In server build: provide empty module (no-op)
        // In client build: throw error if somehow reached
        if (!ssr) {
          // Build should have failed in resolveId, but add extra safety
          this.error({
            message: 'server-only module imported in client code',
            meta: {
              suggestion:
                'This import should only exist in server code (loaders, .server files)',
            },
          })
        }

        // Return empty export for server builds
        return 'export {}'
      }

      return null
    },

    // Transform hook for server-only code removal
    transform(code, id) {
      // Only apply during build (not dev mode)
      if (isBuildCommand) {
        // Get SSR mode from environment
        const ssr = (this as any).environment?.name === 'ssr' || (this as any).ssr
        return transformServerExports(code, id, routesDir, ssr)
      }
      return null
    },

    async configureServer(server: ViteDevServer) {
      viteServer = server
      // projectRoot, resolvedRoutesDir, resolvedComponentsDir already set in configResolved

      // Setup HMR for route manifest
      if (hmrEnabled) {
        setupHMR(server, { enabled: true })
      }

      // Create dev server with file watching for route changes
      devServer = createDevServer({
        routesDir: resolvedRoutesDir,
        port: server.config.server.port || 5173,
        onRouteChange: async (result) => {
          if (result.regenerateManifest) {
            // Regenerate route manifest
            const routes = await discoverRoutes(resolvedRoutesDir)
            detectRouteConflicts(routes)
            routeManifest = generateRouteManifest(routes)

            // Invalidate the virtual module to trigger HMR
            const virtualModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
            if (virtualModule) {
              server.moduleGraph.invalidateModule(virtualModule)

              // Send HMR update for the virtual module
              server.ws.send({
                type: 'update',
                updates: [
                  {
                    type: 'js-update',
                    path: VIRTUAL_MODULE_ID,
                    acceptedPath: VIRTUAL_MODULE_ID,
                    timestamp: Date.now(),
                  },
                ],
              })
            }

            server.config.logger.info(`[ixflare] Route ${result.event}: ${result.path}`, {
              timestamp: true,
            })
          }
        },
      })

      // Generate initial route manifest
      const routes = await discoverRoutes(resolvedRoutesDir)
      detectRouteConflicts(routes)
      routeManifest = generateRouteManifest(routes)

      // Discover islands
      discoveredIslands = await discoverIslands(resolvedComponentsDir)

      server.config.logger.info(`[ixflare] Discovered ${routes.length} routes`, { timestamp: true })
      server.config.logger.info(`[ixflare] Discovered ${discoveredIslands.length} islands`, {
        timestamp: true,
      })
    },

    async buildStart() {
      // For build mode, we need to generate manifest even without configureServer
      if (!viteServer) {
        // Running in build mode, not dev mode
        // We'll generate manifest in buildEnd when we have access to config
      }
    },

    async buildEnd() {
      // Production build - generate optimized route manifest
      // This runs in both dev and build modes
      if (resolvedRoutesDir) {
        try {
          const routes = await discoverRoutes(resolvedRoutesDir)
          detectRouteConflicts(routes)
          const manifest = generateRouteManifest(routes)

          // Optimize routes for production (sort by specificity)
          routeManifest = optimizeRoutes(manifest)

          this.info(`[ixflare] Built ${routeManifest.routes.length} routes for production`)
        } catch (error) {
          // Route discovery might fail if routesDir doesn't exist yet
          this.warn('[ixflare] Could not discover routes: ' + (error as Error).message)
        }
      }

      // Discover islands for production build
      if (!viteServer && resolvedComponentsDir) {
        try {
          discoveredIslands = await discoverIslands(resolvedComponentsDir)
          this.info(`[ixflare] Discovered ${discoveredIslands.length} islands for production`)
        } catch (error) {
          this.warn('[ixflare] Could not discover islands: ' + (error as Error).message)
        }
      }
    },

    async writeBundle(options, bundle) {
      const outputDir = options.dir || 'dist'

      // Analyze server-only code removal (always run during build)
      if (isBuildCommand) {
        const serverRemovalReport = analyzeServerCodeRemoval(bundle)
        logServerOnlyRemovalReport(serverRemovalReport, {
          info: (msg) => this.info(msg),
          warn: (msg) => this.warn(msg),
        })
      }

      // Validate bundle sizes if code splitting is enabled
      if (codeSplittingEnabled) {
        const report = validateChunkSizes(bundle)
        logChunkSizeReport(report, {
          info: (msg) => this.info(msg),
          warn: (msg) => this.warn(msg),
        })

        // Generate and save chunk manifest for client-side prefetching
        try {
          const chunkManifest = generateChunkManifest(bundle, '/')
          const chunkManifestPath = join(outputDir, 'chunk-manifest.json')
          await mkdir(outputDir, { recursive: true })
          await writeFile(chunkManifestPath, JSON.stringify(chunkManifest, null, 2))
          this.info(
            `[ixflare] Generated chunk manifest with ${Object.keys(chunkManifest.chunks).length} route chunks`
          )
        } catch (error) {
          this.warn('[ixflare] Failed to generate chunk manifest: ' + (error as Error).message)
        }
      }

      // Generate hydration manifest after bundle is written
      if (discoveredIslands.length === 0) {
        return
      }

      // Load Vite's manifest to map source files to output chunks
      try {
        const viteManifestPath = join(outputDir, '.vite', 'manifest.json')

        // Read Vite manifest
        let viteManifestContent: string
        try {
          const { readFile: readFileSync } = await import('node:fs/promises')
          viteManifestContent = await readFileSync(viteManifestPath, 'utf-8')
        } catch {
          // Vite manifest not found - skip hydration manifest generation
          this.warn('[ixflare] Vite manifest not found, skipping hydration manifest generation')
          return
        }

        const viteManifest = JSON.parse(viteManifestContent)

        // Generate hydration manifest - pass projectRoot to convert absolute paths to relative
        hydrationManifest = generateHydrationManifest(discoveredIslands, viteManifest, projectRoot)

        // Write hydration manifest to output directory
        const manifestPath = join(outputDir, 'island-manifest.json')
        await mkdir(join(outputDir), { recursive: true })
        await writeFile(manifestPath, serializeHydrationManifest(hydrationManifest, true))

        this.info(
          `[ixflare] Generated hydration manifest with ${Object.keys(hydrationManifest.islands).length} islands`
        )
      } catch (error) {
        this.warn('[ixflare] Failed to generate hydration manifest: ' + (error as Error).message)
      }
    },

    async handleHotUpdate({ file, server }): Promise<ModuleNode[] | void> {
      if (!hmrEnabled) {
        return undefined
      }

      // Handle HMR for island files (.client.tsx)
      // React Fast Refresh handles state preservation automatically
      if (file.endsWith('.client.tsx')) {
        // Re-discover islands to update registry
        discoveredIslands = await discoverIslands(resolvedComponentsDir)

        // Use enhanced island HMR handler with timing and logging
        return handleIslandHMR(file, server)
      }

      // Handle HMR for server component files (routes/*.tsx but not .client.tsx)
      if (file.includes(routesDir) && file.endsWith('.tsx') && !file.endsWith('.client.tsx')) {
        // Extract route path from file path for targeted updates
        const routePath = extractRoutePathFromFile(file, routesDir)

        // Send custom event to client for HTML swap with island preservation
        handleServerComponentHMR(file, server, routePath)

        // Also handle as route file for manifest updates
        const modules = handleRouteHMR(file, server)
        const virtualModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (virtualModule && modules) {
          return [...modules, virtualModule]
        }
        return modules
      }

      // Handle HMR for other route files (loaders, actions, etc.)
      if (file.includes(routesDir)) {
        const modules = handleRouteHMR(file, server)

        // Also invalidate virtual module if it exists
        const virtualModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (virtualModule && modules) {
          return [...modules, virtualModule]
        }

        return modules
      }

      return undefined
    },

    async closeBundle() {
      // Cleanup dev server when closing
      if (devServer) {
        await devServer.stop()
        devServer = null
      }
    },
  }
}
