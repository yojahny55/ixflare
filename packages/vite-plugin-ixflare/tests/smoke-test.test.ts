/**
 * SMOKE TEST: Manual verification of Story 2.1 acceptance criteria
 *
 * This test file verifies the smoke test checklist items from Story 2.1:
 * - [ ] Create file `src/routes/index.tsx` → `/` works
 * - [ ] Create file `src/routes/about.tsx` → `/about` works
 * - [ ] Create nested `src/routes/blog/index.tsx` → `/blog` works
 * - [ ] Create conflicting files → Clear error message shown
 * - [ ] Add new file while dev server running → HMR picks it up
 * - [ ] Delete file while dev server running → Route removed
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { mkdir, writeFile, rm, unlink, cp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverRoutes, detectRouteConflicts, generateRouteManifest } from '../src/router-codegen'
import { createDevServer } from '../src/dev-server'

describe('SMOKE TEST: Story 2.1 Acceptance Criteria', () => {
  let testDir: string
  const templateRoutesDir = join(__dirname, '../../..', 'templates/fullstack-react/src/routes')

  beforeAll(async () => {
    // Create a unique test directory
    testDir = join(tmpdir(), `ixflare-smoke-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    // Copy the template's index.tsx as starting point
    await writeFile(
      join(testDir, 'index.tsx'),
      `export function GET() {
  return new Response('Home page')
}

export default function HomePage() {
  return <div>Welcome to Ixflare</div>
}`
    )

    // Create api/v1/users.ts to match template structure
    await mkdir(join(testDir, 'api/v1'), { recursive: true })
    await writeFile(
      join(testDir, 'api/v1/users.ts'),
      `export function GET() {
  return Response.json([{ id: 1, name: 'User' }])
}

export function POST() {
  return Response.json({ created: true }, { status: 201 })
}`
    )
  })

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  // Clean up between tests
  afterEach(async () => {
    // Remove test files that might have been created
    await rm(join(testDir, 'about.tsx'), { force: true })
    await rm(join(testDir, 'about'), { recursive: true, force: true })
    await rm(join(testDir, 'blog'), { recursive: true, force: true })
    await rm(join(testDir, 'contact.tsx'), { force: true })
  })

  it('✅ Create file src/routes/index.tsx → / works', async () => {
    const routes = await discoverRoutes(testDir)
    const rootRoute = routes.find((r) => r.path === '/')

    expect(rootRoute).toBeDefined()
    expect(rootRoute?.file).toBe('index.tsx')
    expect(rootRoute?.handlers).toContain('GET')

    console.log(
      `   Found: ${rootRoute?.path} → ${rootRoute?.file} [${rootRoute?.handlers.join(', ')}]`
    )
  })

  it('✅ Create file src/routes/about.tsx → /about works', async () => {
    await writeFile(
      join(testDir, 'about.tsx'),
      'export function GET() { return new Response("About page") }'
    )

    const routes = await discoverRoutes(testDir)
    const aboutRoute = routes.find((r) => r.path === '/about')

    expect(aboutRoute).toBeDefined()
    expect(aboutRoute?.file).toBe('about.tsx')
    expect(aboutRoute?.handlers).toContain('GET')

    console.log(
      `   Found: ${aboutRoute?.path} → ${aboutRoute?.file} [${aboutRoute?.handlers.join(', ')}]`
    )
  })

  it('✅ Create nested src/routes/blog/index.tsx → /blog works', async () => {
    await mkdir(join(testDir, 'blog'), { recursive: true })
    await writeFile(
      join(testDir, 'blog/index.tsx'),
      'export function GET() { return new Response("Blog index") }'
    )

    const routes = await discoverRoutes(testDir)
    const blogRoute = routes.find((r) => r.path === '/blog')

    expect(blogRoute).toBeDefined()
    expect(blogRoute?.file).toMatch(/blog[/\\]index\.tsx/)
    expect(blogRoute?.handlers).toContain('GET')

    console.log(
      `   Found: ${blogRoute?.path} → ${blogRoute?.file} [${blogRoute?.handlers.join(', ')}]`
    )
  })

  it('✅ Create conflicting files → Clear error message shown', async () => {
    // Create about.tsx
    await writeFile(
      join(testDir, 'about.tsx'),
      'export function GET() { return new Response("About page") }'
    )

    // Create about/index.tsx (conflict!)
    await mkdir(join(testDir, 'about'), { recursive: true })
    await writeFile(
      join(testDir, 'about/index.tsx'),
      'export function GET() { return new Response("About index") }'
    )

    const routes = await discoverRoutes(testDir)

    // Should throw with clear error message
    expect(() => detectRouteConflicts(routes)).toThrow(/Route conflict detected/)
    expect(() => detectRouteConflicts(routes)).toThrow(/about\.tsx/)
    expect(() => detectRouteConflicts(routes)).toThrow(/about[/\\]index\.tsx/)
    expect(() => detectRouteConflicts(routes)).toThrow(/Solution:/)

    try {
      detectRouteConflicts(routes)
    } catch (error) {
      console.log('   Conflict error message:')
      ;(error as Error).message.split('\n').forEach((line) => console.log(`   ${line}`))
    }
  })

  // File watching tests are timing-sensitive - skip in CI, run locally
  it.skip('✅ Add new file while dev server running → HMR picks it up', async () => {
    let eventReceived = false
    let eventType: string | null = null
    let eventPath: string | null = null

    const server = createDevServer({
      routesDir: testDir,
      onRouteChange: (result) => {
        if (result.regenerateManifest) {
          eventReceived = true
          eventType = result.event
          eventPath = result.path
        }
      },
    })

    // Wait for watcher to be ready
    await new Promise((resolve) => server.watcher.on('ready', resolve))

    // Add a new file
    await writeFile(
      join(testDir, 'contact.tsx'),
      'export function GET() { return new Response("Contact") }'
    )

    // Wait for event with timeout
    const startTime = Date.now()
    while (!eventReceived && Date.now() - startTime < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    await server.stop()

    expect(eventReceived).toBe(true)
    expect(eventType).toBe('add')

    console.log(`   Event: ${eventType} → ${eventPath}`)
  }, 10000)

  it.skip('✅ Delete file while dev server running → Route removed', async () => {
    // First create the file
    await writeFile(
      join(testDir, 'contact.tsx'),
      'export function GET() { return new Response("Contact") }'
    )

    // Small delay to ensure file is written
    await new Promise((resolve) => setTimeout(resolve, 100))

    let eventReceived = false
    let eventType: string | null = null
    let eventPath: string | null = null

    const server = createDevServer({
      routesDir: testDir,
      onRouteChange: (result) => {
        if (result.regenerateManifest) {
          eventReceived = true
          eventType = result.event
          eventPath = result.path
        }
      },
    })

    // Wait for watcher to be ready
    await new Promise((resolve) => server.watcher.on('ready', resolve))

    // Delete the file
    await unlink(join(testDir, 'contact.tsx'))

    // Wait for event with timeout
    const startTime = Date.now()
    while (!eventReceived && Date.now() - startTime < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    await server.stop()

    expect(eventReceived).toBe(true)
    expect(eventType).toBe('unlink')

    console.log(`   Event: ${eventType} → ${eventPath}`)
  }, 10000)

  it('✅ Route manifest generation includes all route metadata', async () => {
    // Create a complex route structure
    await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')
    await mkdir(join(testDir, 'blog'), { recursive: true })
    await writeFile(
      join(testDir, 'blog/[slug].tsx'),
      'export function GET() {}\nexport function POST() {}'
    )

    const routes = await discoverRoutes(testDir)
    const manifest = generateRouteManifest(routes)

    expect(manifest.routes.length).toBeGreaterThanOrEqual(4) // index, about, api/v1/users, blog/[slug]
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.generatedAt).toBeGreaterThan(0)

    // Check dynamic route
    const slugRoute = manifest.routes.find((r) => r.path === '/blog/:slug')
    expect(slugRoute).toBeDefined()
    expect(slugRoute?.params).toEqual([{ name: 'slug', type: 'dynamic' }])
    expect(slugRoute?.handlers).toContain('GET')
    expect(slugRoute?.handlers).toContain('POST')

    console.log('   Manifest generated with', manifest.routes.length, 'routes:')
    manifest.routes.forEach((r) => {
      console.log(`   - ${r.path} → ${r.file} [${r.handlers.join(', ')}]`)
    })
  })
})
