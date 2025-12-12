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
 * Check if a file path represents a route file.
 * Route files are located in the routes directory.
 *
 * @param id - The module ID (file path) to check
 * @param routesDir - The routes directory path (e.g., 'src/routes')
 * @returns True if the file is inside the routes directory
 *
 * @example
 * isRouteFile('/project/src/routes/users.tsx', 'src/routes') // true
 * isRouteFile('/project/src/utils/helper.ts', 'src/routes') // false
 */
export function isRouteFile(id: string, routesDir: string): boolean {
  const normalizedId = id.replace(/\\/g, '/')
  const normalizedRoutesDir = routesDir.replace(/\\/g, '/')

  return normalizedId.includes(`/${normalizedRoutesDir}/`)
}

/**
 * Check if a file uses the .server file convention.
 * Supports multiple file extensions: .ts, .tsx, .js, .jsx, .mts, .mjs
 *
 * @param id - The module ID (file path) to check
 * @returns True if the file has a .server.* extension at the END of the filename
 *
 * @example
 * isServerFile('/project/src/lib/db.server.ts') // true
 * isServerFile('/project/src/lib/db.server.js') // true
 * isServerFile('/project/src/lib/utils.ts') // false
 * isServerFile('/project/src/lib/my.server.test.ts') // false (not at end)
 */
export function isServerFile(id: string): boolean {
  const normalizedId = id.replace(/\\/g, '/')
  // Match .server followed by common JS/TS extensions at END of filename only
  return /\.server\.(ts|tsx|js|jsx|mts|mjs)$/i.test(normalizedId)
}

/**
 * Check if a file is in a .server directory.
 * Following Remix convention: files in .server/ directories are server-only.
 *
 * @param id - The module ID (file path) to check
 * @returns True if the file is inside a .server/ directory
 *
 * @example
 * isInServerDirectory('/project/src/.server/utils.ts') // true
 * isInServerDirectory('/project/src/lib/db.ts') // false
 */
export function isInServerDirectory(id: string): boolean {
  const normalizedId = id.replace(/\\/g, '/')
  return normalizedId.includes('/.server/')
}

/**
 * Find the index of the closing brace that matches the opening brace at startIndex.
 * Handles arbitrary nesting depth, strings, template literals, and comments.
 *
 * @param code - Source code string
 * @param startIndex - Index of the opening brace '{'
 * @returns Index of the matching closing brace '}', or -1 if not found
 *
 * @example
 * findMatchingBrace('{ if (x) { return y } }', 0) // returns 22
 * findMatchingBrace('{ nested { more { deep } } }', 0) // returns 27
 */
function findMatchingBrace(code: string, startIndex: number): number {
  if (code[startIndex] !== '{') {
    return -1
  }

  let depth = 0
  let inString: string | null = null // Track quote type: '"', "'", or '`'
  let inLineComment = false
  let inBlockComment = false

  for (let i = startIndex; i < code.length; i++) {
    const char = code[i]
    const nextChar = code[i + 1]
    const prevChar = code[i - 1]

    // Handle line comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true
      continue
    }
    if (inLineComment && char === '\n') {
      inLineComment = false
      continue
    }
    if (inLineComment) continue

    // Handle block comments
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true
      i++ // Skip the '*'
      continue
    }
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false
      i++ // Skip the '/'
      continue
    }
    if (inBlockComment) continue

    // Handle strings (including template literals)
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = char
      continue
    }
    if (inString && char === inString && prevChar !== '\\') {
      inString = null
      continue
    }
    if (inString) continue

    // Count braces
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }

  return -1 // No matching brace found
}

/**
 * Find and replace a function export with an empty stub.
 * Uses brace-counting to handle arbitrary nesting depth.
 *
 * @param code - Source code
 * @param exportName - Name of the export to replace (e.g., 'loader')
 * @param isAsync - Whether the function is async
 * @returns Object with transformed code and whether a change was made
 */
function replaceExportFunction(
  code: string,
  exportName: string,
  isAsync: boolean
): { code: string; changed: boolean } {
  // Pattern to find the start of the function: export [async] function name(
  const pattern = isAsync
    ? new RegExp(`export\\s+async\\s+function\\s+${exportName}\\s*\\(`)
    : new RegExp(`export\\s+function\\s+${exportName}\\s*\\(`)

  const match = pattern.exec(code)
  if (!match) {
    return { code, changed: false }
  }

  const startIndex = match.index

  // Find the opening brace of the function body
  let braceIndex = code.indexOf('{', startIndex + match[0].length)
  if (braceIndex === -1) {
    return { code, changed: false }
  }

  // Skip any type annotations between ) and {
  // e.g., export function loader(): Promise<Data> { ... }
  const afterParams = code.slice(startIndex + match[0].length)
  const closingParenIndex = afterParams.indexOf(')')
  if (closingParenIndex !== -1) {
    braceIndex = code.indexOf('{', startIndex + match[0].length + closingParenIndex)
    if (braceIndex === -1) {
      return { code, changed: false }
    }
  }

  // Find the matching closing brace
  const endIndex = findMatchingBrace(code, braceIndex)
  if (endIndex === -1) {
    return { code, changed: false }
  }

  // Replace the entire function with an empty stub
  const stub = isAsync
    ? `export async function ${exportName}() { /* server-only: removed in client build */ }`
    : `export function ${exportName}() { /* server-only: removed in client build */ }`

  const newCode = code.slice(0, startIndex) + stub + code.slice(endIndex + 1)

  return { code: newCode, changed: true }
}

