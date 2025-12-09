import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { createMockD1Database } from '../crud/mock-d1'
import { MockKVNamespace } from '../storage/mock-kv'
import { MockDurableObjectStorage } from '../storage/mock-do'
import { field } from '@/edge-record/schema/field'
import { hasMany } from '@/edge-record/relations'
import { NotFoundError } from '@/edge-record/crud/errors'

describe('defineModel() Storage Integration', () => {
  describe('AC11: Model $storage property exposes selected tier', () => {
    it('should expose $storage property on model', () => {
      const User = defineModel('users_storage_int_1', {
        id: field.id(),
        email: field.string(),
      })

      expect(User).toHaveProperty('$storage')
      expect(typeof User.$storage).toBe('string')
    })

    it('should set $storage to "d1" by default', () => {
      const User = defineModel('users_storage_int_2', {
        id: field.id(),
        email: field.string(),
        name: field.string(),
      })

      expect(User.$storage).toBe('d1')
    })

    it('should set $storage to "kv" for simple key-value patterns', () => {
      const Setting = defineModel('settings_storage_int_1', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      expect(Setting.$storage).toBe('kv')
    })

    it('should set $storage to "do" when consistency: "strong"', () => {
      const Counter = defineModel(
        'counters_storage_int_1',
        {
          id: field.id(),
          value: field.integer(),
        },
        { consistency: 'strong' }
      )

      expect(Counter.$storage).toBe('do')
    })

    it('should respect explicit storage: "kv" option', () => {
      const User = defineModel(
        'users_storage_int_3',
        {
          id: field.id(),
          email: field.string(),
        },
        { storage: 'kv' }
      )

      expect(User.$storage).toBe('kv')
    })

    it('should respect explicit storage: "d1" option', () => {
      const Setting = defineModel(
        'settings_storage_int_2',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'd1' }
      )

      expect(Setting.$storage).toBe('d1')
    })

    it('should respect explicit storage: "do" option', () => {
      const User = defineModel(
        'users_storage_int_4',
        {
          id: field.id(),
          email: field.string(),
        },
        { storage: 'do' }
      )

      expect(User.$storage).toBe('do')
    })
  })

  describe('AC12: Storage tier selection works with CRUD operations', () => {
    it('should create and retrieve model with D1 tier', async () => {
      const User = defineModel('users_storage_int_5', {
        id: field.id(),
        email: field.string(),
      })

      const d1 = createMockD1Database()

      // Test Create
      await User.create({ email: 'd1@example.com' }, d1)

      // Verify D1 persistence (by retrieving it)
      const found = await User.find(1, d1)
      expect(found).not.toBeNull()
      expect(found?.get('email')).toBe('d1@example.com')
    })

    it('should create and retrieve model with KV tier', async () => {
      const Setting = defineModel(
        'settings_storage_int_3',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      const kv = new MockKVNamespace()

      // Test Create
      await Setting.create({ key: 'site_title', value: 'My Site' }, kv)

      // Verify KV persistence
      expect(kv.getRaw('settings_storage_int_3:site_title')).toContain('My Site')

      // Test Find
      const found = await Setting.find('site_title', kv)
      expect(found).not.toBeNull()
      expect(found?.get('value')).toBe('My Site')
    })

    it('should create and retrieve model with DO tier', async () => {
      const Counter = defineModel(
        'counters_storage_int_2',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      const doStorage = new MockDurableObjectStorage()

      // Test Create
      await Counter.create({ id: 'cnt_1', value: 42 }, doStorage)

      // Verify DO persistence
      const stored = doStorage.getRaw('counters_storage_int_2:cnt_1') as any
      expect(stored).toBeDefined()
      expect(stored.value).toBe(42)

      // Test Find
      const found = await Counter.find('cnt_1', doStorage)
      expect(found).not.toBeNull()
      expect(found?.get('value')).toBe(42)
    })

    it('should throw error when passing wrong storage binding', async () => {
      const KVModel = defineModel(
        'kv_mismatch_test',
        { id: field.string().primaryKey() },
        { storage: 'kv' }
      )
      const d1 = createMockD1Database()

      await expect(KVModel.create({ id: '1' }, d1 as any)).rejects.toThrow(/configured for KV/)
    })
  })

  describe('Storage tier with relations', () => {
    it('should default to D1 for models with relations', () => {
      const User = defineModel(
        'users_storage_int_6',
        {
          id: field.id(),
          email: field.string(),
        },
        {
          relations: {
            posts: hasMany('posts_storage_int', 'userId'),
          },
        }
      )

      expect(User.$storage).toBe('d1')
    })

    it('should use explicit storage even if model has relations', () => {
      const User = defineModel(
        'users_storage_int_7',
        {
          id: field.id(),
          email: field.string(),
        },
        {
          storage: 'kv', // Explicit override
          relations: {
            posts: hasMany('posts_storage_int_2', 'userId'),
          },
        }
      )

      expect(User.$storage).toBe('kv')
    })
  })

  describe('Cache configuration', () => {
    it('should accept cache options without affecting storage tier', () => {
      const Product = defineModel(
        'products_storage_int_1',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          cache: {
            enabled: true,
            tier: 'kv',
            populateFrom: 'd1',
            ttl: 300,
          },
        }
      )

      expect(Product.$storage).toBe('d1')
      // Cache options are stored in model options, not directly on model
    })

    it('should work with explicit storage tier and cache', () => {
      const Product = defineModel(
        'products_storage_int_2',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          storage: 'd1',
          cache: {
            enabled: true,
            tier: 'kv',
            ttl: 600,
          },
        }
      )

      expect(Product.$storage).toBe('d1')
    })
  })

  describe('TTL option', () => {
    it('should accept ttl option for KV storage', () => {
      const Session = defineModel(
        'sessions_storage_int_1',
        {
          token: field.string().primaryKey(),
          data: field.json(),
        },
        {
          storage: 'kv',
          ttl: 3600,
        }
      )

      expect(Session.$storage).toBe('kv')
      // TTL is used by KV adapter at runtime
    })
  })
})

