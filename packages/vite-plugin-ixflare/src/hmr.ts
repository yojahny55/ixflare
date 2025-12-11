/**
 * @module hmr
 * @description Hot Module Replacement support for routes and islands
 * @node-only
 *
 * This module handles HMR for route manifest changes, island updates,
 * and server component changes. Component-level state preservation is
 * handled by @vitejs/plugin-react's Fast Refresh.
 */

import type { ViteDevServer, HmrContext, ModuleNode } from 'vite'

export interface HMRConfig {
  enabled?: boolean
}

/**
 * HMR timing tracker for performance monitoring
 * @internal
 */
interface HMRTiming {
  start: number
  file: string
  type: 'route' | 'island' | 'server-component'
}

const VIRTUAL_MODULE_ID = 'virtual:ixflare-routes'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

/**
 * Setup HMR for the Vite dev server
 * Configures logging for route manifest updates and breaking change detection
 */
export function setupHMR(server: ViteDevServer, config: HMRConfig = {}): void {
  if (config.enabled === false) {
    return
  }

  // Log when HMR connection is established
  server.ws.on('connection', () => {
    server.config.logger.info('[ixflare] HMR connected', { timestamp: true })
  })

  // Listen for full reload events to detect breaking changes
  // This is triggered when React Fast Refresh bails out
  server.ws.on('vite:beforeFullReload', (payload: { path?: string }) => {
    const filePath = payload?.path || 'unknown file'
    const fileName = filePath.split('/').pop() || filePath

    // Detect common bailout patterns
    let reason = 'Component signature changed'

    if (fileName.endsWith('.client.tsx') || fileName.endsWith('.tsx')) {
      reason = detectBailoutReason(fileName)
    }

    logBreakingChange(reason, server)
  })
}

/**
 * Detects the likely reason for a Fast Refresh bailout based on file name patterns
 * @internal
 */
function detectBailoutReason(fileName: string): string {
  // Common bailout patterns - we can't know for sure without parsing,
  // but we can provide helpful hints
  const hints = [
    'Possible causes:',
    '• Component was renamed',
    '• Default export removed or changed',
    '• Hook order changed',
    '• Anonymous arrow function used (export default () => ...)',
    '• File exports both components and non-components',
  ]

  return `Breaking change detected in ${fileName}. ${hints.join(' ')}`
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

/**
 * Starts HMR timing measurement
 * @returns Timing object to pass to logHMRTiming
 * @internal
 */
export function startHMRTiming(
  file: string,
  type: 'route' | 'island' | 'server-component'
): HMRTiming {
  return {
    start: Date.now(),
    file,
    type,
  }
}

/**
 * Logs HMR timing with performance warning for slow updates
 * @param timing - Timing object from startHMRTiming
 * @param server - Vite dev server for logging
 * @param additionalInfo - Additional context to log
 * @internal
 */
export function logHMRTiming(
  timing: HMRTiming,
  server: ViteDevServer,
  additionalInfo?: string
): void {
  const duration = Date.now() - timing.start
  const fileName = timing.file.split('/').pop() || timing.file

  let message = `[ixflare] ${timing.type} updated: ${fileName}`
  if (additionalInfo) {
    message += ` ${additionalInfo}`
  }
  message += ` (${duration}ms)`

  // Warn if HMR update is slow (>1s as per NFR requirement)
  if (duration > 1000) {
    server.config.logger.warn(`${message} ⚠️ Slow HMR update`, { timestamp: true })
  } else {
    server.config.logger.info(message, { timestamp: true })
  }
}

/**
 * Handles island file HMR updates with state preservation via React Fast Refresh
 *
 * Islands use @vitejs/plugin-react's Fast Refresh for state preservation.
 * This function invalidates the virtual islands module so the registry updates,
 * but does NOT trigger re-hydration (React Fast Refresh handles component updates).
 *
 * @param file - Changed island file path
 * @param server - Vite dev server
 * @returns Modules that need to be invalidated
 *
 * @example
 * ```typescript
 * // In handleHotUpdate hook:
 * if (file.endsWith('.client.tsx')) {
 *   await discoverIslands(componentsDir) // Update island registry
 *   return handleIslandHMR(file, server)
 * }
 * ```
 */
export function handleIslandHMR(file: string, server: ViteDevServer): ModuleNode[] {
  const timing = startHMRTiming(file, 'island')

  const VIRTUAL_ISLANDS_ID = 'virtual:ixflare-islands'
  const RESOLVED_ISLANDS_ID = '\0' + VIRTUAL_ISLANDS_ID

  // Invalidate the islands virtual module to update registry
  const virtualModule = server.moduleGraph.getModuleById(RESOLVED_ISLANDS_ID)
  const modules: ModuleNode[] = []

  if (virtualModule) {
    server.moduleGraph.invalidateModule(virtualModule)
    modules.push(virtualModule)

    // Send HMR update for virtual module
    server.ws.send({
      type: 'update',
      updates: [
        {
          type: 'js-update',
          path: VIRTUAL_ISLANDS_ID,
          acceptedPath: VIRTUAL_ISLANDS_ID,
          timestamp: Date.now(),
        },
      ],
    })
  }

  // Also get the actual island module for React Fast Refresh
  const islandModule = server.moduleGraph.getModuleById(file)
  if (islandModule) {
    modules.push(islandModule)
  }

  const modulesByUrl = server.moduleGraph.getModulesByFile(file)
  if (modulesByUrl) {
    for (const mod of modulesByUrl) {
      if (!modules.includes(mod)) {
        modules.push(mod)
      }
    }
  }

  logHMRTiming(timing, server, '(state preserved)')

  return modules
}

/**
 * Handles server component HMR by sending custom update event to client
 *
 * When a server component (non-.client.tsx) changes, we re-render the route
 * and send an event to the client to swap HTML while preserving island state.
 *
 * @param file - Changed server component file path
 * @param server - Vite dev server
 * @param routePath - Route path affected by the change (e.g., '/dashboard')
 *
 * @example
 * ```typescript
 * // In handleHotUpdate hook:
 * if (file.includes('routes/') && file.endsWith('.tsx') && !file.endsWith('.client.tsx')) {
 *   handleServerComponentHMR(file, server, '/dashboard')
 * }
 * ```
 */
export function handleServerComponentHMR(
  file: string,
  server: ViteDevServer,
  routePath: string
): void {
  const timing = startHMRTiming(file, 'server-component')

  // Send custom event to client to swap HTML
  server.ws.send({
    type: 'custom',
    event: 'ixflare:server-update',
    data: {
      route: routePath,
      timestamp: Date.now(),
    },
  })

  logHMRTiming(timing, server, `(route: ${routePath})`)
}

/**
 * Logs breaking change detection and full reload reason
 *
 * When React Fast Refresh cannot preserve state (breaking change detected),
 * log a clear message explaining why a full reload is necessary.
 *
 * @param reason - Description of the breaking change
 * @param server - Vite dev server for logging
 *
 * @example
 * ```typescript
 * // When Fast Refresh bailout detected:
 * logBreakingChange('Component renamed from Counter to CounterWidget', server)
 * ```
 */
export function logBreakingChange(reason: string, server: ViteDevServer): void {
  server.config.logger.warn(`[ixflare] Full reload triggered: ${reason}`, {
    timestamp: true,
  })
}
