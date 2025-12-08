/**
 * @module hmr
 * @description Hot Module Replacement support for route files
 * @node-only
 *
 * This module handles HMR for route manifest changes.
 * Component-level HMR is handled by Vite core and @vitejs/plugin-react.
 */

import type { ViteDevServer, HmrContext, ModuleNode } from 'vite'

export interface HMRConfig {
  enabled?: boolean
}

const VIRTUAL_MODULE_ID = 'virtual:ixflare-routes'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

/**
 * Setup HMR for the Vite dev server
 * Configures logging for route manifest updates
 */
export function setupHMR(server: ViteDevServer, config: HMRConfig = {}): void {
  if (config.enabled === false) {
    return
  }

  // Log when HMR connection is established
  server.ws.on('connection', () => {
    server.config.logger.info('[ixflare] HMR connected', { timestamp: true })
  })
}

/**
 * Handle route file HMR updates
 * Returns modules that need to be invalidated when a route changes
 */
export function handleRouteHMR(file: string, server: ViteDevServer): ModuleNode[] {
  const module = server.moduleGraph.getModuleById(file)
  const invalidated: ModuleNode[] = []

  if (module) {
    invalidated.push(module)
  }

  // Also check by URL (Vite uses URLs internally)
  const moduleByUrl = server.moduleGraph.getModulesByFile(file)
  if (moduleByUrl) {
    for (const mod of moduleByUrl) {
      if (!invalidated.includes(mod)) {
        invalidated.push(mod)
      }
    }
  }

  // Invalidate the route manifest virtual module
  const manifestModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
  if (manifestModule && !invalidated.includes(manifestModule)) {
    invalidated.push(manifestModule)
  }

  return invalidated
}

/**
 * Invalidate a route module and trigger proper HMR update
 *
 * Uses Vite's module graph invalidation instead of full-reload.
 * This allows for faster updates without losing client-side state.
 */
export function invalidateRouteModule(file: string, server: ViteDevServer): void {
  const modules = handleRouteHMR(file, server)

  // Invalidate all affected modules in the graph
  for (const mod of modules) {
    server.moduleGraph.invalidateModule(mod)
  }

  // If we have modules to update, send proper HMR update
  if (modules.length > 0) {
    const updates = modules
      .filter((mod) => mod.url) // Only modules with URLs
      .map((mod) => ({
        type: 'js-update' as const,
        path: mod.url,
        acceptedPath: mod.url,
        timestamp: Date.now(),
      }))

    if (updates.length > 0) {
      server.ws.send({
        type: 'update',
        updates,
      })
    }
  }

  // Note: We no longer send full-reload by default.
  // Component HMR is handled by Vite core + React plugin.
  // Route manifest updates trigger module invalidation above.
}

/**
 * Create HMR context for Vite plugin handleHotUpdate hook
 */
export function createHMRContext(file: string, modules: ModuleNode[]): Partial<HmrContext> {
  return {
    file,
    modules,
  }
}
