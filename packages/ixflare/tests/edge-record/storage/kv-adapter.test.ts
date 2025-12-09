import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema/field'
import { KVAdapter } from '@/edge-record/storage/kv-adapter'
import { MockKVNamespace } from './mock-kv'

describe('KVAdapter', () => {
  let kv: MockKVNamespace

  beforeEach(() => {
    kv = new MockKVNamespace()
  })

  describe('Basic operations (AC4, AC7)', () => {
    it('should store and retrieve records with snake_case to camelCase transformation', async () => {
      const Setting = defineModel('settings_kv_test_1', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Setting, kv)

      await adapter.put('theme', { key: 'theme', value: 'dark' })
      const result = await adapter.get('theme')

      expect(result).toEqual({ key: 'theme', value: 'dark' })
    })

    it('should return null for non-existent keys', async () => {
      const Setting = defineModel('settings_kv_test_2', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Setting, kv)

      const result = await adapter.get('nonexistent')

      expect(result).toBeNull()
    })

    it('should delete records', async () => {
      const Setting = defineModel('settings_kv_test_3', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Setting, kv)

      await adapter.put('temp', { key: 'temp', value: 'data' })
      expect(await adapter.get('temp')).not.toBeNull()

      await adapter.delete('temp')
      expect(await adapter.get('temp')).toBeNull()
    })

    it('should handle partial data updates', async () => {
      const User = defineModel('users_kv_test_1', {
        id: field.string().primaryKey(),
        name: field.string(),
        email: field.string(),
      })

      const adapter = new KVAdapter(User, kv)

      await adapter.put('user1', { id: 'user1', name: 'Alice', email: 'alice@example.com' })
      const result = await adapter.get('user1')

      expect(result).toEqual({ id: 'user1', name: 'Alice', email: 'alice@example.com' })
    })
  })

  describe('AC7: TTL support for auto-expiration', () => {
    it('should accept ttl option', async () => {
      const Session = defineModel('sessions_kv_test_1', {
        token: field.string().primaryKey(),
        data: field.json(),
      })

      const adapter = new KVAdapter(Session, kv, { ttl: 300 })

      await adapter.put('session1', { token: 'abc123', data: { userId: '1' } })
      const result = await adapter.get('session1')

      expect(result).not.toBeNull()
    })

    it('should throw error if ttl < 60 seconds (KV minimum)', () => {
      const Session = defineModel('sessions_kv_test_2', {
        token: field.string().primaryKey(),
        data: field.json(),
      })

      expect(() => {
        new KVAdapter(Session, kv, { ttl: 30 })
      }).toThrow('TTL must be at least 60 seconds')
    })

    it('should accept ttl = 60 seconds', () => {
      const Session = defineModel('sessions_kv_test_3', {
        token: field.string().primaryKey(),
        data: field.json(),
      })

      expect(() => {
        new KVAdapter(Session, kv, { ttl: 60 })
      }).not.toThrow()
    })
  })

  describe('Key generation and namespacing', () => {
    it('should prefix keys with table name', async () => {
      const Setting = defineModel('settings_kv_test_4', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Setting, kv)

      await adapter.put('theme', { key: 'theme', value: 'light' })

      const allKeys = kv.getAllKeys()
      expect(allKeys).toContain('settings_kv_test_4:theme')
    })

    it('should handle special characters in IDs safely', async () => {
      const Cache = defineModel('cache_kv_test_1', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Cache, kv)

      await adapter.put('user:123:profile', { key: 'user:123:profile', value: 'cached' })
      const result = await adapter.get('user:123:profile')

      expect(result).toEqual({ key: 'user:123:profile', value: 'cached' })
    })
  })

  describe('list() operation', () => {
    it('should list all keys for a model', async () => {
      const Setting = defineModel('settings_kv_test_5', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Setting, kv)

      await adapter.put('theme', { key: 'theme', value: 'dark' })
      await adapter.put('lang', { key: 'lang', value: 'en' })
      await adapter.put('timezone', { key: 'timezone', value: 'UTC' })

      const keys = await adapter.list()

      expect(keys).toHaveLength(3)
      expect(keys).toContain('theme')
      expect(keys).toContain('lang')
      expect(keys).toContain('timezone')
    })

    it('should filter by prefix', async () => {
      const Cache = defineModel('cache_kv_test_2', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Cache, kv)

      await adapter.put('user:1', { key: 'user:1', value: 'Alice' })
      await adapter.put('user:2', { key: 'user:2', value: 'Bob' })
      await adapter.put('post:1', { key: 'post:1', value: 'Hello' })

      const userKeys = await adapter.list('user:')

      expect(userKeys).toHaveLength(2)
      expect(userKeys).toContain('user:1')
      expect(userKeys).toContain('user:2')
      expect(userKeys).not.toContain('post:1')
    })

    it('should return empty array when no keys match', async () => {
      const Setting = defineModel('settings_kv_test_6', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const adapter = new KVAdapter(Setting, kv)

      const keys = await adapter.list()

      expect(keys).toEqual([])
    })

    it('should not list keys from other models', async () => {
      const Setting = defineModel('settings_kv_test_7', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const User = defineModel('users_kv_test_2', {
        id: field.string().primaryKey(),
        name: field.string(),
      })

      const settingAdapter = new KVAdapter(Setting, kv)
      const userAdapter = new KVAdapter(User, kv)

      await settingAdapter.put('theme', { key: 'theme', value: 'dark' })
      await userAdapter.put('user1', { id: 'user1', name: 'Alice' })

      const settingKeys = await settingAdapter.list()
      const userKeys = await userAdapter.list()

      expect(settingKeys).toEqual(['theme'])
      expect(userKeys).toEqual(['user1'])
    })
  })

  describe('Data transformation', () => {
    it('should transform camelCase to snake_case on put', async () => {
      const User = defineModel('users_kv_test_3', {
        userId: field.string().primaryKey(),
        firstName: field.string(),
        lastName: field.string(),
      })

      const adapter = new KVAdapter(User, kv)

      await adapter.put('user1', {
        userId: 'user1',
        firstName: 'Jane',
        lastName: 'Doe',
      })

      const rawValue = kv.getRaw('users_kv_test_3:user1')
      expect(rawValue).toBeTruthy()
      const parsed = JSON.parse(rawValue!)
      expect(parsed).toHaveProperty('user_id')
      expect(parsed).toHaveProperty('first_name')
      expect(parsed).toHaveProperty('last_name')
    })

    it('should transform snake_case to camelCase on get', async () => {
      const User = defineModel('users_kv_test_4', {
        userId: field.string().primaryKey(),
        firstName: field.string(),
      })

      const adapter = new KVAdapter(User, kv)

      // Store with snake_case directly
      await kv.put(
        'users_kv_test_4:user1',
        JSON.stringify({ user_id: 'user1', first_name: 'John' })
      )

      const result = await adapter.get('user1')

      expect(result).toEqual({ userId: 'user1', firstName: 'John' })
    })
  })
})
