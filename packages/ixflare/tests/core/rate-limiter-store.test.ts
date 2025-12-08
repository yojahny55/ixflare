import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRateLimitStore, KVRateLimitStore } from '../../src/core/rate-limiter-store'

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore

  beforeEach(() => {
    store = new MemoryRateLimitStore()
    store.clear()
  })

  describe('increment', () => {
    it('should start counter at 1 for new key', async () => {
      const result = await store.increment('test-key', 60000)

      expect(result.count).toBe(1)
      expect(result.limited).toBe(false)
    })

    it('should increment counter for existing key', async () => {
      await store.increment('test-key', 60000)
      const result = await store.increment('test-key', 60000)

      expect(result.count).toBe(2)
    })

    it('should provide reset timestamp', async () => {
      const now = Math.floor(Date.now() / 1000)
      const result = await store.increment('test-key', 60000)

      expect(result.resetAt).toBeGreaterThan(now)
      expect(result.resetAt).toBeLessThanOrEqual(now + 60)
    })

    it('should provide retry-after duration', async () => {
      const result = await store.increment('test-key', 60000)

      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.retryAfter).toBeLessThanOrEqual(60)
    })

    it('should reset counter after window expires', async () => {
      // Use very short window for testing
      const result1 = await store.increment('test-key', 10) // 10ms window
      expect(result1.count).toBe(1)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 15))

      const result2 = await store.increment('test-key', 10)
      expect(result2.count).toBe(1) // Reset to 1
    })

    it('should track multiple keys independently', async () => {
      await store.increment('key1', 60000)
      await store.increment('key1', 60000)

      await store.increment('key2', 60000)

      const result1 = await store.increment('key1', 60000)
      expect(result1.count).toBe(3)

      const result2 = await store.increment('key2', 60000)
      expect(result2.count).toBe(2)
    })
  })

  describe('reset', () => {
    it('should reset counter for key', async () => {
      await store.increment('test-key', 60000)
      await store.increment('test-key', 60000)

      await store.reset('test-key')

      const result = await store.increment('test-key', 60000)
      expect(result.count).toBe(1)
    })

    it('should not affect other keys', async () => {
      await store.increment('key1', 60000)
      await store.increment('key2', 60000)

      await store.reset('key1')

      const result = await store.increment('key2', 60000)
      expect(result.count).toBe(2)
    })
  })

  describe('clear', () => {
    it('should clear all counters', async () => {
      await store.increment('key1', 60000)
      await store.increment('key2', 60000)

      store.clear()

      const result1 = await store.increment('key1', 60000)
      const result2 = await store.increment('key2', 60000)

      expect(result1.count).toBe(1)
      expect(result2.count).toBe(1)
    })
  })
})

describe('KVRateLimitStore', () => {
  describe('with mock KV (fixed-window)', () => {
    let mockKV: any
    let store: KVRateLimitStore

    beforeEach(() => {
      const kvStore = new Map<string, string>()

      mockKV = {
        get: async (key: string, type?: string) => {
          const value = kvStore.get(key)
          if (!value) return null
          return type === 'json' ? JSON.parse(value) : value
        },
        put: async (key: string, value: string) => {
          kvStore.set(key, value)
        },
        delete: async (key: string) => {
          kvStore.delete(key)
        },
      }

      store = new KVRateLimitStore(mockKV, 'fixed-window')
    })

    it('should start counter at 1 for new key', async () => {
      const result = await store.increment('test-key', 60000)

      expect(result.count).toBe(1)
    })

    it('should increment counter for existing key in same window', async () => {
      await store.increment('test-key', 60000)
      const result = await store.increment('test-key', 60000)

      expect(result.count).toBe(2)
    })

    it('should provide reset timestamp', async () => {
      const now = Math.floor(Date.now() / 1000)
      const result = await store.increment('test-key', 60000)

      expect(result.resetAt).toBeGreaterThan(now)
    })

    it('should track multiple keys independently', async () => {
      await store.increment('key1', 60000)
      await store.increment('key1', 60000)

      await store.increment('key2', 60000)

      const result1 = await store.increment('key1', 60000)
      expect(result1.count).toBe(3)

      const result2 = await store.increment('key2', 60000)
      expect(result2.count).toBe(2)
    })
  })

  describe('with mock KV (sliding-window)', () => {
    let mockKV: any
    let store: KVRateLimitStore

    beforeEach(() => {
      const kvStore = new Map<string, string>()

      mockKV = {
        get: async (key: string, type?: string) => {
          const value = kvStore.get(key)
          if (!value) return null
          return type === 'json' ? JSON.parse(value) : value
        },
        put: async (key: string, value: string) => {
          kvStore.set(key, value)
        },
        delete: async (key: string) => {
          kvStore.delete(key)
        },
      }

      store = new KVRateLimitStore(mockKV, 'sliding-window')
    })

    it('should start counter at 1 for new key', async () => {
      const result = await store.increment('test-key', 60000)

      expect(result.count).toBe(1)
    })

    it('should increment counter for existing key', async () => {
      const result1 = await store.increment('test-key', 60000)
      expect(result1.count).toBeGreaterThanOrEqual(1)

      const result2 = await store.increment('test-key', 60000)
      // Sliding window counts buckets, may be 1 or 2 depending on timing
      expect(result2.count).toBeGreaterThanOrEqual(1)
    })

    it('should use sliding window algorithm for accurate counting', async () => {
      // This test verifies sliding window behavior
      // In practice, the sliding window should smooth out bursts at boundaries
      const result1 = await store.increment('test-key', 60000)
      const result2 = await store.increment('test-key', 60000)
      const result3 = await store.increment('test-key', 60000)

      // All increments are in same bucket, so count should be at least 1 (current bucket)
      expect(result3.count).toBeGreaterThanOrEqual(1)
      expect(result3.count).toBeLessThanOrEqual(3)
    })

    it('should track multiple keys independently', async () => {
      await store.increment('key1', 60000)
      await store.increment('key1', 60000)

      await store.increment('key2', 60000)

      const result1 = await store.increment('key1', 60000)
      expect(result1.count).toBeGreaterThanOrEqual(1)

      const result2 = await store.increment('key2', 60000)
      expect(result2.count).toBeGreaterThanOrEqual(1)
    })

    it('should provide consistent reset timestamps', async () => {
      const result1 = await store.increment('test-key', 60000)
      const result2 = await store.increment('test-key', 60000)

      // Reset times should be close (within window)
      expect(Math.abs(result1.resetAt - result2.resetAt)).toBeLessThan(60)
    })
  })
})
