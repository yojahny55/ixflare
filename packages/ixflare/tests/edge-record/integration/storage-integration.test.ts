import { describe, it, expect } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema/field'
import { hasMany } from '@/edge-record/relations'

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
    it('should create model with D1 tier that has CRUD methods', () => {
      const User = defineModel('users_storage_int_5', {
        id: field.id(),
        email: field.string(),
      })

      expect(User.$storage).toBe('d1')
      expect(typeof User.create).toBe('function')
      expect(typeof User.find).toBe('function')
      expect(typeof User.findOrFail).toBe('function')
      expect(typeof User.where).toBe('function')
      expect(typeof User.with).toBe('function')
      expect(typeof User.upsert).toBe('function')
      expect(typeof User.createMany).toBe('function')
    })

    it('should create model with KV tier that has CRUD methods', () => {
      const Setting = defineModel(
        'settings_storage_int_3',
        {
          key: field.string().primaryKey(),
          value: field.string(),
        },
        { storage: 'kv' }
      )

      expect(Setting.$storage).toBe('kv')
      expect(typeof Setting.create).toBe('function')
      expect(typeof Setting.find).toBe('function')
      expect(typeof Setting.findOrFail).toBe('function')
      expect(typeof Setting.where).toBe('function')
      expect(typeof Setting.with).toBe('function')
    })

    it('should create model with DO tier that has CRUD methods', () => {
      const Counter = defineModel(
        'counters_storage_int_2',
        {
          id: field.id(),
          value: field.integer(),
        },
        { storage: 'do' }
      )

      expect(Counter.$storage).toBe('do')
      expect(typeof Counter.create).toBe('function')
      expect(typeof Counter.find).toBe('function')
      expect(typeof Counter.findOrFail).toBe('function')
      expect(typeof Counter.where).toBe('function')
      expect(typeof Counter.with).toBe('function')
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
