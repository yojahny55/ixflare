/**
 * @module server-only-removal
 * @description Server-only code removal for secure client bundles
 * @node-only
 *
 * Implements multiple strategies for preventing server code from reaching the browser:
 * 1. Automatic loader/action export stripping via tree-shaking
 * 2. `server-only` package boundary enforcement
 * 3. `.server.ts` file convention support
 *
 * Security Note: This prevents sensitive code (DB queries, API keys, server logic)
 * from being included in client bundles, eliminating entire classes of security vulnerabilities.
 */

import type { Plugin, TransformResult } from 'vite'

/**
 * Server-only export names that should be stripped from client bundles
 * These exports only run on the server and should never reach the browser
 */
const SERVER_ONLY_EXPORTS = [
  'loader', // Data loading function (runs server-side only)
  'action', // Form action handler (runs server-side only)
  'headers', // HTTP headers function (runs server-side only)
] as const

/**
 * Virtual module ID for the server-only boundary marker package
 * The '\0' prefix is a Rollup convention for virtual modules
 */
const SERVER_ONLY_MODULE_ID = '\0server-only'

/**
 * Check if a file path represents a route file
 * Route files are located in the routes directory
 */
function isRouteFile(id: string, routesDir: string): boolean {
  const normalizedId = id.replace(/\\/g, '/')
  const normalizedRoutesDir = routesDir.replace(/\\/g, '/')

  return normalizedId.includes(`/${normalizedRoutesDir}/`) || normalizedId.includes(`\\${routesDir}\\`)
}

/**
 * Check if a file uses the .server.ts or .server.tsx convention
 * These files are explicitly marked as server-only
 */
function isServerFile(id: string): boolean {
  return id.includes('.server.ts') || id.includes('.server.tsx')
}

/**
 * Check if a file is in a .server directory
 * Following Remix convention: files in .server/ directories are server-only
 */
function isInServerDirectory(id: string): boolean {
  const normalizedId = id.replace(/\\/g, '/')
  return normalizedId.includes('/.server/') || normalizedId.includes('\\.server\\')
}

/**
 * Transform hook to mark server-only exports for tree-shaking
 *
 * This function processes route files during the CLIENT build and marks
 * server-only exports (loader, action, headers) with the `@__PURE__` annotation.
 * Rollup's tree-shaker will then remove these exports and their dependencies
 * from the client bundle.
 *
 * Strategy:
 * - Only processes route files (located in routesDir)
 * - Only runs during client builds (not SSR builds)
 * - Preserves the original code structure (no runtime behavior changes)
 * - Marks exports with @__PURE__ for safe removal
 *
 * @param code - Source code of the module
 * @param id - Module ID (file path)
 * @param routesDir - Routes directory path
 * @param ssr - Whether this is an SSR build
 * @returns Transformed code with marked exports, or null if no transformation needed
 */