describe('AC12: Storage-Aware CRUD Execution', () => {
  describe('KV Storage CRUD', () => {
    let kv: MockKVNamespace

    beforeEach(() => {
      kv = new MockKVNamespace()
    })

    it('should create a record in KV storage', async () => {
      const Setting = defineModel(
        'settings_crud_kv_1',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      expect(Setting.$storage).toBe('kv')

      const result = await Setting.create({ key: 'theme', value: 'dark' }, kv)

      expect(result.get('key')).toBe('theme')
      expect(result.get('value')).toBe('dark')

      // Verify it's in KV
      const stored = await kv.get('settings_crud_kv_1:theme', 'json')
      expect(stored).toBeTruthy()
    })

    it('should find a record in KV storage', async () => {
      const Setting = defineModel(
        'settings_crud_kv_2',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      // Pre-populate KV
      await kv.put('settings_crud_kv_2:lang', JSON.stringify({ key: 'lang', value: 'en' }))

      const result = await Setting.find('lang', kv)

      expect(result).not.toBeNull()
      expect(result!.get('key')).toBe('lang')
      expect(result!.get('value')).toBe('en')
    })

    it('should return null when record not found in KV', async () => {
      const Setting = defineModel(
        'settings_crud_kv_3',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      const result = await Setting.find('nonexistent', kv)

      expect(result).toBeNull()
    })

    it('should throw NotFoundError on findOrFail for missing KV record', async () => {
      const Setting = defineModel(
        'settings_crud_kv_4',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      await expect(Setting.findOrFail('missing', kv)).rejects.toThrow(NotFoundError)
    })

    it('should upsert a record in KV storage', async () => {
      const Setting = defineModel(
        'settings_crud_kv_5',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      // Create
      await Setting.upsert({ key: 'mode' }, { value: 'light' }, kv)

      // Update
      const result = await Setting.upsert({ key: 'mode' }, { value: 'dark' }, kv)

      expect(result.get('value')).toBe('dark')
    })

    it('should createMany records in KV storage', async () => {
      const Setting = defineModel(
        'settings_crud_kv_6',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      const results = await Setting.createMany(
        [
          { key: 'a', value: '1' },
          { key: 'b', value: '2' },
          { key: 'c', value: '3' },
        ],
        kv
      )

      expect(results).toHaveLength(3)
      expect(results[0].get('key')).toBe('a')
      expect(results[1].get('key')).toBe('b')
      expect(results[2].get('key')).toBe('c')
    })

    it('should delete a record from KV storage', async () => {
      const Setting = defineModel(
        'settings_crud_kv_7',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      // Create first
      await Setting.create({ key: 'temp', value: 'data' }, kv)
      expect(await Setting.find('temp', kv)).not.toBeNull()

      // Delete
      await Setting.delete('temp', kv)
      expect(await Setting.find('temp', kv)).toBeNull()
    })
  })

  describe('DO Storage CRUD', () => {
    let storage: MockDurableObjectStorage

    beforeEach(() => {
      storage = new MockDurableObjectStorage()
    })

    it('should create a record in DO storage', async () => {
      const Counter = defineModel(
        'counters_crud_do_1',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      expect(Counter.$storage).toBe('do')

      const result = await Counter.create({ id: 'page_views', value: 0 }, storage)

      expect(result.get('id')).toBe('page_views')
      expect(result.get('value')).toBe(0)

      // Verify it's in DO
      const stored = await storage.get('counters_crud_do_1:page_views')
      expect(stored).toBeTruthy()
    })

    it('should find a record in DO storage', async () => {
      const Counter = defineModel(
        'counters_crud_do_2',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      // Pre-populate DO
      await storage.put('counters_crud_do_2:clicks', { id: 'clicks', value: 42 })

      const result = await Counter.find('clicks', storage)

      expect(result).not.toBeNull()
      expect(result!.get('id')).toBe('clicks')
      expect(result!.get('value')).toBe(42)
    })

    it('should return null when record not found in DO', async () => {
      const Counter = defineModel(
        'counters_crud_do_3',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      const result = await Counter.find('nonexistent', storage)

      expect(result).toBeNull()
    })

    it('should throw NotFoundError on findOrFail for missing DO record', async () => {
      const Counter = defineModel(
        'counters_crud_do_4',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      await expect(Counter.findOrFail('missing', storage)).rejects.toThrow(NotFoundError)
    })

    it('should upsert a record in DO storage', async () => {
      const Counter = defineModel(
        'counters_crud_do_5',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      // Create
      await Counter.upsert({ id: 'score' }, { value: 100 }, storage)

      // Update
      const result = await Counter.upsert({ id: 'score' }, { value: 200 }, storage)

      expect(result.get('value')).toBe(200)
    })

    it('should delete a record from DO storage', async () => {
      const Counter = defineModel(
        'counters_crud_do_6',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      // Create first
      await Counter.create({ id: 'temp', value: 999 }, storage)
      expect(await Counter.find('temp', storage)).not.toBeNull()

      // Delete
      await Counter.delete('temp', storage)
      expect(await Counter.find('temp', storage)).toBeNull()
    })
  })

  describe('Storage tier mismatch errors', () => {
    it('should throw error when DO model receives KV binding', async () => {
      const Counter = defineModel(
        'counters_mismatch_1',
        {
          id: field.string().primaryKey(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      const kv = new MockKVNamespace()

      await expect(Counter.create({ id: 'test', value: 0 }, kv)).rejects.toThrow(
        /Storage tier mismatch/
      )
    })

    it('should throw error when D1 model receives KV binding', async () => {
      const User = defineModel(
        'users_mismatch_1',
        {
          id: field.id(),
          email: field.string(),
        },
        { storage: 'd1' }
      )

      const kv = new MockKVNamespace()

      await expect(User.create({ email: 'test@example.com' }, kv)).rejects.toThrow(
        /Storage tier mismatch/
      )
    })
  })
})
