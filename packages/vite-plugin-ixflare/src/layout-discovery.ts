/**
 * @module layout-discovery
 * @description Layout file discovery and hierarchy tree building
 * @node-only
 */

import { readFile } from 'node:fs/promises'
import { relative, dirname, sep } from 'node:path'
import fg from 'fast-glob'

export interface LayoutNode {
  file: string // Relative path: dashboard/settings/_layout.tsx
  parentDir: string // Parent directory: dashboard/settings
  depth: number // Nesting depth: 0 for root, 1+ for nested
  hasLoader?: boolean // True if layout exports 'loader' function
}

/**
 * Discover all layout files in routes directory
 * Layouts are files named _layout.tsx, _layout.ts, _layout.jsx, or _layout.js
 */
export async function discoverLayouts(routesDir: string): Promise<LayoutNode[]> {
  // Find all _layout files
  const files = await fg(['**/_layout.{ts,tsx,js,jsx}'], {
    cwd: routesDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.*'],
    concurrency: 10,
  })

  const layouts: LayoutNode[] = []

  for (const file of files) {
    const relativePath = relative(routesDir, file)
    const parentDir = dirname(relativePath)

    // Calculate depth: count directory separators
    // Root (_layout.tsx) = depth 0
    // dashboard/_layout.tsx = depth 1
    // dashboard/settings/_layout.tsx = depth 2
    const depth = parentDir === '.' ? 0 : parentDir.split(sep).length

    // Detect if layout exports a loader function
    const content = await readFile(file, 'utf-8')
    const hasLoader = /export\s+(?:async\s+)?function\s+loader\s*\(/.test(content)

    layouts.push({
      file: relativePath.replace(/\\/g, '/'), // Normalize Windows paths
      parentDir: parentDir === '.' ? '' : parentDir.replace(/\\/g, '/'),
      depth,
      hasLoader,
    })
  }

  return layouts
}

/**
 * Extract layout chain for a specific route
 * Returns layouts from outermost (root) to innermost
 *
 * @param routeFile - Route file path (relative to routes dir)
 * @param layouts - All discovered layouts
 * @returns Array of layout file paths in nesting order
 */
export function extractLayoutChain(routeFile: string, layouts: LayoutNode[]): string[] {
  const routeDir = dirname(routeFile).replace(/\\/g, '/') // Normalize
  const routeDirSegments = routeDir === '.' ? [] : routeDir.split('/')

  // Find all layouts that are ancestors of this route
  const applicableLayouts = layouts.filter((layout) => {
    // Root layout applies to all routes
    if (layout.parentDir === '') {
      return true
    }

    // Check if layout's directory is a parent of route's directory
    const layoutSegments = layout.parentDir.split('/')

    // Layout must not be deeper than route
    if (layoutSegments.length > routeDirSegments.length) {
      return false
    }

    // Check if all layout segments match route segments
    return layoutSegments.every((seg, i) => seg === routeDirSegments[i])
  })

  // Sort by depth (outermost first)
  const sortedLayouts = applicableLayouts.sort((a, b) => a.depth - b.depth)

  return sortedLayouts.map((layout) => layout.file)
}
