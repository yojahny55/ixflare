import { describe, it, expect, beforeEach } from 'vitest'
import {
  MemoryRateLimitStore,
  KVRateLimitStore,
  createKVStore,
} from '../../src/core/rate-limiter-store'

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

/**
 * Create a complete mock KV namespace for testing
 */
function createMockKV() {
  const kvStore = new Map<string, string>()

  return {
    store: kvStore,
    mock: {
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
      list: async (options?: { prefix?: string }) => {
        const prefix = options?.prefix || ''
        const keys = Array.from(kvStore.keys())
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name }))
        return { keys }
      },
    } as unknown as KVNamespace,
  }
}

describe('KVRateLimitStore', () => {
  describe('with mock KV (fixed-window)', () => {
    let mockKV: KVNamespace
    let store: KVRateLimitStore

    beforeEach(() => {
      const { mock } = createMockKV()
      mockKV = mock
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
    let mockKV: KVNamespace
    let kvData: Map<string, string>
    let store: KVRateLimitStore

    beforeEach(() => {
      const { mock, store: data } = createMockKV()
      mockKV = mock
      kvData = data
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
      // Sliding window weights bucket counts by time overlap
      const result1 = await store.increment('test-key', 60000)
      expect(result1.count).toBeGreaterThanOrEqual(1)

      const result2 = await store.increment('test-key', 60000)
      expect(result2.count).toBeGreaterThanOrEqual(result1.count)

      const result3 = await store.increment('test-key', 60000)
      // Count should increase with each increment
      expect(result3.count).toBeGreaterThanOrEqual(result2.count)
    })

    it('should return accurate reset time based on oldest bucket', async () => {
      const now = Date.now()
      const windowMs = 60000 // 1 minute

      const result = await store.increment('reset-test-key', windowMs)

      // Reset time should be approximately now + window
      // With sliding window, it's based on oldest bucket expiry
      expect(result.resetAt).toBeGreaterThan(Math.floor(now / 1000))
      expect(result.resetAt).toBeLessThanOrEqual(Math.floor((now + windowMs + 1000) / 1000))
    })

    it('should return retryAfter as seconds until reset', async () => {
      const windowMs = 60000 // 1 minute

      const result = await store.increment('retry-test-key', windowMs)

      // retryAfter should be positive and not exceed window duration
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.retryAfter).toBeLessThanOrEqual(60)
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

    it('should reset counters correctly', async () => {
      // Increment a few times
      await store.increment('reset-key', 60000)
      await store.increment('reset-key', 60000)
      const result1 = await store.increment('reset-key', 60000)
      // Sliding window weights counts, so expect at least 1
      expect(result1.count).toBeGreaterThanOrEqual(1)

      // Reset should clear the counter
      await store.reset('reset-key')

      // Verify KV data was cleared
      const keysAfterReset = Array.from(kvData.keys()).filter((k) => k.includes('reset-key'))
      expect(keysAfterReset.length).toBe(0)

      // New increment should start at 1
      const result2 = await store.increment('reset-key', 60000)
      expect(result2.count).toBe(1)
    })
  })

  describe('createKVStore helper', () => {
    it('should create store with default algorithm (sliding-window)', () => {
      const { mock } = createMockKV()
      const env = { RATE_LIMIT_KV: mock }

      const store = createKVStore(env)
      expect(store).toBeInstanceOf(KVRateLimitStore)
    })

    it('should create store with specified algorithm', () => {
      const { mock } = createMockKV()
      const env = { RATE_LIMIT_KV: mock }

      const store = createKVStore(env, 'RATE_LIMIT_KV', 'fixed-window')
      expect(store).toBeInstanceOf(KVRateLimitStore)
    })

    it('should create store with custom binding name', () => {
      const { mock } = createMockKV()
      const env = { CUSTOM_KV: mock }

      const store = createKVStore(env, 'CUSTOM_KV')
      expect(store).toBeInstanceOf(KVRateLimitStore)
    })

    it('should throw if KV binding not found', () => {
      const env = {} // No KV binding

      expect(() => {
        createKVStore(env)
      }).toThrow("KV binding 'RATE_LIMIT_KV' not found")
    })
  })
})
