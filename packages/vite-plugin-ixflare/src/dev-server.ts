/**
 * @module dev-server
 * @description Development server with file watching and Miniflare integration
 * @node-only
 */

import chokidar, { type FSWatcher } from 'chokidar'
import { basename, extname } from 'node:path'

export interface MiniflareConfig {
  d1Databases?: string[]
  kvNamespaces?: string[]
  r2Buckets?: string[]
  durableObjects?: Record<string, string>
  compatibilityDate?: string
}

export interface DevServerConfig {
  routesDir: string
  port?: number
  miniflare?: MiniflareConfig
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
      '**/_*', // underscore-prefixed files
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
export function handleRouteChange(event: WatchEvent, routesDir: string): RouteChangeResult {
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
 * Create development server with file watching and Miniflare
 */
export function createDevServer(config: DevServerConfig): DevServer {
  const watcher = setupFileWatching(config.routesDir)

  // Setup event handlers
  const handleChange = (relativePath: string, event: 'add' | 'change' | 'unlink') => {
    const result = handleRouteChange(
      { type: event, path: relativePath },
      config.routesDir
    )

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

/**
 * Setup Miniflare for local Workers simulation
 * Note: Actual Miniflare initialization will be done in the plugin's configureServer hook
 * This is a placeholder for configuration validation
 */
export function setupMiniflare(config: MiniflareConfig): MiniflareConfig {
  // Validate and return config
  return {
    d1Databases: config.d1Databases || [],
    kvNamespaces: config.kvNamespaces || [],
    r2Buckets: config.r2Buckets || [],
    durableObjects: config.durableObjects || {},
    compatibilityDate: config.compatibilityDate || '2025-01-01',
  }
}
