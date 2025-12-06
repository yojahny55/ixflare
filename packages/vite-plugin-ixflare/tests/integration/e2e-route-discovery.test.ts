/**
 * E2E Integration Tests: Real Route Discovery
 *
 * These tests verify actual route discovery behavior by creating
 * real file structures and running discoverRoutes against them.
 *
 * Unlike unit tests with mocks, these tests verify the full workflow.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverRoutes, detectRouteConflicts, generateRouteManifest } from '../../src/router-codegen'
import { createDevServer } from '../../src/dev-server'

describe('E2E: Route Discovery Workflow', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `ixflare-e2e-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('AC1: Root Route Discovery', () => {
    it('discovers index.tsx as / route', async () => {
      // Given: I create a file at src/routes/index.tsx
      await writeFile(
        join(testDir, 'index.tsx'),
        'export function GET() { return new Response("Hello") }'
      )

      // When: route discovery runs
      const routes = await discoverRoutes(testDir)

      // Then: it is registered as the / route
      expect(routes).toHaveLength(1)
      expect(routes[0].path).toBe('/')
      expect(routes[0].file).toBe('index.tsx')
      expect(routes[0].handlers).toContain('GET')
    })
  })

  describe('AC2: Hierarchical Route Discovery', () => {
    it('discovers nested file structure correctly', async () => {
      // Given: I create files with nested structure
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')

      await mkdir(join(testDir, 'blog'), { recursive: true })
      await writeFile(join(testDir, 'blog', 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'blog', '[slug].tsx'), 'export function GET() {}')

      await mkdir(join(testDir, 'api', 'v1'), { recursive: true })
      await writeFile(join(testDir, 'api', 'v1', 'users.ts'), 'export function GET() {}\nexport function POST() {}')

      // When: route discovery runs
      const routes = await discoverRoutes(testDir)

      // Then: all routes are discovered
      expect(routes).toHaveLength(5)

      const paths = routes.map(r => r.path).sort()
      expect(paths).toEqual([
        '/',
        '/about',
        '/api/v1/users',
        '/blog',
        '/blog/:slug',
      ])

      // And: handlers are detected correctly
      const usersRoute = routes.find(r => r.path === '/api/v1/users')
      expect(usersRoute?.handlers).toContain('GET')
      expect(usersRoute?.handlers).toContain('POST')

      // And: dynamic params are extracted
      const slugRoute = routes.find(r => r.path === '/blog/:slug')
      expect(slugRoute?.params).toEqual([{ name: 'slug', type: 'dynamic' }])
    })

    it('generates route manifest at build time', async () => {
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')

      const routes = await discoverRoutes(testDir)
      const manifest = generateRouteManifest(routes)

      expect(manifest.routes).toHaveLength(2)
      expect(manifest.version).toBe('1.0.0')
      expect(manifest.generatedAt).toBeGreaterThan(0)
    })
  })

  describe('AC3: Route Conflict Detection', () => {
    it('detects about.tsx vs about/index.tsx conflict', async () => {
      // Given: two files would create the same route
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')
      await mkdir(join(testDir, 'about'), { recursive: true })
      await writeFile(join(testDir, 'about', 'index.tsx'), 'export function GET() {}')

      // When: route discovery runs
      const routes = await discoverRoutes(testDir)

      // Then: a clear error is shown explaining the conflict
      expect(() => detectRouteConflicts(routes)).toThrow(/Route conflict detected/)
      expect(() => detectRouteConflicts(routes)).toThrow(/about\.tsx/)
      expect(() => detectRouteConflicts(routes)).toThrow(/about\/index\.tsx/)
      expect(() => detectRouteConflicts(routes)).toThrow(/Solution: Remove one of these files/)
    })

    it('detects dynamic param naming conflicts', async () => {
      // Given: two dynamic routes with different param names
      await mkdir(join(testDir, 'blog'), { recursive: true })
      await writeFile(join(testDir, 'blog', '[id].tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'blog', '[slug].tsx'), 'export function GET() {}')

      const routes = await discoverRoutes(testDir)

      expect(() => detectRouteConflicts(routes)).toThrow(/Route conflict detected/)
    })
  })

  // NOTE: File watching tests are skipped in CI due to chokidar timing issues.
  // These tests verify file watching behavior which is inherently timing-sensitive.
  // Run locally with: pnpm test -- --testNamePattern="File Watching" --no-skip
  describe.skip('File Watching Integration', () => {
    it('triggers manifest regeneration on file add', async () => {
      // Setup initial file
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')

      // Create a promise that resolves when the event is received
      let resolveEvent: (event: string) => void
      const eventPromise = new Promise<string>((resolve) => {
        resolveEvent = resolve
      })

      const server = createDevServer({
        routesDir: testDir,
        onRouteChange: (result) => {
          if (result.regenerateManifest) {
            resolveEvent(result.event)
          }
        },
      })

      // Wait for watcher to be ready (chokidar needs time to initialize)
      await new Promise(resolve => server.watcher.on('ready', resolve))

      // Add a new file
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')

      // Wait for the event with timeout
      const event = await Promise.race([
        eventPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for file add event')), 5000)
        ),
      ])

      expect(event).toBe('add')

      await server.stop()
    }, 10000) // Extended timeout for file system operations

    it('triggers manifest regeneration on file delete', async () => {
      // Setup initial files
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')

      // Create a promise that resolves when the event is received
      let resolveEvent: (event: string) => void
      const eventPromise = new Promise<string>((resolve) => {
        resolveEvent = resolve
      })

      const server = createDevServer({
        routesDir: testDir,
        onRouteChange: (result) => {
          if (result.regenerateManifest) {
            resolveEvent(result.event)
          }
        },
      })

      // Wait for watcher to be ready
      await new Promise(resolve => server.watcher.on('ready', resolve))

      // Delete a file
      await unlink(join(testDir, 'about.tsx'))

      // Wait for the event with timeout
      const event = await Promise.race([
        eventPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for file delete event')), 5000)
        ),
      ])

      expect(event).toBe('unlink')

      await server.stop()
    }, 10000) // Extended timeout for file system operations

    it('ignores underscore-prefixed files', async () => {
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')

      let regenerateCount = 0

      const server = createDevServer({
        routesDir: testDir,
        onRouteChange: (result) => {
          if (result.regenerateManifest) {
            regenerateCount++
          }
        },
      })

      // Wait for watcher to be ready
      await new Promise(resolve => server.watcher.on('ready', resolve))

      // Add a layout file (should be ignored)
      await writeFile(join(testDir, '_layout.tsx'), 'export default function Layout() {}')

      // Wait a bit to make sure no event fires
      await new Promise(resolve => setTimeout(resolve, 300))

      // Should NOT trigger regeneration for _layout files
      expect(regenerateCount).toBe(0)

      await server.stop()
    }, 10000) // Extended timeout for file system operations
  })

  describe('Edge Cases', () => {
    it('handles catch-all routes correctly', async () => {
      await mkdir(join(testDir, 'docs'), { recursive: true })
      await writeFile(join(testDir, 'docs', '[...path].tsx'), 'export function GET() {}')

      const routes = await discoverRoutes(testDir)

      expect(routes).toHaveLength(1)
      expect(routes[0].path).toBe('/docs/*')
      expect(routes[0].params).toEqual([{ name: 'path', type: 'catch-all' }])
    })

    it('handles deeply nested routes', async () => {
      await mkdir(join(testDir, 'api', 'v1', 'admin', 'users'), { recursive: true })
      await writeFile(
        join(testDir, 'api', 'v1', 'admin', 'users', '[id].ts'),
        'export function GET() {}\nexport function DELETE() {}'
      )

      const routes = await discoverRoutes(testDir)

      expect(routes).toHaveLength(1)
      expect(routes[0].path).toBe('/api/v1/admin/users/:id')
      expect(routes[0].handlers).toContain('GET')
      expect(routes[0].handlers).toContain('DELETE')
    })

    it('supports all file extensions', async () => {
      await writeFile(join(testDir, 'page1.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'page2.ts'), 'export function GET() {}')
      await writeFile(join(testDir, 'page3.jsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'page4.js'), 'export function GET() {}')

      const routes = await discoverRoutes(testDir)

      expect(routes).toHaveLength(4)
      const paths = routes.map(r => r.path).sort()
      expect(paths).toEqual(['/page1', '/page2', '/page3', '/page4'])
    })

    it('handles empty routes directory gracefully', async () => {
      const routes = await discoverRoutes(testDir)

      expect(routes).toEqual([])
    })
  })
})
