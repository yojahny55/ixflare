/**
 * @module router-codegen-config.test
 * @description Tests for route config parsing in router-codegen
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseRouteFile } from '../src/router-codegen'

describe('Router Codegen - Config Parsing', () => {
  let testDir: string

  beforeEach(async () => {
    // Create temp directory for test files
    testDir = join(tmpdir(), `ixflare-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up temp directory
    await rm(testDir, { recursive: true, force: true })
  })

  describe('Config Export Detection', () => {
    it('should detect export const config', async () => {
      const filePath = join(testDir, 'blog.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config).toBeDefined()
      expect(route.config?.rendering).toBe('ssr')
    })

    it('should detect export const config with type annotation', async () => {
      const filePath = join(testDir, 'blog.tsx')
      await writeFile(
        filePath,
        `
        import type { RouteConfig } from 'ixflare/ssr'

        export const config: RouteConfig = {
          rendering: 'ssg',
          revalidate: 3600,
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config).toBeDefined()
      expect(route.config?.rendering).toBe('ssg')
      expect(route.config?.revalidate).toBe(3600)
    })

    it('should not detect config if not exported', async () => {
      const filePath = join(testDir, 'blog.tsx')
      await writeFile(
        filePath,
        `
        const config = {
          rendering: 'ssr',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config).toBeUndefined()
    })
  })

  describe('Rendering Strategy Parsing', () => {
    it('should parse SSR rendering strategy', async () => {
      const filePath = join(testDir, 'ssr-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.rendering).toBe('ssr')
    })

    it('should parse SSG rendering strategy', async () => {
      const filePath = join(testDir, 'ssg-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssg',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.rendering).toBe('ssg')
    })

    it('should parse CSR rendering strategy', async () => {
      const filePath = join(testDir, 'csr-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'csr',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.rendering).toBe('csr')
    })

    it('should default to ssr when no rendering specified', async () => {
      const filePath = join(testDir, 'default-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          cache: { maxAge: 60 },
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.rendering).toBe('ssr')
    })

    it('should throw error on invalid rendering strategy', async () => {
      const filePath = join(testDir, 'invalid-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'invalid',
        }
        export function GET() {}
      `
      )

      await expect(parseRouteFile(filePath, testDir)).rejects.toThrow(
        /Invalid rendering strategy "invalid"/
      )
    })
  })

  describe('Cache Config Parsing', () => {
    it('should parse maxAge', async () => {
      const filePath = join(testDir, 'cached-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            maxAge: 60,
          },
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.cache?.maxAge).toBe(60)
      expect(route.config?.cache?.staleWhileRevalidate).toBeUndefined()
    })

    it('should parse staleWhileRevalidate', async () => {
      const filePath = join(testDir, 'stale-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            staleWhileRevalidate: 300,
          },
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.cache?.staleWhileRevalidate).toBe(300)
      expect(route.config?.cache?.maxAge).toBeUndefined()
    })

    it('should parse both maxAge and staleWhileRevalidate', async () => {
      const filePath = join(testDir, 'full-cache-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            maxAge: 60,
            staleWhileRevalidate: 300,
          },
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.cache?.maxAge).toBe(60)
      expect(route.config?.cache?.staleWhileRevalidate).toBe(300)
    })

    it('should handle no cache config', async () => {
      const filePath = join(testDir, 'no-cache-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.cache).toBeUndefined()
    })
  })

  describe('Revalidate Parsing', () => {
    it('should parse revalidate for SSG routes', async () => {
      const filePath = join(testDir, 'isr-route.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssg',
          revalidate: 3600,
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.revalidate).toBe(3600)
    })

    it('should handle no revalidate', async () => {
      const filePath = join(testDir, 'ssg-no-revalidate.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssg',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.revalidate).toBeUndefined()
    })
  })

  describe('getStaticPaths Detection', () => {
    it('should detect async function getStaticPaths', async () => {
      const filePath = join(testDir, 'ssg-dynamic.tsx')
      await writeFile(
        filePath,
        `
        export async function getStaticPaths() {
          return [{ params: { slug: 'post-1' } }]
        }
        export const config = { rendering: 'ssg' }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.hasGetStaticPaths).toBe(true)
    })

    it('should detect function getStaticPaths', async () => {
      const filePath = join(testDir, 'ssg-sync.tsx')
      await writeFile(
        filePath,
        `
        export function getStaticPaths() {
          return [{ params: { slug: 'post-1' } }]
        }
        export const config = { rendering: 'ssg' }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.hasGetStaticPaths).toBe(true)
    })

    it('should detect const getStaticPaths', async () => {
      const filePath = join(testDir, 'ssg-const.tsx')
      await writeFile(
        filePath,
        `
        export const getStaticPaths = async () => {
          return [{ params: { slug: 'post-1' } }]
        }
        export const config = { rendering: 'ssg' }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.hasGetStaticPaths).toBe(true)
    })

    it('should not detect getStaticPaths if not exported', async () => {
      const filePath = join(testDir, 'no-static-paths.tsx')
      await writeFile(
        filePath,
        `
        const getStaticPaths = () => []
        export const config = { rendering: 'ssg' }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.hasGetStaticPaths).toBeUndefined()
    })
  })

  describe('Complex Config Examples', () => {
    it('should parse SSR with full cache config', async () => {
      const filePath = join(testDir, 'blog-cached.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            maxAge: 60,
            staleWhileRevalidate: 300,
          },
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config).toEqual({
        rendering: 'ssr',
        cache: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      })
    })

    it('should parse SSG with ISR', async () => {
      const filePath = join(testDir, 'docs-isr.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssg',
          revalidate: 3600,
        }
        export async function getStaticPaths() {
          return [{ params: { path: 'intro' } }]
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config).toEqual({
        rendering: 'ssg',
        revalidate: 3600,
      })
      expect(route.hasGetStaticPaths).toBe(true)
    })

    it('should parse CSR config', async () => {
      const filePath = join(testDir, 'dashboard.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'csr',
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config).toEqual({
        rendering: 'csr',
      })
    })
  })

  describe('Cache Config Validation', () => {
    it('should throw error on negative maxAge', async () => {
      const filePath = join(testDir, 'negative-max-age.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            maxAge: -1,
          },
        }
        export function GET() {}
      `
      )

      await expect(parseRouteFile(filePath, testDir)).rejects.toThrow(/Invalid maxAge value "-1"/)
    })

    it('should throw error on negative staleWhileRevalidate', async () => {
      const filePath = join(testDir, 'negative-stwr.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            staleWhileRevalidate: -100,
          },
        }
        export function GET() {}
      `
      )

      await expect(parseRouteFile(filePath, testDir)).rejects.toThrow(
        /Invalid staleWhileRevalidate value "-100"/
      )
    })

    it('should throw error on negative revalidate', async () => {
      const filePath = join(testDir, 'negative-revalidate.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssg',
          revalidate: -3600,
        }
        export function GET() {}
      `
      )

      await expect(parseRouteFile(filePath, testDir)).rejects.toThrow(
        /Invalid revalidate value "-3600"/
      )
    })

    it('should allow zero values for cache config', async () => {
      const filePath = join(testDir, 'zero-cache.tsx')
      await writeFile(
        filePath,
        `
        export const config = {
          rendering: 'ssr',
          cache: {
            maxAge: 0,
            staleWhileRevalidate: 0,
          },
        }
        export function GET() {}
      `
      )

      const route = await parseRouteFile(filePath, testDir)
      expect(route.config?.cache?.maxAge).toBe(0)
      expect(route.config?.cache?.staleWhileRevalidate).toBe(0)
    })
  })
})
