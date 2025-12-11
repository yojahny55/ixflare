/**
 * @module island-discovery
 * @description Island file discovery and parsing for selective hydration
 * @node-only
 *
 * This module scans the filesystem for island components (*.client.tsx files with
 * `island` export marker) and extracts their configuration for manifest generation.
 *
 * Island files are client components marked for selective hydration:
 *
 * @example
 * ```typescript
 * // Counter.client.tsx
 * export const island = true
 * export default function Counter({ count }: { count: number }) {
 *   return <button>{count}</button>
 * }
 * ```
 *
 * @example
 * ```typescript
 * // LazyWidget.client.tsx
 * export const island = { load: 'idle' }
 * export default function LazyWidget() {
 *   return <div>I hydrate when the browser is idle</div>
 * }
 * ```
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename, relative } from 'node:path'

/**
 * Island loading strategies
 */
export type IslandLoadStrategy = 'immediate' | 'idle' | 'visible'

/**
 * Discovered island metadata
 */
export interface DiscoveredIsland {
  /** Unique island identifier (kebab-case, e.g., 'user-profile') */
  id: string
  /** Absolute file path */
  filePath: string
  /** Component name (PascalCase, e.g., 'UserProfile') */
  componentName: string
  /** Loading strategy */
  loadStrategy: IslandLoadStrategy
}

/**
 * Converts PascalCase to kebab-case
 *
 * @param str - String to convert
 * @returns Kebab-case string
 *
 * @example
 * ```typescript
 * toKebabCase('UserProfile') // 'user-profile'
 * toKebabCase('APIStatus') // 'api-status'
 * ```
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Converts filename to PascalCase component name
 *
 * @param filename - Filename without extension (e.g., 'user-profile' or 'UserProfile')
 * @returns PascalCase component name
 *
 * @example
 * ```typescript
 * toPascalCase('user-profile') // 'UserProfile'
 * toPascalCase('api-status') // 'ApiStatus'
 * ```
 */
function toPascalCase(filename: string): string {
  // Handle kebab-case: user-profile -> UserProfile
  if (filename.includes('-')) {
    return filename
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }

  // Already PascalCase or single word - ensure first letter is uppercase
  return filename.charAt(0).toUpperCase() + filename.slice(1)
}

/**
 * Parses island file to extract configuration
 *
 * Reads the file content and looks for the `island` export marker:
 * - `export const island = true` -> immediate loading
 * - `export const island = { load: 'idle' }` -> idle loading
 * - `export const island = { load: 'visible' }` -> visible loading
 *
 * @param filePath - Absolute path to island file
 * @returns Discovered island metadata, or null if not an island
 *
 * @example
 * ```typescript
 * const island = await parseIslandFile('/src/Counter.client.tsx')
 * // Returns: { id: 'counter', componentName: 'Counter', loadStrategy: 'immediate', ... }
 * ```
 */
export async function parseIslandFile(filePath: string): Promise<DiscoveredIsland | null> {
  const content = await readFile(filePath, 'utf-8')

  // Check for island export marker using regex
  // Matches: export const island = true | { load: 'strategy' }
  const hasIslandExport = /export\s+const\s+island\s*=/.test(content)

  if (!hasIslandExport) {
    return null
  }

  // Extract component name from filename
  const fileName = basename(filePath, '.client.tsx')
  const componentName = toPascalCase(fileName)
  const id = toKebabCase(componentName)

  // Extract load strategy if present
  // Match: island = { load: 'idle' } or island = { load: "visible" }
  const loadMatch = content.match(/island\s*=\s*\{\s*load:\s*['"](\w+)['"]/)
  const loadStrategy = (loadMatch?.[1] as IslandLoadStrategy) || 'immediate'

  return {
    id,
    filePath,
    componentName,
    loadStrategy,
  }
}

/**
 * Recursively discovers all island files in a directory
 *
 * Scans for `*.client.tsx` files and parses each one to check for the
 * `island` export marker. Only files with the marker are included.
 *
 * @param rootDir - Root directory to scan
 * @returns Array of discovered islands
 *
 * @example
 * ```typescript
 * const islands = await discoverIslands('./src/components')
 * // Returns: [
 * //   { id: 'counter', componentName: 'Counter', loadStrategy: 'immediate', ... },
 * //   { id: 'search-box', componentName: 'SearchBox', loadStrategy: 'idle', ... },
 * // ]
 * ```
 */
export async function discoverIslands(rootDir: string): Promise<DiscoveredIsland[]> {
  const islands: DiscoveredIsland[] = []

  /**
   * Recursively scans directory for *.client.tsx files
   */
  async function scanDirectory(dir: string): Promise<void> {
    let entries: string[]

    try {
      entries = await readdir(dir)
    } catch {
      // Directory doesn't exist or not accessible, return empty
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry)

      // Check if entry is directory or file
      let stats
      try {
        stats = await stat(fullPath)
      } catch {
        // Skip if stat fails (permissions, symlinks, etc.)
        continue
      }

      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(fullPath)
      } else if (entry.endsWith('.client.tsx')) {
        // Found an island candidate - parse it
        try {
          const island = await parseIslandFile(fullPath)
          if (island) {
            islands.push(island)
          }
        } catch {
          // Skip files that can't be parsed
          console.warn(`[ixflare] Failed to parse island file: ${fullPath}`)
        }
      }
    }
  }

  await scanDirectory(rootDir)

  return islands
}

/**
 * Creates a watcher callback for island file changes
 *
 * This is used by the Vite plugin to watch for island file changes during
 * development and regenerate the manifest when islands are added/removed/modified.
 *
 * @param rootDir - Root directory being watched
 * @param onChange - Callback when islands change
 * @returns Watcher callback function
 *
 * @example
 * ```typescript
 * const handleChange = createIslandWatcher('./src', async (event, path) => {
 *   console.log(`Island ${event}: ${path}`)
 *   await regenerateManifest()
 * })
 *
 * chokidar.watch('./src/**\/*.client.tsx').on('all', handleChange)
 * ```
 */
export function createIslandWatcher(
  rootDir: string,
  onChange: (event: 'add' | 'change' | 'unlink', filePath: string) => Promise<void>
): (event: string, path: string) => Promise<void> {
  return async (event: string, path: string) => {
    // Only handle island files
    if (!path.endsWith('.client.tsx')) {
      return
    }

    // Normalize events
    let normalizedEvent: 'add' | 'change' | 'unlink' | null = null
    if (event === 'add' || event === 'addDir') {
      normalizedEvent = 'add'
    } else if (event === 'change') {
      normalizedEvent = 'change'
    } else if (event === 'unlink' || event === 'unlinkDir') {
      normalizedEvent = 'unlink'
    }

    if (normalizedEvent) {
      await onChange(normalizedEvent, relative(rootDir, path))
    }
  }
}