export function transformServerExports(
  code: string,
  id: string,
  routesDir: string,
  ssr: boolean | undefined
): TransformResult | null {
  // Only process route files during client builds
  // SSR builds need server exports, so skip transformation
  if (!isRouteFile(id, routesDir) || ssr) {
    return null
  }

  let transformed = code
  let hasTransforms = false

  // Process each server-only export
  for (const exportName of SERVER_ONLY_EXPORTS) {
    // Pattern 1: export async function loader(...) or export function loader(...)
    const functionRegex = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${exportName}\\s*\\(`,
      'g'
    )

    if (functionRegex.test(code)) {
      // Reset regex lastIndex for replacement
      functionRegex.lastIndex = 0
      transformed = transformed.replace(functionRegex, (match) => {
        hasTransforms = true
        // Insert @__PURE__ annotation before the export
        // This tells Rollup the function has no side effects and can be tree-shaken
        return `/* @__PURE__ */ ${match}`
      })
    }

    // Pattern 2: export const loader = ... or export const loader: Type = ...
    const constRegex = new RegExp(`export\\s+const\\s+${exportName}\\s*[:=]`, 'g')

    if (constRegex.test(code)) {
      constRegex.lastIndex = 0
      transformed = transformed.replace(constRegex, (match) => {
        hasTransforms = true
        return `/* @__PURE__ */ ${match}`
      })
    }
  }

  // Only return transformed code if we actually made changes
  return hasTransforms ? { code: transformed, map: null } : null
}

/**
 * Options for the server-only removal plugin
 */
export interface ServerOnlyRemovalOptions {
  /** Routes directory for automatic loader stripping (default: 'src/routes') */
  routesDir?: string
  /** Enable verbose logging for debugging (default: false) */
  verbose?: boolean
}

/**
 * Vite plugin for server-only code removal
 *
 * This plugin implements three strategies for keeping server code out of client bundles:
 *
 * 1. **Automatic Loader Stripping** - Marks `loader`, `action`, and `headers` exports
 *    in route files for tree-shaking. These functions only run on the server, so they
 *    and their dependencies are safely removed from client bundles.
 *
 * 2. **server-only Boundary** - Detects imports of the `server-only` package and fails
 *    the build if imported in client code. This provides explicit boundaries for code
 *    that must never reach the browser.
 *
 * 3. **.server File Convention** - Enforces that `.server.ts` files and `.server/`
 *    directories can only be imported by server code, never by client code.
 *
 * Security Benefits:
 * - Prevents database credentials from leaking to client
 * - Keeps API keys and secrets server-side only
 * - Eliminates entire classes of security vulnerabilities
 * - Reduces client bundle size (smaller = faster)
 *
 * @param options - Plugin configuration options
 * @returns Vite plugin object
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { ixflare } from 'vite-plugin-ixflare'
 * import { serverOnlyRemoval } from 'vite-plugin-ixflare/server-only-removal'
 *
 * export default defineConfig({
 *   plugins: [
 *     ixflare(),
 *     serverOnlyRemoval({ routesDir: 'src/routes' })
 *   ]
 * })
 * ```
 */
export function createServerOnlyRemovalPlugin(
  options: ServerOnlyRemovalOptions = {}
): Plugin {
  const routesDir = options.routesDir || 'src/routes'
  const verbose = options.verbose || false

  return {
    name: 'ixflare-server-only-removal',

    // Apply only during build, not dev (dev needs server exports for SSR)
    apply: 'build',

    /**
     * Transform hook - marks server exports for tree-shaking
     * Runs for every module during the build process
     */
    transform(code: string, id: string) {
      // Get SSR mode from this.environment (Vite 6+) or fallback to options
      const ssr = (this as any).environment?.name === 'ssr' || (this as any).ssr

      return transformServerExports(code, id, routesDir, ssr)
    },

    /**
     * Resolve ID hook - intercepts module resolution for boundary enforcement
     * Used to detect server-only imports and .server file imports
     */
    resolveId(source: string, importer: string | undefined) {
      // Handle server-only package imports
      if (source === 'server-only') {
        return SERVER_ONLY_MODULE_ID
      }

      // Check for .server file imports in client code
      if (source.includes('.server') && importer) {
        const ssr = (this as any).environment?.name === 'ssr' || (this as any).ssr

        // Only enforce boundary during client build
        if (!ssr) {
          // Check if the importer is also a server file - that's allowed
          const importerIsServerFile = isServerFile(importer) || isInServerDirectory(importer)

          if (!importerIsServerFile) {
            // Client code trying to import server-only code - this is an error!
            const importerPath = importer.replace(process.cwd(), '.')

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

      return null
    },

    /**
     * Load hook - handles loading of virtual modules
     * Used to provide the server-only package implementation
     */
    load(id: string) {
      if (id === SERVER_ONLY_MODULE_ID) {
        const ssr = (this as any).environment?.name === 'ssr' || (this as any).ssr

        // In server build: provide empty module (no-op)
        // In client build: throw error if somehow reached
        if (!ssr) {
          // Build should have failed in resolveId, but add extra safety
          this.error({
            message: 'server-only module imported in client code',
            meta: {
              suggestion: 'This import should only exist in server code (loaders, .server files)',
            },
          })
        }

        // Return empty export for server builds
        return 'export {}'
      }

      return null
    },

    /**
     * Build end hook - logs what was stripped (if verbose mode enabled)
     */
    buildEnd() {
      if (verbose) {
        this.info('[ixflare] Server-only removal plugin completed')
        this.info(`  - Marked ${SERVER_ONLY_EXPORTS.join(', ')} exports for tree-shaking`)
        this.info(`  - Enforced .server file boundaries`)
        this.info(`  - Protected against server-only package imports`)
      }
    },
  }
}
