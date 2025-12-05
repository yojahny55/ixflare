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
import type { Plugin, ViteDevServer, ModuleNode } from 'vite'
import type { IxflarePluginOptions } from './types'
import { discoverRoutes, detectRouteConflicts, generateRouteManifest, type RouteManifest } from './router-codegen'
import { createDevServer, type DevServer } from './dev-server'
import { buildRoutes, bundleManifest, optimizeRoutes } from './build'
import { setupHMR, handleRouteHMR } from './hmr'

const VIRTUAL_MODULE_ID = 'virtual:ixflare-routes'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

export function ixflarePlugin(options: IxflarePluginOptions = {}): Plugin {
  const routesDir = options.routesDir || 'src/routes'
  const hmrEnabled = options.hmr !== false

  let devServer: DevServer | null = null
  let viteServer: ViteDevServer | null = null
  let routeManifest: RouteManifest | null = null
  let resolvedRoutesDir: string = ''

  return {
    name: 'vite-plugin-ixflare',

    config(config) {
      return {
        ...config,
        build: {
          ...config.build,
          target: 'esnext',
        },
      }
    },

    // Resolve virtual module ID
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
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
      return null
    },

    async configureServer(server: ViteDevServer) {
      viteServer = server
      resolvedRoutesDir = join(server.config.root, routesDir)

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
                updates: [{
                  type: 'js-update',
                  path: VIRTUAL_MODULE_ID,
                  acceptedPath: VIRTUAL_MODULE_ID,
                  timestamp: Date.now(),
                }],
              })
            }

            server.config.logger.info(
              `[ixflare] Route ${result.event}: ${result.path}`,
              { timestamp: true }
            )
          }
        },
      })

      // Generate initial route manifest
      const routes = await discoverRoutes(resolvedRoutesDir)
      detectRouteConflicts(routes)
      routeManifest = generateRouteManifest(routes)

      server.config.logger.info(
        `[ixflare] Discovered ${routes.length} routes`,
        { timestamp: true }
      )
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

          this.info(
            `[ixflare] Built ${routeManifest.routes.length} routes for production`
          )
        } catch (error) {
          // Route discovery might fail if routesDir doesn't exist yet
          this.warn('[ixflare] Could not discover routes: ' + (error as Error).message)
        }
      }
    },

    handleHotUpdate({ file, server }): ModuleNode[] | void {
      // Handle HMR for route files
      if (hmrEnabled && file.includes(routesDir)) {
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
