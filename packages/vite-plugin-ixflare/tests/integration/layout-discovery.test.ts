/**
 * @fileoverview Integration tests for layout discovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverRoutes } from '../../src/router-codegen'

describe('Layout Discovery Integration', () => {
  let testDir: string

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `ixflare-layouts-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true })
  })

  it('should discover single root layout', async () => {
    // Create layout and routes
    await writeFile(
      join(testDir, '_layout.tsx'),
      'export default function Layout({ children }) { return <div>{children}</div> }'
    )
    await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
    await writeFile(join(testDir, 'about.tsx'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    expect(routes).toHaveLength(2)
    expect(routes[0].layoutChain).toEqual(['_layout.tsx'])
    expect(routes[1].layoutChain).toEqual(['_layout.tsx'])
  })

  it('should discover nested layouts', async () => {
    // Create nested structure:
    // /_layout.tsx (root)
    // /dashboard/_layout.tsx
    // /dashboard/index.tsx
    // /dashboard/settings/_layout.tsx
    // /dashboard/settings/profile.tsx

    await writeFile(join(testDir, '_layout.tsx'), 'export default function Layout({ children }) {}')
    await mkdir(join(testDir, 'dashboard'), { recursive: true })
    await writeFile(join(testDir, 'dashboard/_layout.tsx'), 'export default function DashboardLayout({ children }) {}')
    await writeFile(join(testDir, 'dashboard/index.tsx'), 'export function GET() {}')
    await mkdir(join(testDir, 'dashboard/settings'), { recursive: true })
    await writeFile(
      join(testDir, 'dashboard/settings/_layout.tsx'),
      'export default function SettingsLayout({ children }) {}'
    )
    await writeFile(join(testDir, 'dashboard/settings/profile.tsx'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    // Find specific routes
    const dashboardIndex = routes.find((r) => r.path === '/dashboard')
    const settingsProfile = routes.find((r) => r.path === '/dashboard/settings/profile')

    expect(dashboardIndex?.layoutChain).toEqual(['_layout.tsx', 'dashboard/_layout.tsx'])

    expect(settingsProfile?.layoutChain).toEqual([
      '_layout.tsx',
      'dashboard/_layout.tsx',
      'dashboard/settings/_layout.tsx',
    ])
  })

  it('should handle routes with no layouts', async () => {
    // Create route without any layouts
    await mkdir(join(testDir, 'api'), { recursive: true })
    await writeFile(join(testDir, 'api/health.ts'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    expect(routes).toHaveLength(1)
    expect(routes[0].layoutChain).toBeUndefined() // No layouts
  })

  it('should handle mixed routes with and without layouts', async () => {
    // Root layout
    await writeFile(join(testDir, '_layout.tsx'), 'export default function Layout({ children }) {}')

    // Routes with layout
    await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')

    // API routes without layout (different directory)
    await mkdir(join(testDir, 'api'), { recursive: true })
    await writeFile(join(testDir, 'api/users.ts'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    const indexRoute = routes.find((r) => r.path === '/')
    const apiRoute = routes.find((r) => r.path === '/api/users')

    expect(indexRoute?.layoutChain).toEqual(['_layout.tsx'])
    expect(apiRoute?.layoutChain).toEqual(['_layout.tsx']) // Root layout applies to all
  })

  it('should handle deeply nested layouts (5+ levels)', async () => {
    // Create deep nesting: a/b/c/d/e
    await writeFile(join(testDir, '_layout.tsx'), 'root')

    await mkdir(join(testDir, 'a'), { recursive: true })
    await writeFile(join(testDir, 'a/_layout.tsx'), 'a')

    await mkdir(join(testDir, 'a/b'), { recursive: true })
    await writeFile(join(testDir, 'a/b/_layout.tsx'), 'b')

    await mkdir(join(testDir, 'a/b/c'), { recursive: true })
    await writeFile(join(testDir, 'a/b/c/_layout.tsx'), 'c')

    await mkdir(join(testDir, 'a/b/c/d'), { recursive: true })
    await writeFile(join(testDir, 'a/b/c/d/_layout.tsx'), 'd')

    await mkdir(join(testDir, 'a/b/c/d/e'), { recursive: true })
    await writeFile(join(testDir, 'a/b/c/d/e/_layout.tsx'), 'e')
    await writeFile(join(testDir, 'a/b/c/d/e/page.tsx'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    const deepRoute = routes.find((r) => r.path === '/a/b/c/d/e/page')

    expect(deepRoute?.layoutChain).toHaveLength(6)
    expect(deepRoute?.layoutChain?.[0]).toBe('_layout.tsx')
    expect(deepRoute?.layoutChain?.[5]).toBe('a/b/c/d/e/_layout.tsx')
  })

  it('should handle dynamic route segments with layouts', async () => {
    // Create structure:
    // /blog/_layout.tsx
    // /blog/[id]/edit.tsx

    await mkdir(join(testDir, 'blog'), { recursive: true })
    await writeFile(join(testDir, 'blog/_layout.tsx'), 'export default function BlogLayout({ children }) {}')
    await writeFile(join(testDir, 'blog/[id].tsx'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    const blogPost = routes.find((r) => r.path === '/blog/:id')

    expect(blogPost?.layoutChain).toEqual(['blog/_layout.tsx'])
    expect(blogPost?.params).toHaveLength(1)
    expect(blogPost?.params[0].name).toBe('id')
  })

  it('should skip partial layout coverage correctly', async () => {
    // Create:
    // /_layout.tsx (root)
    // /dashboard/_layout.tsx
    // /dashboard/analytics.tsx (only has dashboard + root)
    // /dashboard/settings/_layout.tsx
    // /dashboard/settings/profile.tsx (has all three)

    await writeFile(join(testDir, '_layout.tsx'), 'root')
    await mkdir(join(testDir, 'dashboard'), { recursive: true })
    await writeFile(join(testDir, 'dashboard/_layout.tsx'), 'dashboard')
    await writeFile(join(testDir, 'dashboard/analytics.tsx'), 'export function GET() {}')

    await mkdir(join(testDir, 'dashboard/settings'), { recursive: true })
    await writeFile(join(testDir, 'dashboard/settings/_layout.tsx'), 'settings')
    await writeFile(join(testDir, 'dashboard/settings/profile.tsx'), 'export function GET() {}')

    const routes = await discoverRoutes(testDir)

    const analytics = routes.find((r) => r.path === '/dashboard/analytics')
    const profile = routes.find((r) => r.path === '/dashboard/settings/profile')

    expect(analytics?.layoutChain).toEqual(['_layout.tsx', 'dashboard/_layout.tsx'])

    expect(profile?.layoutChain).toEqual(['_layout.tsx', 'dashboard/_layout.tsx', 'dashboard/settings/_layout.tsx'])
  })
})
