/**
 * @module router-codegen.test
 * @description Tests for route discovery and manifest generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  discoverRoutes,
  parseRouteFile,
  extractDynamicParams,
  detectRouteConflicts,
  generateRouteManifest,
  type Route,
  type RouteParam,
  type RouteManifest,
} from '../src/router-codegen'

describe('router-codegen', () => {
  let testDir: string

  beforeEach(async () => {
    // Create temporary test directory with unique identifier to prevent collisions
    testDir = join(
      tmpdir(),
      `ixflare-router-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('extractDynamicParams', () => {
    it('should extract single dynamic parameter', () => {
      const params = extractDynamicParams('[id].tsx')
      expect(params).toEqual([{ name: 'id', type: 'dynamic' }])
    })

    it('should extract catch-all parameter', () => {
      const params = extractDynamicParams('[...slug].tsx')
      expect(params).toEqual([{ name: 'slug', type: 'catch-all' }])
    })

    it('should return empty array for static files', () => {
      const params = extractDynamicParams('about.tsx')
      expect(params).toEqual([])
    })

    it('should extract multiple dynamic parameters from path', () => {
      const params = extractDynamicParams('blog/[year]/[month]/[slug].tsx')
      expect(params).toEqual([
        { name: 'year', type: 'dynamic' },
        { name: 'month', type: 'dynamic' },
        { name: 'slug', type: 'dynamic' },
      ])
    })
  })

  describe('parseRouteFile', () => {
    it('should parse basic route file', async () => {
      const file = join(testDir, 'index.tsx')
      await writeFile(file, 'export function GET() {}')

      const route = await parseRouteFile(file, testDir)

      expect(route.path).toBe('/')
      expect(route.file).toBe('index.tsx')
      expect(route.params).toEqual([])
      expect(route.handlers).toContain('GET')
    })

    it('should parse route with dynamic parameter', async () => {
      const file = join(testDir, '[id].tsx')
      await writeFile(file, 'export function GET() {}\nexport function POST() {}')

      const route = await parseRouteFile(file, testDir)

      expect(route.path).toBe('/:id')
      expect(route.params).toEqual([{ name: 'id', type: 'dynamic' }])
      expect(route.handlers).toContain('GET')
      expect(route.handlers).toContain('POST')
    })

    it('should parse nested route', async () => {
      await mkdir(join(testDir, 'blog'), { recursive: true })
      const file = join(testDir, 'blog', '[slug].tsx')
      await writeFile(file, 'export function GET() {}')

      const route = await parseRouteFile(file, testDir)

      expect(route.path).toBe('/blog/:slug')
      expect(route.params).toEqual([{ name: 'slug', type: 'dynamic' }])
    })

    it('should parse catch-all route', async () => {
      await mkdir(join(testDir, 'docs'), { recursive: true })
      const file = join(testDir, 'docs', '[...path].tsx')
      await writeFile(file, 'export function GET() {}')

      const route = await parseRouteFile(file, testDir)

      expect(route.path).toBe('/docs/*')
      expect(route.params).toEqual([{ name: 'path', type: 'catch-all' }])
    })

    it('should detect all HTTP method handlers', async () => {
      const file = join(testDir, 'api.ts')
      await writeFile(
        file,
        `export function GET() {}
export function POST() {}
export function PUT() {}
export function DELETE() {}
export function PATCH() {}
export function HEAD() {}
export function OPTIONS() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.handlers).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
    })

    it('should ignore files starting with underscore', async () => {
      const file = join(testDir, '_layout.tsx')
      await writeFile(file, 'export default function Layout() {}')

      await expect(parseRouteFile(file, testDir)).rejects.toThrow()
    })

    it('should detect const export pattern for methods', async () => {
      const file = join(testDir, 'api-const.ts')
      await writeFile(
        file,
        `import type { RouteHandler } from 'ixflare'

export const GET: RouteHandler = async (ctx) => {
  return new Response('GET')
}

export const POST = async (ctx) => {
  return new Response('POST')
}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.handlers).toContain('GET')
      expect(route.handlers).toContain('POST')
    })

    it('should detect mixed function and const export patterns', async () => {
      const file = join(testDir, 'mixed.ts')
      await writeFile(
        file,
        `export const GET = async () => new Response('GET')
export function POST() { return new Response('POST') }
export async function PUT() { return new Response('PUT') }
export const DELETE: RouteHandler = async () => new Response('DELETE')`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.handlers).toContain('GET')
      expect(route.handlers).toContain('POST')
      expect(route.handlers).toContain('PUT')
      expect(route.handlers).toContain('DELETE')
    })

    it('should detect loader function export', async () => {
      const file = join(testDir, 'with-loader-func.tsx')
      await writeFile(
        file,
        `export async function loader({ params }) {
  return { user: { id: params.id } }
}

export function GET() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.hasLoader).toBe(true)
      expect(route.handlers).toContain('GET')
    })

    it('should detect loader const export', async () => {
      const file = join(testDir, 'with-loader-const.tsx')
      await writeFile(
        file,
        `import type { PageLoaderFunction } from 'ixflare'

export const loader: PageLoaderFunction = async ({ params }) => {
  return { user: { id: params.id } }
}

export function GET() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.hasLoader).toBe(true)
      expect(route.handlers).toContain('GET')
    })

    it('should detect async loader function export', async () => {
      const file = join(testDir, 'with-async-loader.tsx')
      await writeFile(
        file,
        `export async function loader({ params, env }) {
  const data = await fetchSomeData(params.id)
  return { data }
}

export function GET() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.hasLoader).toBe(true)
    })

    it('should not detect loader if not exported', async () => {
      const file = join(testDir, 'without-loader.tsx')
      await writeFile(
        file,
        `// Internal loader, not exported
async function loader({ params }) {
  return { data: 'test' }
}

export function GET() {
  const data = loader({ params: {} })
  return new Response(JSON.stringify(data))
}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.hasLoader).toBe(false)
    })

    it('should handle route with both loader and handlers', async () => {
      const file = join(testDir, 'loader-and-handlers.tsx')
      await writeFile(
        file,
        `export async function loader({ params }) {
  return { user: { id: params.userId } }
}

export function GET() {}
export function POST() {}
export function DELETE() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.hasLoader).toBe(true)
      expect(route.handlers).toEqual(['GET', 'POST', 'DELETE'])
    })

    it('should detect middleware const export', async () => {
      const file = join(testDir, 'with-middleware.tsx')
      await writeFile(
        file,
        `import { createMiddleware } from 'ixflare'

export const middleware = [
  createMiddleware(async (ctx, next) => next())
]

export function GET() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.middleware).toEqual([])
      expect(route.handlers).toContain('GET')
    })

    it('should detect typed middleware export', async () => {
      const file = join(testDir, 'with-typed-middleware.tsx')
      await writeFile(
        file,
        `import type { Middleware } from 'ixflare'
import { requireAuth, rateLimit } from '@/middleware'

export const middleware: Middleware[] = [requireAuth, rateLimit]

export function GET() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.middleware).toEqual([])
    })

    it('should not detect middleware if not exported', async () => {
      const file = join(testDir, 'without-middleware.tsx')
      await writeFile(
        file,
        `const middleware = [someMiddleware]

export function GET() {}`
      )

      const route = await parseRouteFile(file, testDir)

      expect(route.middleware).toBeUndefined()
    })
  })

  describe('discoverRoutes', () => {
    it('should discover routes in directory', async () => {
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')
      await mkdir(join(testDir, 'blog'), { recursive: true })
      await writeFile(join(testDir, 'blog', '[slug].tsx'), 'export function GET() {}')

      const routes = await discoverRoutes(testDir)

      expect(routes).toHaveLength(3)
      expect(routes.some((r) => r.path === '/')).toBe(true)
      expect(routes.some((r) => r.path === '/about')).toBe(true)
      expect(routes.some((r) => r.path === '/blog/:slug')).toBe(true)
    })

    it('should ignore underscore-prefixed files', async () => {
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, '_layout.tsx'), 'export default function Layout() {}')
      await writeFile(join(testDir, '_middleware.ts'), 'export function middleware() {}')

      const routes = await discoverRoutes(testDir)

      expect(routes).toHaveLength(1)
      expect(routes[0].path).toBe('/')
    })

    it('should ignore node_modules and dot files', async () => {
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await mkdir(join(testDir, 'node_modules'), { recursive: true })
      await writeFile(join(testDir, 'node_modules', 'test.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, '.gitignore'), '')

      const routes = await discoverRoutes(testDir)

      expect(routes).toHaveLength(1)
      expect(routes[0].path).toBe('/')
    })
  })

  describe('detectRouteConflicts', () => {
    it('should detect conflict between file and index', () => {
      const routes: Route[] = [
        {
          path: '/about',
          file: 'about.tsx',
          params: [],
          handlers: ['GET'],
        },
        {
          path: '/about',
          file: 'about/index.tsx',
          params: [],
          handlers: ['GET'],
        },
      ]

      expect(() => detectRouteConflicts(routes)).toThrow(/Route conflict detected/)
      expect(() => detectRouteConflicts(routes)).toThrow(/about\.tsx/)
      expect(() => detectRouteConflicts(routes)).toThrow(/about\/index\.tsx/)
    })

    it('should not detect conflict for different paths', () => {
      const routes: Route[] = [
        {
          path: '/about',
          file: 'about.tsx',
          params: [],
          handlers: ['GET'],
        },
        {
          path: '/contact',
          file: 'contact.tsx',
          params: [],
          handlers: ['GET'],
        },
      ]

      expect(() => detectRouteConflicts(routes)).not.toThrow()
    })

    it('should detect conflict between dynamic routes', () => {
      const routes: Route[] = [
        {
          path: '/blog/:id',
          file: 'blog/[id].tsx',
          params: [{ name: 'id', type: 'dynamic' }],
          handlers: ['GET'],
        },
        {
          path: '/blog/:slug',
          file: 'blog/[slug].tsx',
          params: [{ name: 'slug', type: 'dynamic' }],
          handlers: ['GET'],
        },
      ]

      expect(() => detectRouteConflicts(routes)).toThrow(/Route conflict detected/)
    })
  })

  describe('generateRouteManifest', () => {
    it('should generate manifest with routes', () => {
      const routes: Route[] = [
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
      ]

      const manifest = generateRouteManifest(routes)

      expect(manifest.routes).toHaveLength(2)
      expect(manifest.version).toBe('1.0.0')
      expect(manifest.generatedAt).toBeGreaterThan(0)
    })

    it('should include all route information', () => {
      const routes: Route[] = [
        {
          path: '/blog/:slug',
          file: 'blog/[slug].tsx',
          params: [{ name: 'slug', type: 'dynamic' }],
          handlers: ['GET', 'POST'],
        },
      ]

      const manifest = generateRouteManifest(routes)

      expect(manifest.routes[0]).toMatchObject({
        path: '/blog/:slug',
        file: 'blog/[slug].tsx',
        params: [{ name: 'slug', type: 'dynamic' }],
        handlers: ['GET', 'POST'],
      })
    })
  })
})
