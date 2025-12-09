import { describe, it, expect } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema/field'
import { analyzeTier, validateTierChoice } from '@/edge-record/storage/tier-analyzer'
import { hasMany, hasOne } from '@/edge-record/relations'

describe('analyzeTier()', () => {
  describe('AC1: Default to D1 (safest choice)', () => {
    it('should default to D1 for models without explicit storage', () => {
      const User = defineModel('users_tier_test_1', {
        id: field.id(),
        email: field.string(),
        name: field.string(),
      })

      const result = analyzeTier(User)

      expect(result.tier).toBe('d1')
      expect(result.confidence).toBe('high')
      expect(result.reasons).toContain('Default: relational data storage')
    })

    it('should default to D1 for relational models', () => {
      const User = defineModel(
        'users_tier_test_2',
        {
          id: field.id(),
          email: field.string(),
        },
        {
          relations: {
            posts: hasMany('posts_tier_test', 'userId'),
          },
        }
      )

      const result = analyzeTier(User, {})

      expect(result.tier).toBe('d1')
      expect(result.confidence).toBe('high')
    })
  })

  describe('AC2: KV tier suggestion for simple key-value patterns', () => {
    it('should suggest KV for model with string PK and no relations', () => {
      const Setting = defineModel('settings_tier_test_1', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const result = analyzeTier(Setting)

      expect(result.tier).toBe('kv')
      expect(result.confidence).toBe('medium')
      expect(result.reasons).toContain('String primary key detected')
      expect(result.reasons).toContain('No relationships defined')
      expect(result.reasons).toContain('Simple schema structure')
    })

    it('should suggest KV for models with ≤5 fields', () => {
      const Session = defineModel('sessions_tier_test', {
        token: field.string().primaryKey(),
        userId: field.string(),
        expiresAt: field.datetime(),
        data: field.json(),
        createdAt: field.datetime(),
      })

      const result = analyzeTier(Session)

      expect(result.tier).toBe('kv')
      expect(result.confidence).toBe('medium')
    })

    it('should NOT suggest KV for models with integer PK', () => {
      const User = defineModel('users_tier_test_3', {
        id: field.id(), // integer PK
        name: field.string(),
      })

      const result = analyzeTier(User)

      expect(result.tier).toBe('d1')
    })

    it('should NOT suggest KV for models with relations', () => {
      const User = defineModel(
        'users_tier_test_4',
        {
          email: field.string().primaryKey(), // string PK but has relations
          name: field.string(),
        },
        {
          relations: {
            profile: hasOne('profiles_tier_test', 'userId'),
          },
        }
      )

      const result = analyzeTier(User, {})

      expect(result.tier).toBe('d1')
    })

    it('should NOT suggest KV for models with >5 fields', () => {
      const ComplexModel = defineModel('complex_tier_test', {
        key: field.string().primaryKey(),
        field1: field.string(),
        field2: field.string(),
        field3: field.string(),
        field4: field.string(),
        field5: field.string(),
        field6: field.string(), // 7 total fields
      })

      const result = analyzeTier(ComplexModel)

      expect(result.tier).toBe('d1')
    })
  })

  describe('AC3: Strong consistency selects Durable Objects', () => {
    it('should select DO tier when consistency: "strong" is set', () => {
      const Counter = defineModel('counters_tier_test', {
        id: field.id(),
        value: field.integer(),
      })

      const result = analyzeTier(Counter, { consistency: 'strong' })

      expect(result.tier).toBe('do')
      expect(result.confidence).toBe('high')
      expect(result.reasons).toContain('Strong consistency required')
    })

    it('should prioritize strong consistency over KV suitability', () => {
      const Setting = defineModel('settings_tier_test_2', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      // Even though it looks like KV, strong consistency forces DO
      const result = analyzeTier(Setting, { consistency: 'strong' })

      expect(result.tier).toBe('do')
      expect(result.confidence).toBe('high')
    })
  })

  describe('AC4-6: Explicit storage option overrides', () => {
    it('AC4: storage: "kv" forces KV tier', () => {
      const User = defineModel('users_tier_test_5', {
        id: field.id(), // integer PK (not KV-suitable)
        email: field.string(),
      })

      const result = analyzeTier(User, { storage: 'kv' })

      expect(result.tier).toBe('kv')
      expect(result.confidence).toBe('high')
      expect(result.reasons).toContain('Explicitly configured')
    })

    it('AC5: storage: "d1" forces D1 tier', () => {
      const Setting = defineModel('settings_tier_test_3', {
        key: field.string().primaryKey(), // KV-suitable but forced D1
        value: field.string(),
      })

      const result = analyzeTier(Setting, { storage: 'd1' })

      expect(result.tier).toBe('d1')
      expect(result.confidence).toBe('high')
      expect(result.reasons).toContain('Explicitly configured')
    })

    it('AC6: storage: "do" forces Durable Objects tier', () => {
      const User = defineModel('users_tier_test_6', {
        id: field.id(),
        email: field.string(),
      })

      const result = analyzeTier(User, { storage: 'do' })

      expect(result.tier).toBe('do')
      expect(result.confidence).toBe('high')
      expect(result.reasons).toContain('Explicitly configured')
    })

    it('explicit storage overrides consistency setting', () => {
      const Model = defineModel('model_tier_test', {
        id: field.id(),
        data: field.string(),
      })

      const result = analyzeTier(Model, {
        storage: 'kv',
        consistency: 'strong', // Conflict: KV doesn't support strong consistency
      })

      // Explicit storage wins
      expect(result.tier).toBe('kv')
    })
  })
})

describe('validateTierChoice()', () => {
  describe('AC9: Tier analyzer warns when characteristics don\'t match tier', () => {
    it('should warn when KV selected but model has relations', () => {
      const User = defineModel(
        'users_tier_validation_1',
        {
          id: field.id(),
          email: field.string(),
        },
        {
          relations: {
            posts: hasMany('posts_tier_validation', 'userId'),
          },
        }
      )

      const warnings = validateTierChoice(User, 'kv')

      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('KV storage selected but model has relations')
      expect(warnings[0]).toContain('relations will not work with KV')
    })

    // Note: index() method not yet implemented - skipping this test
    // it('should warn when KV selected but model has indexed fields', () => { ... })

    it('should warn when D1 selected but strong consistency requested', () => {
      const Counter = defineModel('counters_tier_validation', {
        id: field.id(),
        value: field.integer(),
      })

      const warnings = validateTierChoice(Counter, 'd1', { consistency: 'strong' })

      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('Strong consistency requested but D1 selected')
      expect(warnings[0]).toContain('consider using Durable Objects')
    })

    it('should return warning when KV selected for model with relations', () => {
      const User = defineModel(
        'users_tier_validation_3',
        {
          id: field.id(),
          email: field.string(),
          name: field.string(),
        },
        {
          relations: {
            posts: hasMany('posts_tier_validation_2', 'userId'),
          },
        }
      )

      const warnings = validateTierChoice(User, 'kv')

      expect(warnings.length).toBeGreaterThanOrEqual(1)
      expect(warnings.some((w) => w.includes('relations'))).toBe(true)
    })

    it('should return empty array when no issues detected', () => {
      const Setting = defineModel('settings_tier_validation', {
        key: field.string().primaryKey(),
        value: field.string(),
      })

      const warnings = validateTierChoice(Setting, 'kv')

      expect(warnings).toHaveLength(0)
    })

    it('should return empty array for valid D1 choice', () => {
      const User = defineModel('users_tier_validation_4', {
        id: field.id(),
        email: field.string(),
        name: field.string(),
      })

      const warnings = validateTierChoice(User, 'd1')

      expect(warnings).toHaveLength(0)
    })

    it('should return empty array for valid DO choice', () => {
      const Counter = defineModel('counters_tier_validation_2', {
        id: field.id(),
        value: field.integer(),
      })

      const warnings = validateTierChoice(Counter, 'do', { consistency: 'strong' })

      expect(warnings).toHaveLength(0)
    })
  })
})
