/**
 * @module hydration-manifest
 * @description Hydration manifest generation for islands architecture
 * @node-only
 *
 * This module generates a hydration manifest that maps island components to their
 * code-split chunks, enabling the client to selectively hydrate only the interactive
 * components on a page.
 *
 * The manifest is generated at build time by mapping discovered islands to Vite's
 * output chunks, and is consumed by the client-side hydration script.
 *
 * @example
 * ```typescript
 * const manifest = generateHydrationManifest(discoveredIslands, viteManifest)
 * // {
 * //   version: '1.0.0',
 * //   generatedAt: 1733311800000,
 * //   islands: {
 * //     'Counter': {
 * //       chunk: '/assets/Counter-abc123.js',
 * //       imports: ['assets/react-xyz.js'],
 * //       marker: 'data-island-counter',
 * //       loadStrategy: 'immediate'
 * //     }
 * //   }
 * // }
 * ```
 */

import type { DiscoveredIsland, IslandLoadStrategy } from './island-discovery'

/**
 * Vite manifest entry structure
 *
 * See: https://vite.dev/config/build-options
 */
export interface ViteManifestEntry {
  /** Output file path (e.g., 'assets/Counter-abc123.js') */
  file: string
  /** Whether this is a build entry point */
  isEntry?: boolean
  /** Whether this is a dynamic import entry */
  isDynamicEntry?: boolean
  /** Imported chunks (shared dependencies) */
  imports?: string[]
  /** CSS files associated with this chunk */
  css?: string[]
}

/**
 * Vite build manifest
 *
 * Maps source files to their output chunks
 */
export interface ViteManifest {
  [sourceFile: string]: ViteManifestEntry
}

/**
 * Island entry in hydration manifest
 */
export interface IslandManifestEntry {
  /** Output chunk path (absolute URL path like '/assets/Counter-abc123.js') */
  chunk: string
  /** Shared dependency chunks to preload */
  imports: string[]
  /** HTML marker attribute (e.g., 'data-island-counter') */
  marker: string
  /** Loading strategy */
  loadStrategy: IslandLoadStrategy
}

/**
 * Complete hydration manifest
 *
 * Generated at build time and consumed by client hydration script
 */
export interface HydrationManifest {
  /** Manifest version for compatibility checking */
  version: string
  /** Unix timestamp when manifest was generated */
  generatedAt: number
  /** Map of component names to their island entries */
  islands: Record<string, IslandManifestEntry>
}

/**
 * Generates hydration manifest from discovered islands and Vite manifest
 *
 * Maps each discovered island to its corresponding Vite output chunk, creating
 * a manifest that the client can use to dynamically load and hydrate islands.
 *
 * Islands that don't have corresponding entries in the Vite manifest are skipped
 * with a warning (this can happen if the island file wasn't included in the build).
 *
 * @param discoveredIslands - Islands discovered during build
 * @param viteManifest - Vite's build manifest (maps source files to output chunks)
 * @returns Complete hydration manifest
 *
 * @example
 * ```typescript
 * const islands = await discoverIslands('./src/components')
 * const viteManifest = JSON.parse(await readFile('.vite/manifest.json', 'utf-8'))
 * const hydrationManifest = generateHydrationManifest(islands, viteManifest)
 *
 * // Write manifest for client consumption
 * await writeFile(
 *   'dist/island-manifest.json',
 *   JSON.stringify(hydrationManifest, null, 2)
 * )
 * ```
 */
export function generateHydrationManifest(
  discoveredIslands: DiscoveredIsland[],
  viteManifest: ViteManifest
): HydrationManifest {
  const islands: Record<string, IslandManifestEntry> = {}

  for (const island of discoveredIslands) {
    // Find corresponding Vite manifest entry
    const viteEntry = viteManifest[island.filePath]

    if (!viteEntry) {
      console.warn(
        `[ixflare] Island "${island.id}" (${island.filePath}) not found in Vite manifest. ` +
          `This island will not be available for hydration.`
      )
      continue
    }

    // Prepend / to chunk path if not present (make it an absolute URL path)
    const chunk = viteEntry.file.startsWith('/') ? viteEntry.file : '/' + viteEntry.file

    // Create island manifest entry
    islands[island.componentName] = {
      chunk,
      imports: viteEntry.imports || [],
      marker: `data-island-${island.id}`,
      loadStrategy: island.loadStrategy,
    }
  }

  return {
    version: '1.0.0',
    generatedAt: Date.now(),
    islands,
  }
}

/**
 * Serializes hydration manifest to JSON string
 *
 * Converts the hydration manifest to a formatted JSON string suitable for
 * writing to disk or embedding in HTML.
 *
 * @param manifest - Hydration manifest to serialize
 * @param pretty - Whether to format with indentation (default: true in dev, false in prod)
 * @returns JSON string
 *
 * @example
 * ```typescript
 * const json = serializeHydrationManifest(manifest, true)
 * await writeFile('dist/island-manifest.json', json)
 * ```
 */
export function serializeHydrationManifest(manifest: HydrationManifest, pretty = true): string {
  return JSON.stringify(manifest, null, pretty ? 2 : 0)
}

/**
 * Deserializes hydration manifest from JSON string
 *
 * Parses a JSON string into a hydration manifest object with type safety.
 *
 * @param json - JSON string to parse
 * @returns Hydration manifest object
 * @throws {Error} If JSON is invalid
 *
 * @example
 * ```typescript
 * const manifest = deserializeHydrationManifest(
 *   await readFile('dist/island-manifest.json', 'utf-8')
 * )
 * ```
 */
export function deserializeHydrationManifest(json: string): HydrationManifest {
  try {
    return JSON.parse(json) as HydrationManifest
  } catch (error) {
    throw new Error(`Failed to parse hydration manifest: ${error}`)
  }
}
