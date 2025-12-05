/**
 * @module plugin
 * @description Main Vite plugin implementation with router infrastructure
 */

import { join } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import type { IxflarePluginOptions } from './types'
import { discoverRoutes, detectRouteConflicts, generateRouteManifest, type RouteManifest } from './router-codegen'
import { createDevServer, type DevServer } from './dev-server'
import { buildRoutes, bundleManifest, optimizeRoutes } from './build'
import { setupHMR, handleRouteHMR, invalidateRouteModule } from './hmr'

export function ixflarePlugin(options: IxflarePluginOptions = {}): Plugin {
  const routesDir = options.routesDir || 'src/routes'
  const hmrEnabled = options.hmr !== false

  let devServer: DevServer | null = null
  let viteServer: ViteDevServer | null = null
  let routeManifest: RouteManifest | null = null

  return {
    name: 'vite-plugin-ixflare',

    config(config, { command: _command }) {
      return {
        ...config,
        build: {
          ...config.build,
          target: 'esnext',
        },
      }
    },

    async configureServer(server: ViteDevServer) {
      viteServer = server

      // Setup HMR
      if (hmrEnabled) {
        setupHMR(server, { enabled: true })
      }

      // Create dev server with file watching
      const resolvedRoutesDir = join(server.config.root, routesDir)

      devServer = createDevServer({
        routesDir: resolvedRoutesDir,
        port: server.config.server.port || 5173,
        miniflare: options.miniflare,
        onRouteChange: async (result) => {
          if (result.regenerateManifest) {
            // Regenerate route manifest
            const routes = await discoverRoutes(resolvedRoutesDir)
            detectRouteConflicts(routes)
            routeManifest = generateRouteManifest(routes)

            // Invalidate modules for HMR
            if (hmrEnabled && viteServer) {
              invalidateRouteModule(result.path, viteServer)
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

    async buildEnd() {
      // Production build - generate optimized route manifest
      if (viteServer) {
        const resolvedRoutesDir = join(viteServer.config.root, routesDir)
        const outputDir = viteServer.config.build.outDir

        const result = await buildRoutes({
          routesDir: resolvedRoutesDir,
          outputDir,
          sourceMaps: viteServer.config.build.sourcemap !== false,
        })

        // Optimize routes for production
        const optimized = optimizeRoutes(result.manifest)

        // Bundle manifest as importable module
        const bundled = bundleManifest(optimized)

        // Log build info
        this.info(
          `[ixflare] Built ${optimized.routes.length} routes for production`
        )

        // Emit manifest as virtual module (will be handled by transform hook)
        routeManifest = optimized
      }
    },

    transform(code, id) {
      // Serve virtual route manifest module
      if (id === 'virtual:ixflare-routes') {
        if (routeManifest) {
          return {
            code: bundleManifest(routeManifest),
            map: null,
          }
        }
      }

      return null
    },

    handleHotUpdate({ file, server }) {
      // Handle HMR for route files
      if (hmrEnabled && file.includes(routesDir)) {
        const modules = handleRouteHMR(file, server)
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
