/**
 * @module dev-server
 * @description Development server with file watching for route changes
 * @node-only
 *
 * Note: Workers runtime simulation (D1, KV, R2, workerd) is handled by @cloudflare/vite-plugin.
 * This module focuses solely on file watching for route changes.
 * See docs/architecture/adr-001-cloudflare-vite-plugin-integration.md
 */

import chokidar, { type FSWatcher } from 'chokidar'
import { basename, extname } from 'node:path'

export interface DevServerConfig {
  routesDir: string
  port?: number
  onRouteChange?: (event: RouteChangeResult) => void
}

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
}

export interface RouteChangeResult {
  regenerateManifest: boolean
  path: string
  event: 'add' | 'change' | 'unlink'
}

export interface DevServer {
  watcher: FSWatcher
  config: DevServerConfig
  stop: () => Promise<void>
}

/**
 * Setup file watching for route changes using chokidar
 */
export function setupFileWatching(routesDir: string): FSWatcher {
  const watcher = chokidar.watch(['**/*.{ts,tsx,js,jsx}'], {
    cwd: routesDir,
    persistent: true,
    ignoreInitial: true, // Don't emit events for files that already exist
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.*', // dot files
      '**/_*', // underscore-prefixed files (layouts, middleware)
    ],
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  return watcher
}

/**
 * Handle route file change events
 */
export function handleRouteChange(event: WatchEvent, _routesDir: string): RouteChangeResult {
  const fileName = basename(event.path)
  const fileExt = extname(event.path)

  // Ignore non-route files
  const validExtensions = ['.ts', '.tsx', '.js', '.jsx']
  if (!validExtensions.includes(fileExt)) {
    return {
      regenerateManifest: false,
      path: event.path,
      event: event.type,
    }
  }

  // Ignore underscore-prefixed files (layouts, middleware)
  if (fileName.startsWith('_')) {
    return {
      regenerateManifest: false,
      path: event.path,
      event: event.type,
    }
  }

  // Valid route file change - trigger manifest regeneration
  return {
    regenerateManifest: true,
    path: event.path,
    event: event.type,
  }
}

/**
 * Create development server with file watching for route changes
 *
 * Note: Workers runtime (D1, KV, R2) is handled by @cloudflare/vite-plugin.
 * This creates only the file watcher for route manifest regeneration.
 */
export function createDevServer(config: DevServerConfig): DevServer {
  const watcher = setupFileWatching(config.routesDir)

  // Setup event handlers
  const handleChange = (relativePath: string, event: 'add' | 'change' | 'unlink') => {
    const result = handleRouteChange({ type: event, path: relativePath }, config.routesDir)

    if (result.regenerateManifest && config.onRouteChange) {
      config.onRouteChange(result)
    }
  }

  watcher.on('add', (relativePath) => handleChange(relativePath, 'add'))
  watcher.on('change', (relativePath) => handleChange(relativePath, 'change'))
  watcher.on('unlink', (relativePath) => handleChange(relativePath, 'unlink'))

  return {
    watcher,
    config,
    async stop() {
      await watcher.close()
    },
  }
}
