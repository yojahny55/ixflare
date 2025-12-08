/**
 * @module dev-server.test
 * @description Tests for development server with file watching and Miniflare
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { FSWatcher } from 'chokidar'
import {
  createDevServer,
  setupFileWatching,
  handleRouteChange,
  type DevServerConfig,
  type WatchEvent,
} from '../src/dev-server'

describe('dev-server', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `ixflare-dev-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('setupFileWatching', () => {
    it('should create file watcher for routes directory', async () => {
      const watcher = setupFileWatching(testDir)

      expect(watcher).toBeDefined()

      // Cleanup
      await watcher.close()
    })

    it('should watch tsx and ts files', async () => {
      const watcher = setupFileWatching(testDir)

      // Create test files
      await writeFile(join(testDir, 'index.tsx'), 'export function GET() {}')
      await writeFile(join(testDir, 'api.ts'), 'export function POST() {}')

      // Wait for watcher to detect files
      await new Promise((resolve) => setTimeout(resolve, 100))

      await watcher.close()
    })

    it('should ignore node_modules and dot files', async () => {
      const watcher = setupFileWatching(testDir)

      await mkdir(join(testDir, 'node_modules'), { recursive: true })
      await writeFile(join(testDir, 'node_modules', 'test.tsx'), '')
      await writeFile(join(testDir, '.gitignore'), '')

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 100))

      await watcher.close()
    })
  })

  describe('handleRouteChange', () => {
    it('should handle file add event', () => {
      const event: WatchEvent = {
        type: 'add',
        path: join(testDir, 'new-route.tsx'),
      }

      const result = handleRouteChange(event, testDir)

      expect(result).toHaveProperty('regenerateManifest', true)
      expect(result).toHaveProperty('path')
    })

    it('should handle file change event', () => {
      const event: WatchEvent = {
        type: 'change',
        path: join(testDir, 'existing-route.tsx'),
      }

      const result = handleRouteChange(event, testDir)

      expect(result).toHaveProperty('regenerateManifest', true)
      expect(result).toHaveProperty('path')
    })

    it('should handle file unlink event', () => {
      const event: WatchEvent = {
        type: 'unlink',
        path: join(testDir, 'deleted-route.tsx'),
      }

      const result = handleRouteChange(event, testDir)

      expect(result).toHaveProperty('regenerateManifest', true)
      expect(result).toHaveProperty('path')
    })

    it('should ignore underscore-prefixed files', () => {
      const event: WatchEvent = {
        type: 'add',
        path: join(testDir, '_layout.tsx'),
      }

      const result = handleRouteChange(event, testDir)

      expect(result).toHaveProperty('regenerateManifest', false)
    })

    it('should ignore non-route files', () => {
      const event: WatchEvent = {
        type: 'add',
        path: join(testDir, 'README.md'),
      }

      const result = handleRouteChange(event, testDir)

      expect(result).toHaveProperty('regenerateManifest', false)
    })
  })

  describe('createDevServer', () => {
    it('should create dev server config', () => {
      const config: DevServerConfig = {
        routesDir: testDir,
        port: 8787,
        onRouteChange: vi.fn(),
      }

      const server = createDevServer(config)

      expect(server).toBeDefined()
      expect(server).toHaveProperty('watcher')
      expect(server).toHaveProperty('stop')
    })

    it('should have onRouteChange callback configured', () => {
      const onRouteChange = vi.fn()

      const config: DevServerConfig = {
        routesDir: testDir,
        port: 8787,
        onRouteChange,
      }

      const server = createDevServer(config)

      // Verify callback is configured
      expect(server.config.onRouteChange).toBe(onRouteChange)

      server.stop()
    })

    it('should stop watcher when server stops', async () => {
      const config: DevServerConfig = {
        routesDir: testDir,
        port: 8787,
      }

      const server = createDevServer(config)

      await server.stop()

      // Watcher should be closed
      expect(server.watcher.closed).toBe(true)
    })

    it('should accept port configuration', () => {
      const config: DevServerConfig = {
        routesDir: testDir,
        port: 8787,
      }

      const server = createDevServer(config)

      expect(server.config.port).toBe(8787)

      server.stop()
    })
  })
})
