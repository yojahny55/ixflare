/**
 * @module edge-record/consistency/consistency.test
 * @description Tests for multi-tier data consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineModel, field } from '@/edge-record/schema'
import { StrongConsistencyAdapter } from '@/edge-record/consistency/strong-adapter'
import { EventualConsistencyAdapter } from '@/edge-record/consistency/eventual-adapter'
import { ConsistencyCoordinator } from '@/edge-record/consistency/coordinator'
import { CacheLayer } from '@/edge-record/storage/cache-layer'

// Mock bindings
const createMockKV = (): KVNamespace => {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
  } as unknown as KVNamespace
}

const createMockD1 = (): D1Database => {
  const data: Record<string, unknown>[] = []
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...params: unknown[]) => ({
        first: vi.fn(async () => data[0] || null),
        all: vi.fn(async () => ({ results: data })),
        run: vi.fn(async () => ({ meta: { changes: 1, last_row_id: 1 } })),
      })),
    })),
    batch: vi.fn(async (stmts: unknown[]) => stmts.map(() => ({ meta: { changes: 1 } }))),
  } as unknown as D1Database
}

const createMockDOStorage = (): DurableObjectStorage => {
  const store = new Map<string, unknown>()
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    transaction: vi.fn(async (callback: (txn: DurableObjectTransaction) => Promise<unknown>) => {
      const txn = {
        get: async (key: string) => store.get(key) || null,
        put: async (key: string, value: unknown) => store.set(key, value),
        delete: async (key: string) => store.delete(key),
      } as DurableObjectTransaction
      return callback(txn)
    }),
  } as unknown as DurableObjectStorage
}

describe('Consistency - Cache Invalidation', () => {
  const Product = defineModel(
    'products',
    {
      id: field.id(),
      name: field.string(),
      price: field.decimal({ precision: 10, scale: 2 }),
      createdAt: field.datetime(),
      updatedAt: field.datetime(),
    },
    {
      cache: {
        enabled: true,
        ttl: 300,
        strategy: 'read-heavy',
        invalidationStrategy: 'immediate',
      },
    }
  )

  let mockKV: KVNamespace
  let mockD1: D1Database

  beforeEach(() => {
    mockKV = createMockKV()
    mockD1 = createMockD1()
  })

  it('should respect immediate invalidation strategy', async () => {
    const cacheLayer = new CacheLayer(Product, mockKV, mockD1, Product.$cacheConfig!)

    // Invalidate with immediate strategy
    await cacheLayer.invalidate('product-1')

    expect(mockKV.delete).toHaveBeenCalledWith('products:product-1')
  })

  it('should respect lazy invalidation strategy (no delete)', async () => {
    const LazyProduct = defineModel(
      'lazy_products',
      {
        id: field.id(),
        name: field.string(),
      },
      {
        cache: {
          enabled: true,
          invalidationStrategy: 'lazy',
        },
      }
    )

    const cacheLayer = new CacheLayer(LazyProduct, mockKV, mockD1, LazyProduct.$cacheConfig!)

    await cacheLayer.invalidate('product-1')

    // Lazy strategy should NOT delete
    expect(mockKV.delete).not.toHaveBeenCalled()
  })

  it('should support write-through mode', async () => {
    const cacheLayer = new CacheLayer(Product, mockKV, mockD1, Product.$cacheConfig!)

    await cacheLayer.writeThrough('product-1', { name: 'Widget', price: 19.99 })

    // Should write to both D1 and KV
    expect(mockD1.prepare).toHaveBeenCalled()
    expect(mockKV.put).toHaveBeenCalled()
  })
})

describe('Consistency - Strong Consistency with DO', () => {
  const Inventory = defineModel(
    'inventory',
    {
      productId: field.string().primaryKey(),
      quantity: field.integer(),
      reservedQuantity: field.integer().default(0),
    },
    {
      consistency: 'strong',
      storage: 'do',
    }
  )

  let mockDO: DurableObjectStorage

  beforeEach(() => {
    mockDO = createMockDOStorage()
  })

  it('should perform atomic increment', async () => {
    const adapter = new StrongConsistencyAdapter(Inventory, mockDO)

    // Set initial value
    await adapter.put('product-123', { productId: 'product-123', quantity: 10 })

    // Atomic increment
    const newValue = await adapter.increment('product-123', 'quantity', 5)

    expect(newValue).toBe(15)
  })

  it('should perform atomic decrement', async () => {
    const adapter = new StrongConsistencyAdapter(Inventory, mockDO)

    await adapter.put('product-123', { productId: 'product-123', quantity: 10 })

    const newValue = await adapter.decrement('product-123', 'quantity', 3)

    expect(newValue).toBe(7)
  })

  it('should support transactions', async () => {
    const adapter = new StrongConsistencyAdapter(Inventory, mockDO)

    await adapter.put('product-123', {
      productId: 'product-123',
      quantity: 10,
      reservedQuantity: 0,
    })

    await adapter.transaction(async (txn) => {
      const current = (await txn.get('inventory:product-123')) as {
        quantity: number
        reserved_quantity: number
      }
      await txn.put('inventory:product-123', {
        quantity: current.quantity - 1,
        reserved_quantity: current.reserved_quantity + 1,
      })
    })

    expect(mockDO.transaction).toHaveBeenCalled()
  })
})

describe('Consistency - Eventual Consistency with KV-First', () => {
  const PageView = defineModel(
    'page_views',
    {
      pageId: field.string().primaryKey(),
      count: field.integer(),
    },
    {
      consistency: 'eventual',
      storage: 'kv',
    }
  )

  let mockKV: KVNamespace
  let mockD1: D1Database

  beforeEach(() => {
    mockKV = createMockKV()
    mockD1 = createMockD1()
  })

  it('should write to KV first', async () => {
    const adapter = new EventualConsistencyAdapter(PageView, mockKV, mockD1, {
      manualSync: true,
    })

    await adapter.put('page-home', { pageId: 'page-home', count: 100 })

    // KV write should be immediate
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('should support manual D1 sync', async () => {
    const adapter = new EventualConsistencyAdapter(PageView, mockKV, mockD1, {
      manualSync: true,
    })

    await adapter.put('page-home', { pageId: 'page-home', count: 100 })

    const status = await adapter.syncToD1('page-home')

    expect(status).toBe('synced')
    expect(mockD1.prepare).toHaveBeenCalled()
  })

  it('should support batch sync', async () => {
    const adapter = new EventualConsistencyAdapter(PageView, mockKV, mockD1, {
      manualSync: true,
    })

    await adapter.put('page-1', { pageId: 'page-1', count: 10 })
    await adapter.put('page-2', { pageId: 'page-2', count: 20 })

    const results = await adapter.batchSync(['page-1', 'page-2'])

    expect(results.get('page-1')).toBe('synced')
    expect(results.get('page-2')).toBe('synced')
  })
})

describe('Consistency - DO-Based Coordinator', () => {
  let mockDO: DurableObjectStorage
  let mockD1: D1Database
  let mockKV: KVNamespace

  beforeEach(() => {
    mockDO = createMockDOStorage()
    mockD1 = createMockD1()
    mockKV = createMockKV()
  })

  it('should coordinate writes across tiers', async () => {
    const coordinator = new ConsistencyCoordinator(mockDO, mockD1, mockKV)

    await coordinator.write(
      'products',
      'product-1',
      { name: 'Widget', price: 19.99 },
      {
        syncToD1: true,
        invalidateKV: true,
      }
    )

    // Should write to DO, sync to D1, and invalidate KV
    expect(mockDO.put).toHaveBeenCalledWith('products:product-1', { name: 'Widget', price: 19.99 })
    expect(mockD1.prepare).toHaveBeenCalled()
    expect(mockKV.delete).toHaveBeenCalledWith('products:product-1')
  })

  it('should read with strong consistency from DO', async () => {
    const coordinator = new ConsistencyCoordinator(mockDO, mockD1, mockKV)

    await coordinator.write('products', 'product-1', { name: 'Widget' })

    const result = await coordinator.read('products', 'product-1')

    expect(result).toEqual({ name: 'Widget' })
  })

  it('should support coordinated deletes', async () => {
    const coordinator = new ConsistencyCoordinator(mockDO, mockD1, mockKV)

    await coordinator.write('products', 'product-1', { name: 'Widget' })
    await coordinator.delete('products', 'product-1', {
      syncToD1: true,
      invalidateKV: true,
    })

    expect(mockDO.delete).toHaveBeenCalledWith('products:product-1')
    expect(mockD1.prepare).toHaveBeenCalled()
    expect(mockKV.delete).toHaveBeenCalledWith('products:product-1')
  })

  it('should report health status', async () => {
    const coordinator = new ConsistencyCoordinator(mockDO, mockD1, mockKV)

    const health = await coordinator.healthCheck()

    expect(health.status).toBe('healthy')
    expect(health.checks.storage).toBe(true)
    expect(health.checks.db).toBe(true)
    expect(health.checks.kv).toBe(true)
  })

  it('should report degraded status when services missing', async () => {
    const coordinator = new ConsistencyCoordinator(mockDO)

    const health = await coordinator.healthCheck()

    expect(health.status).toBe('degraded')
    expect(health.checks.storage).toBe(true)
    expect(health.checks.db).toBe(false)
    expect(health.checks.kv).toBe(false)
  })
})

describe('Consistency - Model-Level Configuration', () => {
  it('should configure strong consistency at model level', () => {
    const Inventory = defineModel(
      'inventory',
      {
        productId: field.integer().primaryKey(),
        quantity: field.integer(),
      },
      {
        consistency: 'strong',
      }
    )

    expect(Inventory.$consistency).toBe('strong')
  })

  it('should configure eventual consistency at model level', () => {
    const PageView = defineModel(
      'page_views',
      {
        pageId: field.string().primaryKey(),
        count: field.integer(),
      },
      {
        consistency: 'eventual',
      }
    )

    expect(PageView.$consistency).toBe('eventual')
  })

  it('should default to balanced consistency', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
    })

    expect(User.$consistency).toBeUndefined() // Defaults to balanced
  })
})
