import { describe, it, expectTypeOf } from 'vitest'
import type {
  StorageTier,
  ConsistencyLevel,
  StorageOptions,
  CacheOptions,
  ExtendedModelOptions,
} from '@/edge-record/storage/types'

describe('Storage Types', () => {
  describe('StorageTier', () => {
    it('should accept valid storage tier values', () => {
      const kv: StorageTier = 'kv'
      const d1: StorageTier = 'd1'
      const durableObjects: StorageTier = 'do'

      expectTypeOf(kv).toEqualTypeOf<StorageTier>()
      expectTypeOf(d1).toEqualTypeOf<StorageTier>()
      expectTypeOf(durableObjects).toEqualTypeOf<StorageTier>()
    })

    it('should not accept invalid values', () => {
      // @ts-expect-error - invalid tier
      const invalid: StorageTier = 'invalid'
    })
  })

  describe('ConsistencyLevel', () => {
    it('should accept valid consistency levels', () => {
      const eventual: ConsistencyLevel = 'eventual'
      const strong: ConsistencyLevel = 'strong'

      expectTypeOf(eventual).toEqualTypeOf<ConsistencyLevel>()
      expectTypeOf(strong).toEqualTypeOf<ConsistencyLevel>()
    })

    it('should not accept invalid values', () => {
      // @ts-expect-error - invalid consistency level
      const invalid: ConsistencyLevel = 'weak'
    })
  })

  describe('StorageOptions', () => {
    it('should allow all optional properties', () => {
      const opts1: StorageOptions = {}
      const opts2: StorageOptions = { storage: 'kv' }
      const opts3: StorageOptions = { ttl: 300 }
      const opts4: StorageOptions = { consistency: 'strong' }
      const opts5: StorageOptions = {
        storage: 'd1',
        ttl: 600,
        consistency: 'eventual',
      }

      expectTypeOf(opts1).toMatchTypeOf<StorageOptions>()
      expectTypeOf(opts2).toMatchTypeOf<StorageOptions>()
      expectTypeOf(opts3).toMatchTypeOf<StorageOptions>()
      expectTypeOf(opts4).toMatchTypeOf<StorageOptions>()
      expectTypeOf(opts5).toMatchTypeOf<StorageOptions>()
    })

    it('should enforce valid storage tier values', () => {
      const valid: StorageOptions = { storage: 'kv' }
      expectTypeOf(valid).toMatchTypeOf<StorageOptions>()

      // @ts-expect-error - invalid storage tier
      const invalid: StorageOptions = { storage: 'invalid' }
    })

    it('should enforce number type for ttl', () => {
      const valid: StorageOptions = { ttl: 300 }
      expectTypeOf(valid).toMatchTypeOf<StorageOptions>()

      // @ts-expect-error - ttl must be number
      const invalid: StorageOptions = { ttl: '300' }
    })
  })

  describe('CacheOptions', () => {
    it('should allow all optional cache properties', () => {
      const opts1: CacheOptions = {}
      const opts2: CacheOptions = { enabled: true }
      const opts3: CacheOptions = { tier: 'kv', populateFrom: 'd1' }
      const opts4: CacheOptions = { ttl: 300, strategy: 'read-heavy' }
      const opts5: CacheOptions = {
        enabled: true,
        tier: 'kv',
        populateFrom: 'd1',
        ttl: 600,
        strategy: 'balanced',
      }

      expectTypeOf(opts1).toMatchTypeOf<CacheOptions>()
      expectTypeOf(opts2).toMatchTypeOf<CacheOptions>()
      expectTypeOf(opts3).toMatchTypeOf<CacheOptions>()
      expectTypeOf(opts4).toMatchTypeOf<CacheOptions>()
      expectTypeOf(opts5).toMatchTypeOf<CacheOptions>()
    })

    it('should enforce valid cache tier (only kv)', () => {
      const valid: CacheOptions = { tier: 'kv' }
      expectTypeOf(valid).toMatchTypeOf<CacheOptions>()

      // @ts-expect-error - only 'kv' is valid cache tier
      const invalid: CacheOptions = { tier: 'd1' }
    })

    it('should enforce valid populateFrom (only d1)', () => {
      const valid: CacheOptions = { populateFrom: 'd1' }
      expectTypeOf(valid).toMatchTypeOf<CacheOptions>()

      // @ts-expect-error - only 'd1' is valid source
      const invalid: CacheOptions = { populateFrom: 'kv' }
    })

    it('should enforce valid strategy values', () => {
      const opts1: CacheOptions = { strategy: 'read-heavy' }
      const opts2: CacheOptions = { strategy: 'write-heavy' }
      const opts3: CacheOptions = { strategy: 'balanced' }

      expectTypeOf(opts1).toMatchTypeOf<CacheOptions>()
      expectTypeOf(opts2).toMatchTypeOf<CacheOptions>()
      expectTypeOf(opts3).toMatchTypeOf<CacheOptions>()

      // @ts-expect-error - invalid strategy
      const invalid: CacheOptions = { strategy: 'aggressive' }
    })
  })

  describe('ExtendedModelOptions', () => {
    it('should extend StorageOptions', () => {
      const opts: ExtendedModelOptions = {
        storage: 'kv',
        ttl: 300,
        consistency: 'eventual',
      }

      expectTypeOf(opts).toMatchTypeOf<StorageOptions>()
    })

    it('should include cache property', () => {
      const opts: ExtendedModelOptions = {
        cache: {
          enabled: true,
          tier: 'kv',
          populateFrom: 'd1',
          ttl: 600,
          strategy: 'read-heavy',
        },
      }

      expectTypeOf(opts.cache).toMatchTypeOf<CacheOptions | undefined>()
    })

    it('should allow combining storage and cache options', () => {
      const opts: ExtendedModelOptions = {
        storage: 'd1',
        ttl: 300,
        cache: {
          enabled: true,
          tier: 'kv',
          ttl: 120,
        },
      }

      expectTypeOf(opts).toMatchTypeOf<ExtendedModelOptions>()
    })
  })
})