/**
 * Find and replace a const arrow function export with an empty stub.
 * Uses brace-counting for arrow functions with body blocks.
 *
 * @param code - Source code
 * @param exportName - Name of the export to replace (e.g., 'loader')
 * @returns Object with transformed code and whether a change was made
 */
function replaceExportConst(code: string, exportName: string): { code: string; changed: boolean } {
  // Pattern to find: export const name = or export const name: Type =
  const pattern = new RegExp(`export\\s+const\\s+${exportName}\\s*(?::[^=]+)?\\s*=`)

  const match = pattern.exec(code)
  if (!match) {
    return { code, changed: false }
  }

  const startIndex = match.index
  const afterEquals = startIndex + match[0].length

  // Find if there's an arrow function with a brace body
  const restOfCode = code.slice(afterEquals)

  // Check for arrow function: async? (...) => { or async? param =>
  const arrowMatch = restOfCode.match(
    /^\s*(?:async\s*)?\([^)]*\)\s*=>|^\s*(?:async\s*)?[\w$]+\s*=>/
  )
  if (!arrowMatch) {
    // Not an arrow function, could be other assignment - skip
    return { code, changed: false }
  }

  const arrowEnd = afterEquals + arrowMatch[0].length

  // Check if the body is a block (starts with {) or expression
  const afterArrow = code.slice(arrowEnd).trimStart()

  if (afterArrow.startsWith('{')) {
    // Block body - find matching brace
    const braceStart = code.indexOf('{', arrowEnd)
    const braceEnd = findMatchingBrace(code, braceStart)

    if (braceEnd === -1) {
      return { code, changed: false }
    }

    const stub = `export const ${exportName} = () => { /* server-only: removed in client build */ }`
    const newCode = code.slice(0, startIndex) + stub + code.slice(braceEnd + 1)

    return { code: newCode, changed: true }
  } else {
    // Expression body - find the end (next semicolon or newline with export/const/function/etc)
    // This is trickier, look for ; or newline followed by export/const/etc
    let endIndex = arrowEnd
    let depth = 0

    for (let i = arrowEnd; i < code.length; i++) {
      const char = code[i]

      if (char === '(' || char === '[' || char === '{') depth++
      if (char === ')' || char === ']' || char === '}') depth--

      if (depth === 0 && char === ';') {
        endIndex = i
        break
      }

      if (depth === 0 && char === '\n') {
        // Check if next non-whitespace is a new statement
        const rest = code.slice(i + 1).trimStart()
        if (rest.match(/^(export|const|let|var|function|class|import|\/\/|\/\*)/)) {
          endIndex = i
          break
        }
      }

      if (i === code.length - 1) {
        endIndex = i + 1
      }
    }

    const stub = `export const ${exportName} = () => { /* server-only: removed in client build */ }`
    const newCode = code.slice(0, startIndex) + stub + code.slice(endIndex)

    return { code: newCode, changed: true }
  }
}

/**
 * Transform hook to remove server-only exports from client bundles.
 *
 * This function processes route files during the CLIENT build and replaces
 * server-only exports (loader, action, headers) with empty stub functions.
 * Uses proper brace-counting to handle arbitrary nesting depth.
 *
 * Security: This is CRITICAL for preventing secrets from leaking to client bundles.
 * The brace-counting approach ensures that even deeply nested code blocks
 * (if/else, try/catch, loops) are properly handled.
 *
 * Strategy:
 * - Only processes route files (located in routesDir)
 * - Only runs during client builds (not SSR builds)
 * - Replaces server exports with minimal empty stubs
 * - Preserves component and other exports unchanged
 *
 * @param code - Source code of the module
 * @param id - Module ID (file path)
 * @param routesDir - Routes directory path
 * @param ssr - Whether this is an SSR build
 * @returns Transformed code with stubbed exports, or null if no transformation needed
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
    // Try async function first
    let result = replaceExportFunction(transformed, exportName, true)
    if (result.changed) {
      transformed = result.code
      hasTransforms = true
      continue // Move to next export name
    }

    // Try sync function
    result = replaceExportFunction(transformed, exportName, false)
    if (result.changed) {
      transformed = result.code
      hasTransforms = true
      continue
    }

    // Try const arrow function
    result = replaceExportConst(transformed, exportName)
    if (result.changed) {
      transformed = result.code
      hasTransforms = true
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
export function createServerOnlyRemovalPlugin(options: ServerOnlyRemovalOptions = {}): Plugin {
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
