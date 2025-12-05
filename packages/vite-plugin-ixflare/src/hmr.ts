/**
 * @module hmr
 * @description Hot Module Replacement support for route files
 * @node-only
 */

import type { ViteDevServer, HmrContext, ModuleNode } from 'vite'

export interface HMRConfig {
  enabled?: boolean
}

/**
 * Setup HMR for the Vite dev server
 * Configures hot reload boundaries for route files
 */
export function setupHMR(server: ViteDevServer, config: HMRConfig = {}): void {
  if (config.enabled === false) {
    return
  }

  // HMR is handled by the plugin's handleHotUpdate hook
  // This is a placeholder for any server-side HMR setup
  server.ws.on('connection', () => {
    // Connection established - HMR ready
  })
}

/**
 * Handle route file HMR updates
 * Determines which modules need to be invalidated when a route changes
 */
export function handleRouteHMR(
  file: string,
  server: ViteDevServer
): ModuleNode[] {
  const module = server.moduleGraph.getModuleById(file)

  if (!module) {
    return []
  }

  const invalidated: ModuleNode[] = [module]

  // Invalidate the route manifest module if it exists
  const manifestModule = server.moduleGraph.getModuleById('virtual:ixflare-routes')
  if (manifestModule) {
    invalidated.push(manifestModule)
  }

  return invalidated
}

/**
 * Invalidate a route module and its dependents
 * Forces re-evaluation of the route and anything that imports it
 */
export function invalidateRouteModule(
  file: string,
  server: ViteDevServer
): void {
  const modules = handleRouteHMR(file, server)

  for (const mod of modules) {
    server.moduleGraph.invalidateModule(mod)
  }

  // Send HMR update to client
  server.ws.send({
    type: 'full-reload',
    path: '*',
  })
}

/**
 * Create HMR context for Vite plugin handleHotUpdate hook
 */
export function createHMRContext(
  file: string,
  modules: ModuleNode[]
): Partial<HmrContext> {
  return {
    file,
    modules,
  }
}
