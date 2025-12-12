/**
 * @module integration/chunk-generation.test
 * @description Integration tests for route-based code splitting
 *
 * These tests verify that the complete code splitting pipeline works correctly:
 * 1. Routes are split into separate chunks during build
 * 2. Shared dependencies are extracted to vendor chunks
 * 3. Chunk sizes stay within budget constraints
 * 4. Chunk manifest is generated with correct URLs
 */

import { describe, it, expect } from 'vitest'
import type { OutputBundle, OutputChunk } from 'rollup'
import { createRouteChunks } from '../../src/code-splitting'
import { validateChunkSizes, generateChunkManifest } from '../../src/build'

/**
 * Helper to create a mock OutputChunk for testing
 */
function createMockChunk(fileName: string, code: string): [string, OutputChunk] {
  return [
    fileName,
    {
      type: 'chunk' as const,
      code,
      fileName,
      name: fileName.replace(/\.js$/, ''),
      isEntry: false,
      isDynamicEntry: false,
      facadeModuleId: null,
      imports: [],
      importedBindings: {},
      dynamicImports: [],
      exports: [],
      modules: {},
      referencedFiles: [],
      implicitlyLoadedBefore: [],
      preliminaryFileName: fileName,
      sourcemapFileName: null,
      map: null,
      moduleIds: [],
    },
  ]
}

