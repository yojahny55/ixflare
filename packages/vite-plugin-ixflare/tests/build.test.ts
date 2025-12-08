/**
 * @module build.test
 * @description Tests for production build with route manifest bundling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildRoutes, bundleManifest, optimizeRoutes, type BuildConfig } from '../src/build'
import type { RouteManifest } from '../src/router-codegen'

describe('build', () => {
  let testDir: string
  let outputDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `ixflare-build-test-${Date.now()}`)
    outputDir = join(testDir, 'dist')
    await mkdir(testDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('buildRoutes', () => {
    it('should build routes and generate manifest', async () => {
      // Create test routes
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')

      const config: BuildConfig = {
        routesDir: testDir,
        outputDir,
      }

      const result = await buildRoutes(config)

      expect(result).toHaveProperty('manifest')
      expect(result.manifest.routes).toHaveLength(2)
      expect(result).toHaveProperty('success', true)
    })

    it('should detect route conflicts during build', async () => {
      // Create conflicting routes
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')
      await mkdir(join(testDir, 'about'), { recursive: true })
      await writeFile(join(testDir, 'about', 'index.tsx'), 'export function GET() {}')

      const config: BuildConfig = {
        routesDir: testDir,
        outputDir,
      }

      await expect(buildRoutes(config)).rejects.toThrow(/Route conflict detected/)
    })

    it('should include source maps when enabled', async () => {
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')

      const config: BuildConfig = {
        routesDir: testDir,
        outputDir,
        sourceMaps: true,
      }

      const result = await buildRoutes(config)

      expect(result.sourceMaps).toBe(true)
    })
  })

  describe('bundleManifest', () => {
    it('should bundle manifest with routes', () => {
      const manifest: RouteManifest = {
        routes: [
          {
            path: '/',
            file: 'index.tsx',
            params: [],
            handlers: ['GET'],
          },
          {
            path: '/about',
            file: 'about.tsx',
            params: [],
            handlers: ['GET'],
          },
        ],
        generatedAt: Date.now(),
        version: '1.0.0',
      }

      const bundled = bundleManifest(manifest)

      expect(bundled).toContain('export const routeManifest')
      expect(bundled).toContain('"path":"/"')
      expect(bundled).toContain('"path":"/about"')
    })

    it('should generate valid TypeScript code', () => {
      const manifest: RouteManifest = {
        routes: [
          {
            path: '/blog/:slug',
            file: 'blog/[slug].tsx',
            params: [{ name: 'slug', type: 'dynamic' }],
            handlers: ['GET', 'POST'],
          },
        ],
        generatedAt: Date.now(),
        version: '1.0.0',
      }

      const bundled = bundleManifest(manifest)

      expect(bundled).toContain('export const routeManifest')
      expect(bundled).toContain(':slug')
      expect(bundled).toContain('dynamic')
    })
  })

  describe('optimizeRoutes', () => {
    it('should remove duplicate routes', () => {
      const manifest: RouteManifest = {
        routes: [
          {
            path: '/',
            file: 'index.tsx',
            params: [],
            handlers: ['GET'],
          },
          {
            path: '/about',
            file: 'about.tsx',
            params: [],
            handlers: ['GET'],
          },
        ],
        generatedAt: Date.now(),
        version: '1.0.0',
      }

      const optimized = optimizeRoutes(manifest)

      expect(optimized.routes).toHaveLength(2)
    })

    it('should preserve all unique routes', () => {
      const manifest: RouteManifest = {
        routes: [
          {
            path: '/',
            file: 'index.tsx',
            params: [],
            handlers: ['GET'],
          },
          {
            path: '/blog/:slug',
            file: 'blog/[slug].tsx',
            params: [{ name: 'slug', type: 'dynamic' }],
            handlers: ['GET'],
          },
          {
            path: '/api/users',
            file: 'api/users.ts',
            params: [],
            handlers: ['GET', 'POST'],
          },
        ],
        generatedAt: Date.now(),
        version: '1.0.0',
      }

      const optimized = optimizeRoutes(manifest)

      expect(optimized.routes).toHaveLength(3)
      // More specific routes (more segments) come first: /api/users (2 segments), /blog/:slug (2 segments), / (0 segments)
      const paths = optimized.routes.map((r) => r.path)
      expect(paths).toContain('/')
      expect(paths).toContain('/blog/:slug')
      expect(paths).toContain('/api/users')
    })

    it('should sort routes by specificity', () => {
      const manifest: RouteManifest = {
        routes: [
          {
            path: '/blog/:slug',
            file: 'blog/[slug].tsx',
            params: [{ name: 'slug', type: 'dynamic' }],
            handlers: ['GET'],
          },
          {
            path: '/blog/featured',
            file: 'blog/featured.tsx',
            params: [],
            handlers: ['GET'],
          },
          {
            path: '/',
            file: 'index.tsx',
            params: [],
            handlers: ['GET'],
          },
        ],
        generatedAt: Date.now(),
        version: '1.0.0',
      }

      const optimized = optimizeRoutes(manifest)

      // More specific routes should come first
      expect(optimized.routes[0].path).toBe('/blog/featured')
      expect(optimized.routes[1].path).toBe('/blog/:slug')
      expect(optimized.routes[2].path).toBe('/')
    })
  })
})
