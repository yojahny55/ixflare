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

import { readdir, readFile, stat, realpath } from 'node:fs/promises'
import { join, basename, relative, resolve } from 'node:path'

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
  /** List of prop names extracted from component */
  props: string[]
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

  // Remove single-line comments to avoid false positives from commented-out code
  // This prevents matching "// export const island = true"
  const contentWithoutComments = content
    .split('\n')
    .map((line) => {
      // Remove single-line comments (but preserve strings that might contain //)
      const commentIndex = line.indexOf('//')
      if (commentIndex === -1) return line
      // Simple heuristic: if // appears before any quote, it's likely a comment
      const quoteIndex = Math.min(
        line.indexOf('"') === -1 ? Infinity : line.indexOf('"'),
        line.indexOf("'") === -1 ? Infinity : line.indexOf("'"),
        line.indexOf('`') === -1 ? Infinity : line.indexOf('`')
      )
      if (commentIndex < quoteIndex) {
        return line.slice(0, commentIndex)
      }
      return line
    })
    .join('\n')

  // Check for island export marker using regex
  // Matches: export const island = true | { load: 'strategy' }
  const hasIslandExport = /export\s+const\s+island\s*=/.test(contentWithoutComments)

  if (!hasIslandExport) {
    return null
  }

  // Extract component name from filename
  const fileName = basename(filePath, '.client.tsx')
  const componentName = toPascalCase(fileName)
  const id = toKebabCase(componentName)

  // Extract load strategy if present
  // Match: island = { ... load: 'idle' ... } with load appearing anywhere in the object
  // Uses [^}]* to match any content before load: to handle objects with multiple properties
  const loadMatch = contentWithoutComments.match(/island\s*=\s*\{[^}]*load:\s*['"](\w+)['"]/)
  const loadStrategy = (loadMatch?.[1] as IslandLoadStrategy) || 'immediate'

  // Extract props from component definition
  const props = extractPropsFromContent(contentWithoutComments, componentName)

  return {
    id,
    filePath,
    componentName,
    loadStrategy,
    props,
  }
}

/**
 * Extracts prop names from component content
 *
 * Attempts to extract props from:
 * 1. Interface/type Props definitions
 * 2. Function parameter destructuring
 * 3. Arrow function parameter destructuring
 *
 * @param content - File content without comments
 * @param componentName - Name of the component
 * @returns Array of prop names
 */
function extractPropsFromContent(content: string, componentName: string): string[] {
  const props: Set<string> = new Set()

  // Strategy 1: Extract from interface/type Props definition
  // Matches: interface XxxProps { prop1: type; prop2?: type; }
  // or: type XxxProps = { prop1: type; prop2?: type; }
  const propsTypeMatch = content.match(
    new RegExp(`(?:interface|type)\\s+${componentName}Props\\s*(?:=\\s*)?\\{([^}]+)\\}`, 's')
  )

  if (propsTypeMatch) {
    const propsBody = propsTypeMatch[1]
    // Extract property names, handling optional (?) markers
    const propMatches = propsBody.matchAll(/(\w+)\s*\??\s*:/g)
    for (const match of propMatches) {
      props.add(match[1])
    }
  }

  // Strategy 2: Extract from generic Props interface
  // Matches: interface Props { prop1: type; prop2?: type; }
  const genericPropsMatch = content.match(/(?:interface|type)\s+Props\s*(?:=\s*)?\{([^}]+)\}/s)

  if (genericPropsMatch) {
    const propsBody = genericPropsMatch[1]
    const propMatches = propsBody.matchAll(/(\w+)\s*\??\s*:/g)
    for (const match of propMatches) {
      props.add(match[1])
    }
  }

  // Strategy 3: Extract from function parameter destructuring
  // Matches: function ComponentName({ prop1, prop2 }: Props)
  // or: export default function ComponentName({ prop1, prop2 }
  const funcDestructureMatch = content.match(
    new RegExp(`function\\s+${componentName}\\s*\\(\\s*\\{([^}]+)\\}`, 's')
  )

  if (funcDestructureMatch) {
    extractDestructuredProps(funcDestructureMatch[1], props)
  }

  // Strategy 4: Extract from arrow function parameter destructuring
  // Matches: const ComponentName = ({ prop1, prop2 }: Props) =>
  const arrowDestructureMatch = content.match(
    new RegExp(`(?:const|let)\\s+${componentName}\\s*=\\s*\\(\\s*\\{([^}]+)\\}`, 's')
  )

  if (arrowDestructureMatch) {
    extractDestructuredProps(arrowDestructureMatch[1], props)
  }

  // Strategy 5: Extract from inline type annotation in function params
  // Matches: function Counter({ count }: { count: number })
  const inlineTypeMatch = content.match(
    new RegExp(`function\\s+${componentName}\\s*\\([^)]*:\\s*\\{([^}]+)\\}`, 's')
  )

  if (inlineTypeMatch) {
    const propsBody = inlineTypeMatch[1]
    const propMatches = propsBody.matchAll(/(\w+)\s*\??\s*:/g)
    for (const match of propMatches) {
      props.add(match[1])
    }
  }

  return Array.from(props).sort()
}

/**
 * Extracts prop names from destructuring pattern
 *
 * @param destructureBody - Content inside { }
 * @param props - Set to add props to
 */
function extractDestructuredProps(destructureBody: string, props: Set<string>): void {
  // Remove type annotations to just get prop names
  // Handle: { prop1, prop2 = default, prop3: renamed }
  const cleaned = destructureBody.replace(/:\s*[^,}]+/g, '')

  // Extract identifiers (prop names)
  const matches = cleaned.matchAll(/(\w+)(?:\s*=)?/g)
  for (const match of matches) {
    const propName = match[1]
    // Filter out common non-prop identifiers
    if (propName && !['Props', 'children'].includes(propName)) {
      props.add(propName)
    }
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

  // Resolve the root directory to an absolute path for security validation
  const resolvedRootDir = resolve(rootDir)

  /**
   * Validates that a path is within the allowed root directory.
   * Prevents path traversal attacks via symlinks or malformed paths.
   */
  async function isPathWithinRoot(targetPath: string): Promise<boolean> {
    try {
      // Resolve the real path (following symlinks) to prevent symlink-based traversal
      const realTargetPath = await realpath(targetPath)
      const realRootPath = await realpath(resolvedRootDir)

      // Ensure the resolved path starts with the root directory
      return realTargetPath.startsWith(realRootPath)
    } catch {
      // If we can't resolve the path, it's not safe to use
      return false
    }
  }

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

      // Security: Skip entries that would escape the root directory
      if (!(await isPathWithinRoot(fullPath))) {
        console.warn(`[ixflare] Skipping path outside root directory: ${fullPath}`)
        continue
      }

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

  await scanDirectory(resolvedRootDir)

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