describe('Route Code Splitting Integration', () => {
  describe('Chunk Generation Pipeline', () => {
    it('should generate separate chunks for each route', () => {
      const manualChunks = createRouteChunks('src/routes')

      // Simulate route files
      const homeChunk = manualChunks('/project/src/routes/index.tsx', {} as never)
      const aboutChunk = manualChunks('/project/src/routes/about.tsx', {} as never)
      const dashboardChunk = manualChunks('/project/src/routes/dashboard/index.tsx', {} as never)
      const settingsChunk = manualChunks('/project/src/routes/dashboard/settings.tsx', {} as never)

      // Each route should have its own chunk
      expect(homeChunk).toBe('route-index')
      expect(aboutChunk).toBe('route-about')
      expect(dashboardChunk).toBe('route-dashboard-index')
      expect(settingsChunk).toBe('route-dashboard-settings')
    })

    it('should extract vendor dependencies to separate chunks', () => {
      const manualChunks = createRouteChunks('src/routes')

      // Vendor libraries should be chunked separately
      const reactChunk = manualChunks('/project/node_modules/react/index.js', {} as never)
      const reactDomChunk = manualChunks('/project/node_modules/react-dom/client.js', {} as never)
      const zodChunk = manualChunks('/project/node_modules/zod/index.js', {} as never)

      expect(reactChunk).toBe('react-vendor')
      expect(reactDomChunk).toBe('react-vendor')
      expect(zodChunk).toBe('vendor')
    })

    it('should leave non-route/non-vendor files to default chunking', () => {
      const manualChunks = createRouteChunks('src/routes')

      // Utility files should not be manually chunked
      const utilChunk = manualChunks('/project/src/utils/helpers.ts', {} as never)
      const componentChunk = manualChunks('/project/src/components/Button.tsx', {} as never)

      expect(utilChunk).toBeUndefined()
      expect(componentChunk).toBeUndefined()
    })
  })

  describe('Bundle Size Validation', () => {
    it('should validate route chunks stay within 10KB budget', () => {
      const bundle: OutputBundle = Object.fromEntries([
        createMockChunk('chunks/route-index-abc123.js', 'x'.repeat(8 * 1024)), // 8KB - OK
        createMockChunk('chunks/route-about-def456.js', 'x'.repeat(5 * 1024)), // 5KB - OK
      ])

      const report = validateChunkSizes(bundle)

      expect(report.warningCount).toBe(0)
      expect(report.breakdown.routeChunks).toBe(2)
    })

    it('should warn when route chunk exceeds budget', () => {
      const bundle: OutputBundle = Object.fromEntries([
        createMockChunk('chunks/route-index-abc123.js', 'x'.repeat(15 * 1024)), // 15KB - OVER
      ])

      const report = validateChunkSizes(bundle)

      expect(report.warningCount).toBe(1)
      expect(report.chunks[0].warning).toBe(true)
    })

    it('should track total bundle size against 50KB budget', () => {
      const bundle: OutputBundle = Object.fromEntries([
        createMockChunk('chunks/route-index-abc123.js', 'x'.repeat(8 * 1024)),
        createMockChunk('chunks/vendor-def456.js', 'x'.repeat(20 * 1024)),
        createMockChunk('entries/main-ghi789.js', 'x'.repeat(30 * 1024)),
        // Total: 58KB > 50KB budget
      ])

      const report = validateChunkSizes(bundle)

      expect(report.totalBudgetExceeded).toBe(true)
      expect(report.totalSize).toBeGreaterThan(50 * 1024)
    })
  })

  describe('Chunk Manifest Generation', () => {
    it('should generate manifest mapping chunk names to URLs', () => {
      const bundle: OutputBundle = Object.fromEntries([
        createMockChunk('chunks/route-index-abc123.js', 'code'),
        createMockChunk('chunks/route-dashboard-def456.js', 'code'),
        createMockChunk('chunks/vendor-ghi789.js', 'code'),
      ])

      const manifest = generateChunkManifest(bundle, '/')

      // Should only include route chunks, not vendor
      expect(manifest.chunks['route-index']).toBe('/chunks/route-index-abc123.js')
      expect(manifest.chunks['route-dashboard']).toBe('/chunks/route-dashboard-def456.js')
      expect(manifest.chunks['vendor']).toBeUndefined() // Vendor not in manifest
    })

    it('should use custom base path', () => {
      const bundle: OutputBundle = Object.fromEntries([
        createMockChunk('chunks/route-index-abc123.js', 'code'),
      ])

      const manifest = generateChunkManifest(bundle, '/assets/')

      expect(manifest.chunks['route-index']).toBe('/assets/chunks/route-index-abc123.js')
    })

    it('should include generation timestamp', () => {
      const before = Date.now()
      const bundle: OutputBundle = Object.fromEntries([
        createMockChunk('chunks/route-index-abc123.js', 'code'),
      ])

      const manifest = generateChunkManifest(bundle, '/')
      const after = Date.now()

      expect(manifest.generatedAt).toBeGreaterThanOrEqual(before)
      expect(manifest.generatedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('Dynamic Route Handling', () => {
    it('should handle dynamic route segments correctly', () => {
      const manualChunks = createRouteChunks('src/routes')

      // Dynamic segments use [param] syntax
      const userChunk = manualChunks('/project/src/routes/users/[id].tsx', {} as never)
      const postChunk = manualChunks('/project/src/routes/blog/[slug].tsx', {} as never)

      expect(userChunk).toBe('route-users-_id_')
      expect(postChunk).toBe('route-blog-_slug_')
    })

    it('should handle catch-all route segments', () => {
      const manualChunks = createRouteChunks('src/routes')

      const catchAllChunk = manualChunks('/project/src/routes/docs/[...path].tsx', {} as never)

      expect(catchAllChunk).toBe('route-docs-_path_')
    })

    it('should handle nested dynamic routes', () => {
      const manualChunks = createRouteChunks('src/routes')

      const nestedChunk = manualChunks(
        '/project/src/routes/org/[orgId]/projects/[projectId].tsx',
        {} as never
      )

      expect(nestedChunk).toBe('route-org-_orgId_-projects-_projectId_')
    })
  })

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows-style paths', () => {
      const manualChunks = createRouteChunks('src\\routes')

      const chunk = manualChunks('C:\\project\\src\\routes\\dashboard.tsx', {} as never)

      expect(chunk).toBe('route-dashboard')
    })

    it('should normalize mixed path separators', () => {
      const manualChunks = createRouteChunks('src/routes')

      const chunk = manualChunks('/project/src\\routes/mixed\\path.tsx', {} as never)

      // Should still work with mixed separators
      expect(chunk).toBe('route-mixed-path')
    })
  })
})
