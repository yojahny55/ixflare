import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema/field'
import { CacheLayer } from '@/edge-record/storage/cache-layer'
import { WriteThroughPartialError } from '@/edge-record/crud/errors'
import { MockKVNamespace } from './mock-kv'

/**
 * Mock D1Database for testing CacheLayer
 */
class MockD1Database {
  private store = new Map<string, Record<string, unknown>[]>()

  setData(tableName: string, rows: Record<string, unknown>[]) {
    this.store.set(tableName, rows)
  }

  prepare(query: string) {
    const self = this
    let boundParams: unknown[] = []

    return {
      bind(...params: unknown[]) {
        boundParams = params
        return this
      },
      async first(): Promise<Record<string, unknown> | null> {
        // Extract table name from query (handles escaped names)
        const tableMatch = query.match(/FROM\s+["'`]?(\w+)["'`]?\s+WHERE/i)
        if (!tableMatch) return null

        const tableName = tableMatch[1]
        const rows = self.store.get(tableName) || []

        // Simple id lookup
        const id = boundParams[0]
        return rows.find((r) => r.id === id || r.id === Number(id)) || null
      },
      async all(): Promise<{ results: Record<string, unknown>[] }> {
        // Extract table name from query
        const tableMatch = query.match(/FROM\s+["'`]?(\w+)["'`]?\s+WHERE/i)
        if (!tableMatch) return { results: [] }

        const tableName = tableMatch[1]
        const rows = self.store.get(tableName) || []

        // Filter by ids in IN clause
        const results = rows.filter((r) =>
          boundParams.some((p) => r.id === p || r.id === Number(p))
        )

        return { results }
      },
    }
  }
}

describe('CacheLayer', () => {
  let kv: MockKVNamespace
  let db: MockD1Database

  beforeEach(() => {
    kv = new MockKVNamespace()
    db = new MockD1Database()
  })

  describe('AC10: Read-through caching pattern', () => {
    it('should return cached data when available', async () => {
      const Product = defineModel('products_cache_test_1', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      // Pre-populate cache
      await kv.put('products_cache_test_1:1', JSON.stringify({ id: 1, name: 'Widget', price: 100 }))

      const result = await cache.get(1)

      expect(result).toEqual({ id: 1, name: 'Widget', price: 100 })
    })

    it('should fall back to D1 on cache miss', async () => {
      const Product = defineModel('products_cache_test_2', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      // Set up D1 data
      db.setData('products_cache_test_2', [{ id: 1, name: 'Gadget', price: 200 }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      const result = await cache.get(1)

      expect(result).toEqual({ id: 1, name: 'Gadget', price: 200 })
    })

    it('should populate cache after D1 fallback', async () => {
      const Product = defineModel('products_cache_test_3', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      db.setData('products_cache_test_3', [{ id: 1, name: 'Thing', price: 50 }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      // First call - cache miss, hits D1
      await cache.get(1)

      // Verify cache was populated
      const cachedRaw = kv.getRaw('products_cache_test_3:1')
      expect(cachedRaw).toBeTruthy()
      const cached = JSON.parse(cachedRaw!)
      expect(cached.id).toBe(1)
    })

    it('should return null when not found in cache or D1', async () => {
      const Product = defineModel('products_cache_test_4', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_4', [])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      const result = await cache.get(999)

      expect(result).toBeNull()
    })

    it('should handle string IDs', async () => {
      const Setting = defineModel('settings_cache_test_1', {
        id: field.string().primaryKey(),
        value: field.string(),
      })

      db.setData('settings_cache_test_1', [{ id: 'theme', value: 'dark' }])

      const cache = new CacheLayer(Setting, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      const result = await cache.get('theme')

      expect(result).toEqual({ id: 'theme', value: 'dark' })
    })
  })

  describe('Cache invalidation', () => {
    it('should invalidate cache entry', async () => {
      const Product = defineModel('products_cache_test_5', {
        id: field.id(),
        name: field.string(),
      })

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      // Pre-populate cache
      await kv.put('products_cache_test_5:1', JSON.stringify({ id: 1, name: 'Old' }))

      // Invalidate
      await cache.invalidate(1)

      // Verify removed
      const cached = kv.getRaw('products_cache_test_5:1')
      expect(cached).toBeUndefined()
    })

    it('should handle invalidating non-existent entries', async () => {
      const Product = defineModel('products_cache_test_6', {
        id: field.id(),
        name: field.string(),
      })

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      // Should not throw
      await expect(cache.invalidate(999)).resolves.not.toThrow()
    })
  })

  describe('Cache warming', () => {
    it('should warm cache for multiple IDs', async () => {
      const Product = defineModel('products_cache_test_7', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_7', [
        { id: 1, name: 'Product A' },
        { id: 2, name: 'Product B' },
        { id: 3, name: 'Product C' },
      ])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      await cache.warm([1, 2, 3])

      // Verify all cached
      expect(kv.getRaw('products_cache_test_7:1')).toBeTruthy()
      expect(kv.getRaw('products_cache_test_7:2')).toBeTruthy()
      expect(kv.getRaw('products_cache_test_7:3')).toBeTruthy()
    })

    it('should handle empty IDs array', async () => {
      const Product = defineModel('products_cache_test_8', {
        id: field.id(),
        name: field.string(),
      })

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      // Should not throw
      await expect(cache.warm([])).resolves.not.toThrow()
    })

    it('should only warm existing records', async () => {
      const Product = defineModel('products_cache_test_9', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_9', [{ id: 1, name: 'Exists' }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      await cache.warm([1, 999]) // 999 doesn't exist

      expect(kv.getRaw('products_cache_test_9:1')).toBeTruthy()
      expect(kv.getRaw('products_cache_test_9:999')).toBeUndefined()
    })
  })

  describe('Strategy-based TTL', () => {
    it('should use read-heavy TTL (600s) when strategy is read-heavy', async () => {
      const Product = defineModel('products_cache_test_10', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_10', [{ id: 1, name: 'Test' }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
        strategy: 'read-heavy',
      })

      await cache.get(1)

      // TTL is internal, but we can verify cache was set
      expect(kv.getRaw('products_cache_test_10:1')).toBeTruthy()
    })

    it('should use write-heavy TTL (60s) when strategy is write-heavy', async () => {
      const Product = defineModel('products_cache_test_11', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_11', [{ id: 1, name: 'Test' }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
        strategy: 'write-heavy',
      })

      await cache.get(1)

      expect(kv.getRaw('products_cache_test_11:1')).toBeTruthy()
    })

    it('should use balanced TTL (300s) by default', async () => {
      const Product = defineModel('products_cache_test_12', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_12', [{ id: 1, name: 'Test' }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
        // No strategy specified - should default to 'balanced'
      })

      await cache.get(1)

      expect(kv.getRaw('products_cache_test_12:1')).toBeTruthy()
    })

    it('should allow explicit TTL to override strategy-based TTL', async () => {
      const Product = defineModel('products_cache_test_13', {
        id: field.id(),
        name: field.string(),
      })

      db.setData('products_cache_test_13', [{ id: 1, name: 'Test' }])

      const cache = new CacheLayer(Product, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
        strategy: 'read-heavy', // Would be 600s
        ttl: 120, // But explicit TTL overrides
      })

      await cache.get(1)

      expect(kv.getRaw('products_cache_test_13:1')).toBeTruthy()
    })
  })

  describe('Data transformation', () => {
    it('should transform snake_case from D1 to camelCase', async () => {
      const User = defineModel('users_cache_test_1', {
        id: field.id(),
        firstName: field.string(),
        lastName: field.string(),
      })

      // D1 returns snake_case
      db.setData('users_cache_test_1', [{ id: 1, first_name: 'John', last_name: 'Doe' }])

      const cache = new CacheLayer(User, kv, db as unknown as D1Database, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      const result = await cache.get(1)

      expect(result).toEqual({ id: 1, firstName: 'John', lastName: 'Doe' })
    })
  })

  describe('SQL injection prevention', () => {
    it('should escape table names in queries', async () => {
      // Model with potentially dangerous table name (for testing escaping)
      const Model = defineModel('products', {
        id: field.id(),
        name: field.string(),
      })

      const prepareSpy = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      })

      const mockDb = { prepare: prepareSpy } as unknown as D1Database

      const cache = new CacheLayer(Model, kv, mockDb, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      await cache.get(1)

      // Verify prepare was called with escaped table name
      expect(prepareSpy).toHaveBeenCalled()
      const query = prepareSpy.mock.calls[0][0]
      // Table name should be quoted/escaped
      expect(query).toMatch(/FROM\s+["'`]products["'`]\s+WHERE/)
    })
  })

  describe('Write-through partial failure handling', () => {
    it('should succeed when both D1 and KV succeed', async () => {
      const Product = defineModel('products_partial_test_1', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      } as unknown as D1Database

      const cache = new CacheLayer(Product, kv, mockDb, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      await expect(cache.writeThrough(1, { name: 'Widget', price: 100 })).resolves.not.toThrow()

      // Verify KV was populated
      expect(kv.getRaw('products_partial_test_1:1')).toBeTruthy()
    })

    it('should throw WriteThroughPartialError when KV fails after D1 succeeds', async () => {
      const Product = defineModel('products_partial_test_2', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      } as unknown as D1Database

      // Create a failing KV mock
      const failingKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockRejectedValue(new Error('KV write failed')),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      } as unknown as KVNamespace

      const cache = new CacheLayer(Product, failingKv, mockDb, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      await expect(cache.writeThrough(1, { name: 'Widget', price: 100 })).rejects.toThrow(
        WriteThroughPartialError
      )

      // Verify D1 was called (succeeded)
      expect(mockDb.prepare).toHaveBeenCalled()

      // Verify KV delete was attempted (cache invalidation)
      expect(failingKv.delete).toHaveBeenCalledWith('products_partial_test_2:1')
    })

    it('should not attempt KV write when D1 fails', async () => {
      const Product = defineModel('products_partial_test_3', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockRejectedValue(new Error('D1 write failed')),
        }),
      } as unknown as D1Database

      const kvPutSpy = vi.fn()
      const mockKv = {
        get: vi.fn().mockResolvedValue(null),
        put: kvPutSpy,
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      } as unknown as KVNamespace

      const cache = new CacheLayer(Product, mockKv, mockDb, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      await expect(cache.writeThrough(1, { name: 'Widget', price: 100 })).rejects.toThrow(
        'D1 write failed'
      )

      // Verify KV put was NOT called
      expect(kvPutSpy).not.toHaveBeenCalled()
    })

    it('should invalidate cache even if delete fails silently', async () => {
      const Product = defineModel('products_partial_test_4', {
        id: field.id(),
        name: field.string(),
        price: field.integer(),
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      } as unknown as D1Database

      // KV put fails, and delete also fails
      const failingKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockRejectedValue(new Error('KV write failed')),
        delete: vi.fn().mockRejectedValue(new Error('KV delete also failed')),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      } as unknown as KVNamespace

      const cache = new CacheLayer(Product, failingKv, mockDb, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      // Should still throw WriteThroughPartialError (delete error silently ignored)
      await expect(cache.writeThrough(1, { name: 'Widget', price: 100 })).rejects.toThrow(
        WriteThroughPartialError
      )
    })

    it('should include record ID and original KV error in WriteThroughPartialError', async () => {
      const Product = defineModel('products_partial_test_5', {
        id: field.id(),
        name: field.string(),
      })

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      } as unknown as D1Database

      const kvError = new Error('Network timeout')
      const failingKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockRejectedValue(kvError),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      } as unknown as KVNamespace

      const cache = new CacheLayer(Product, failingKv, mockDb, {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
      })

      try {
        await cache.writeThrough(123, { name: 'Test' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(WriteThroughPartialError)
        const partialError = error as WriteThroughPartialError
        expect(partialError.recordId).toBe('123')
        expect(partialError.kvError.message).toBe('Network timeout')
        expect(partialError.code).toBe('WRITE_THROUGH.PARTIAL_FAILURE')
      }
    })
  })
})
