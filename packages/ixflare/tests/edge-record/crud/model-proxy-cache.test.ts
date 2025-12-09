/**
 * @module tests/edge-record/crud/model-proxy-cache
 * @description Tests for automatic caching in model-proxy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema'
import { MockKVNamespace } from '../storage/mock-kv'

/**
 * Mock D1Database for testing cache integration
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

  // Add batch method for D1Database type guard
  batch() {
    return []
  }
}

describe('Model.find() with automatic caching', () => {
  let db: MockD1Database
  let kv: MockKVNamespace

  beforeEach(() => {
    db = new MockD1Database()
    kv = new MockKVNamespace()

    // Set up test data
    db.setData('products_cache_test', [
      {
        id: 1,
        name: 'Widget',
        price: 29.99,
        created_at: 1733311800000,
        updated_at: 1733311800000,
      },
    ])
  })

  it('should automatically cache reads when cache enabled', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
          strategy: 'balanced',
        },
      }
    )

    // First read - should hit D1 and populate cache
    const product1 = await Product.find(1, db as unknown as D1Database, kv)
    expect(product1).toBeDefined()
    expect(product1?.get('name')).toBe('Widget')

    // Second read - should hit cache (verify by checking KV)
    const cacheKey = 'products_cache_test:1'
    const cached = await kv.get(cacheKey, 'json')
    expect(cached).toBeDefined()
    expect((cached as Record<string, unknown>).name).toBe('Widget')

    // Third read - should still work from cache
    const product2 = await Product.find(1, db as unknown as D1Database, kv)
    expect(product2?.get('name')).toBe('Widget')
  })

  it('should bypass cache when cache: false option provided', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // First read with cache bypass
    const product = await Product.find(1, db as unknown as D1Database, kv, { cache: false })
    expect(product).toBeDefined()

    // Cache should be empty
    const cacheKey = 'products_cache_test:1'
    const cached = await kv.get(cacheKey)
    expect(cached).toBeNull()
  })

  it('should not cache when cache not enabled on model', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        // No cache config
      }
    )

    const product = await Product.find(1, db as unknown as D1Database, kv)
    expect(product).toBeDefined()

    // Cache should remain empty
    const cacheKey = 'products_cache_test:1'
    const cached = await kv.get(cacheKey)
    expect(cached).toBeNull()
  })

  it('should not cache when KV namespace not provided', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Call find without KV - should work but not cache
    const product = await Product.find(1, db as unknown as D1Database)
    expect(product).toBeDefined()
    expect(product?.get('name')).toBe('Widget')
  })

  it('should use cache key format tableName:id', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    await Product.find(1, db as unknown as D1Database, kv)

    // Verify cache key format
    const cacheKey = 'products_cache_test:1'
    const cached = await kv.get(cacheKey, 'json')
    expect(cached).toBeDefined()
  })

  it('should respect TTL from cache configuration', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 60, // Minimum TTL
          strategy: 'write-heavy',
        },
      }
    )

    await Product.find(1, db as unknown as D1Database, kv)

    // Cache should exist (TTL verification happens in CacheLayer tests)
    const cacheKey = 'products_cache_test:1'
    const cached = await kv.get(cacheKey, 'json')
    expect(cached).toBeDefined()
  })

  it('should respect cache strategy presets', async () => {
    const ReadHeavyProduct = defineModel(
      'products_read_heavy',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          strategy: 'read-heavy', // 600s TTL
        },
      }
    )

    expect(ReadHeavyProduct.$cacheConfig?.strategy).toBe('read-heavy')

    const WriteHeavyProduct = defineModel(
      'products_write_heavy',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          strategy: 'write-heavy', // 60s TTL
        },
      }
    )

    expect(WriteHeavyProduct.$cacheConfig?.strategy).toBe('write-heavy')
  })

  it('should return null when record not found (cached or not)', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    const product = await Product.find(999, db as unknown as D1Database, kv)
    expect(product).toBeNull()
  })

  it('should work with findOrFail using cache', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    const product = await Product.findOrFail(1, db as unknown as D1Database, kv)
    expect(product.get('name')).toBe('Widget')

    // Should have cached
    const cacheKey = 'products_cache_test:1'
    const cached = await kv.get(cacheKey, 'json')
    expect(cached).toBeDefined()
  })

  it('should throw NotFoundError when findOrFail cannot find record', async () => {
    const Product = defineModel(
      'products_cache_test',
      {
        id: field.id(),
        name: field.string(),
        price: field.decimal({ precision: 10, scale: 2 }),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    await expect(Product.findOrFail(999, db as unknown as D1Database, kv)).rejects.toThrow(
      'not found'
    )
  })
})

describe('Model.invalidateCache() - AC7', () => {
  let kv: MockKVNamespace

  beforeEach(() => {
    kv = new MockKVNamespace()
  })

  it('should manually invalidate a cache entry', async () => {
    const Product = defineModel(
      'products_invalidate_test',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Pre-populate cache
    await kv.put('products_invalidate_test:42', JSON.stringify({ id: 42, name: 'Cached Item' }))

    // Verify cache exists
    const beforeInvalidate = await kv.get('products_invalidate_test:42')
    expect(beforeInvalidate).not.toBeNull()

    // Invalidate cache
    await Product.invalidateCache(42, kv)

    // Verify cache is gone
    const afterInvalidate = await kv.get('products_invalidate_test:42')
    expect(afterInvalidate).toBeNull()
  })

  it('should handle invalidating non-existent cache entries without error', async () => {
    const Product = defineModel(
      'products_invalidate_test_2',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Should not throw when invalidating non-existent entry
    await expect(Product.invalidateCache(999, kv)).resolves.not.toThrow()
  })

  it('should invalidate cache with string ID', async () => {
    const Setting = defineModel(
      'settings_invalidate_test',
      {
        id: field.string().primaryKey(),
        value: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Pre-populate cache
    await kv.put('settings_invalidate_test:theme', JSON.stringify({ id: 'theme', value: 'dark' }))

    // Invalidate
    await Setting.invalidateCache('theme', kv)

    // Verify removed
    const cached = await kv.get('settings_invalidate_test:theme')
    expect(cached).toBeNull()
  })
})

describe('Model.warmCache() - AC8', () => {
  let db: MockD1Database
  let kv: MockKVNamespace

  beforeEach(() => {
    db = new MockD1Database()
    kv = new MockKVNamespace()

    // Set up test data
    db.setData('products_warm_test', [
      { id: 1, name: 'Product A' },
      { id: 2, name: 'Product B' },
      { id: 3, name: 'Product C' },
    ])
  })

  it('should warm cache for multiple IDs', async () => {
    const Product = defineModel(
      'products_warm_test',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Warm cache
    await Product.warmCache([1, 2, 3], db as unknown as D1Database, kv)

    // Verify all items are cached
    const cached1 = await kv.get('products_warm_test:1', 'json')
    const cached2 = await kv.get('products_warm_test:2', 'json')
    const cached3 = await kv.get('products_warm_test:3', 'json')

    expect(cached1).toBeDefined()
    expect(cached2).toBeDefined()
    expect(cached3).toBeDefined()
    expect((cached1 as Record<string, unknown>).name).toBe('Product A')
    expect((cached2 as Record<string, unknown>).name).toBe('Product B')
    expect((cached3 as Record<string, unknown>).name).toBe('Product C')
  })

  it('should handle empty IDs array without error', async () => {
    const Product = defineModel(
      'products_warm_test_2',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Should not throw
    await expect(Product.warmCache([], db as unknown as D1Database, kv)).resolves.not.toThrow()
  })

  it('should only warm existing records (skip non-existent)', async () => {
    const Product = defineModel(
      'products_warm_test',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        cache: {
          enabled: true,
          ttl: 300,
        },
      }
    )

    // Warm cache with mix of existing and non-existing IDs
    await Product.warmCache([1, 999], db as unknown as D1Database, kv)

    // Existing should be cached
    const cached1 = await kv.get('products_warm_test:1', 'json')
    expect(cached1).toBeDefined()

    // Non-existing should not be cached
    const cached999 = await kv.get('products_warm_test:999')
    expect(cached999).toBeNull()
  })

  it('should warn when cache is not enabled on model', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const Product = defineModel(
      'products_no_cache_warm',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        storage: 'd1',
        // No cache config
      }
    )

    await Product.warmCache([1], db as unknown as D1Database, kv)

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('warmCache called on model')
    )

    consoleSpy.mockRestore()
  })
})
