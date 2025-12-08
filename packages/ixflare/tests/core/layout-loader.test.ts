/**
 * @fileoverview Tests for parallel layout loader execution
 */

import { describe, it, expect, vi } from 'vitest'
import { executeLoaders, executeLayoutLoaders } from '../../src/core/layout-loader'
import type { LayoutLoaderArgs } from '../../src/types/handlers'

describe('Layout Loader Execution', () => {
  const mockArgs: LayoutLoaderArgs = {
    request: new Request('https://example.com/dashboard'),
    params: { id: '123' },
    env: { DATABASE: 'mock' },
    ctx: {} as ExecutionContext,
    query: new URLSearchParams('?filter=active'),
    url: new URL('https://example.com/dashboard'),
    method: 'GET',
    headers: new Headers(),
  }

  describe('executeLoaders', () => {
    it('should execute single layout loader and page loader in parallel', async () => {
      const rootLoader = vi.fn(async () => ({ theme: 'dark' }))
      const pageLoader = vi.fn(async () => ({ title: 'Dashboard' }))

      const [layoutData, pageData] = await executeLoaders([rootLoader], pageLoader, mockArgs)

      expect(rootLoader).toHaveBeenCalledWith(mockArgs)
      expect(pageLoader).toHaveBeenCalledWith(mockArgs)
      expect(layoutData).toEqual([{ theme: 'dark' }])
      expect(pageData).toEqual({ title: 'Dashboard' })
    })

    it('should execute multiple layout loaders in parallel', async () => {
      const rootLoader = vi.fn(async () => ({ theme: 'dark' }))
      const dashboardLoader = vi.fn(async () => ({ dashboard: 'Analytics' }))
      const pageLoader = vi.fn(async () => ({ title: 'Page' }))

      const [layoutData, pageData] = await executeLoaders(
        [rootLoader, dashboardLoader],
        pageLoader,
        mockArgs
      )

      expect(rootLoader).toHaveBeenCalledWith(mockArgs)
      expect(dashboardLoader).toHaveBeenCalledWith(mockArgs)
      expect(pageLoader).toHaveBeenCalledWith(mockArgs)
      expect(layoutData).toEqual([{ theme: 'dark' }, { dashboard: 'Analytics' }])
      expect(pageData).toEqual({ title: 'Page' })
    })

    it('should run loaders in parallel (not sequential)', async () => {
      const startTimes: number[] = []
      const endTimes: number[] = []

      const rootLoader = vi.fn(async () => {
        startTimes.push(Date.now())
        await new Promise((resolve) => setTimeout(resolve, 10))
        endTimes.push(Date.now())
        return { root: true }
      })

      const pageLoader = vi.fn(async () => {
        startTimes.push(Date.now())
        await new Promise((resolve) => setTimeout(resolve, 10))
        endTimes.push(Date.now())
        return { page: true }
      })

      await executeLoaders([rootLoader], pageLoader, mockArgs)

      // Both should start around the same time (parallel execution)
      const timeDiff = Math.abs(startTimes[1] - startTimes[0])
      expect(timeDiff).toBeLessThan(5) // Started within 5ms of each other
    })

    it('should handle loader without page loader', async () => {
      const rootLoader = vi.fn(async () => ({ theme: 'dark' }))

      const [layoutData, pageData] = await executeLoaders([rootLoader], undefined, mockArgs)

      expect(layoutData).toEqual([{ theme: 'dark' }])
      expect(pageData).toBeUndefined()
    })

    it('should handle no layout loaders, only page loader', async () => {
      const pageLoader = vi.fn(async () => ({ title: 'Page' }))

      const [layoutData, pageData] = await executeLoaders([], pageLoader, mockArgs)

      expect(layoutData).toEqual([])
      expect(pageData).toEqual({ title: 'Page' })
    })

    it('should preserve order of layout data matching loader order', async () => {
      const loader1 = vi.fn(async () => 'first')
      const loader2 = vi.fn(async () => 'second')
      const loader3 = vi.fn(async () => 'third')
      const pageLoader = vi.fn(async () => 'page')

      const [layoutData, pageData] = await executeLoaders(
        [loader1, loader2, loader3],
        pageLoader,
        mockArgs
      )

      expect(layoutData).toEqual(['first', 'second', 'third'])
      expect(pageData).toBe('page')
    })

    it('should handle synchronous loaders', async () => {
      const rootLoader = vi.fn(() => ({ theme: 'dark' }))
      const pageLoader = vi.fn(() => ({ title: 'Page' }))

      const [layoutData, pageData] = await executeLoaders([rootLoader], pageLoader, mockArgs)

      expect(layoutData).toEqual([{ theme: 'dark' }])
      expect(pageData).toEqual({ title: 'Page' })
    })

    it('should handle mixed sync and async loaders', async () => {
      const syncLoader = vi.fn(() => ({ sync: true }))
      const asyncLoader = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return { async: true }
      })

      const [layoutData] = await executeLoaders([syncLoader, asyncLoader], undefined, mockArgs)

      expect(layoutData).toEqual([{ sync: true }, { async: true }])
    })

    it('should propagate loader errors', async () => {
      const errorLoader = vi.fn(async () => {
        throw new Error('Loader failed')
      })

      await expect(executeLoaders([errorLoader], undefined, mockArgs)).rejects.toThrow(
        'Loader failed'
      )
    })

    it('should fail fast when any loader throws', async () => {
      const slowLoader = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { slow: true }
      })

      const errorLoader = vi.fn(async () => {
        throw new Error('Fast fail')
      })

      const startTime = Date.now()
      await expect(executeLoaders([slowLoader, errorLoader], undefined, mockArgs)).rejects.toThrow(
        'Fast fail'
      )
      const duration = Date.now() - startTime

      // Should fail immediately when errorLoader throws, not wait for slowLoader
      expect(duration).toBeLessThan(50)
    })
  })

  describe('executeLayoutLoaders', () => {
    it('should execute multiple layout loaders in parallel', async () => {
      const loader1 = vi.fn(async () => ({ data: 1 }))
      const loader2 = vi.fn(async () => ({ data: 2 }))

      const results = await executeLayoutLoaders([loader1, loader2], mockArgs)

      expect(loader1).toHaveBeenCalledWith(mockArgs)
      expect(loader2).toHaveBeenCalledWith(mockArgs)
      expect(results).toEqual([{ data: 1 }, { data: 2 }])
    })

    it('should return empty array for no loaders', async () => {
      const results = await executeLayoutLoaders([], mockArgs)

      expect(results).toEqual([])
    })

    it('should run in parallel (performance check)', async () => {
      const loader1 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'a'
      })

      const loader2 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'b'
      })

      const startTime = Date.now()
      await executeLayoutLoaders([loader1, loader2], mockArgs)
      const duration = Date.now() - startTime

      // Parallel: ~10ms, Sequential would be ~20ms
      expect(duration).toBeLessThan(15)
    })
  })
})
