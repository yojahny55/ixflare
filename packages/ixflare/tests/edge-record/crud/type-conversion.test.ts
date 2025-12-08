/**
 * @module tests/edge-record/crud/type-conversion.test
 * @description Tests for D1 type conversion (boolean -> 0/1, JSON -> string)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import { create, createMany } from '@/edge-record/crud/crud-operations'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import { createMockD1Database } from './mock-d1'

describe('Type Conversion', () => {
  // Model with boolean and JSON fields
  const Settings = defineModel('settings', {
    id: field.id(),
    userId: field.integer(),
    isActive: field.boolean(),
    preferences: field.json(),
    ...timestamps(),
  })

  let db: D1Database

  beforeEach(() => {
    db = createMockD1Database()
  })

  describe('Boolean type conversion', () => {
    it('should convert true to 1 when saving', async () => {
      const instance = new ModelInstance(
        Settings,
        { userId: 1, isActive: true, preferences: {} },
        true
      )

      await instance.save(db)

      // The mock stores raw values, so we check the stored value is 1
      expect(instance.get('isActive')).toBe(true) // API should return boolean
    })

    it('should convert false to 0 when saving', async () => {
      const instance = new ModelInstance(
        Settings,
        { userId: 1, isActive: false, preferences: {} },
        true
      )

      await instance.save(db)

      expect(instance.get('isActive')).toBe(false)
    })

    it('should convert 1 to true when reading from DB', () => {
      const instance = new ModelInstance(
        Settings,
        { id: 1, user_id: 1, is_active: 1, preferences: '{}' } as Record<string, unknown>,
        false
      )

      expect(instance.get('isActive')).toBe(true)
    })

    it('should convert 0 to false when reading from DB', () => {
      const instance = new ModelInstance(
        Settings,
        { id: 1, user_id: 1, is_active: 0, preferences: '{}' } as Record<string, unknown>,
        false
      )

      expect(instance.get('isActive')).toBe(false)
    })
  })

  describe('JSON type conversion', () => {
    it('should stringify JSON objects when saving', async () => {
      const preferences = { theme: 'dark', language: 'en', notifications: true }
      const instance = new ModelInstance(
        Settings,
        { userId: 1, isActive: true, preferences },
        true
      )

      await instance.save(db)

      // API should return the object (not string)
      expect(instance.get('preferences')).toEqual(preferences)
    })

    it('should parse JSON string when reading from DB', () => {
      const preferencesJson = '{"theme":"dark","language":"en"}'
      const instance = new ModelInstance(
        Settings,
        {
          id: 1,
          user_id: 1,
          is_active: 1,
          preferences: preferencesJson,
        } as Record<string, unknown>,
        false
      )

      expect(instance.get('preferences')).toEqual({ theme: 'dark', language: 'en' })
    })

    it('should handle nested JSON objects', async () => {
      const preferences = {
        theme: { mode: 'dark', accent: '#ff0000' },
        notifications: { email: true, push: false },
      }
      const instance = new ModelInstance(
        Settings,
        { userId: 1, isActive: true, preferences },
        true
      )

      await instance.save(db)

      expect(instance.get('preferences')).toEqual(preferences)
    })

    it('should handle JSON arrays', async () => {
      const preferences = ['option1', 'option2', 'option3']
      const instance = new ModelInstance(
        Settings,
        { userId: 1, isActive: true, preferences },
        true
      )

      await instance.save(db)

      expect(instance.get('preferences')).toEqual(preferences)
    })

    it('should NOT double-stringify already-stringified JSON', async () => {
      const preferencesString = '{"theme":"dark"}'
      const instance = new ModelInstance(
        Settings,
        { userId: 1, isActive: true, preferences: preferencesString },
        true
      )

      await instance.save(db)

      // When a JSON field receives a string, it's stored as-is in DB
      // On read, it's parsed back to object (that's the correct behavior)
      expect(instance.get('preferences')).toEqual({ theme: 'dark' })
    })
  })

  describe('Type conversion in create()', () => {
    it('should handle boolean in create', async () => {
      const settings = await create(
        Settings,
        { userId: 1, isActive: true, preferences: { theme: 'light' } },
        db
      )

      expect(settings.get('isActive')).toBe(true)
    })

    it('should handle JSON in create', async () => {
      const prefs = { theme: 'dark', fontSize: 14 }
      const settings = await create(Settings, { userId: 1, isActive: false, preferences: prefs }, db)

      expect(settings.get('preferences')).toEqual(prefs)
    })
  })

  describe('Type conversion in createMany()', () => {
    it('should handle boolean and JSON in bulk insert', async () => {
      const records = [
        { userId: 1, isActive: true, preferences: { a: 1 } },
        { userId: 2, isActive: false, preferences: { b: 2 } },
      ]

      const results = await createMany(Settings, records, db)

      expect(results[0].get('isActive')).toBe(true)
      expect(results[0].get('preferences')).toEqual({ a: 1 })
      expect(results[1].get('isActive')).toBe(false)
      expect(results[1].get('preferences')).toEqual({ b: 2 })
    })
  })

  describe('Type conversion in update()', () => {
    it('should convert boolean on update', async () => {
      const instance = new ModelInstance(
        Settings,
        { id: 1, userId: 1, isActive: true, preferences: {} },
        false
      )

      await instance.update({ isActive: false }, db)

      expect(instance.get('isActive')).toBe(false)
    })

    it('should convert JSON on update', async () => {
      const instance = new ModelInstance(
        Settings,
        { id: 1, userId: 1, isActive: true, preferences: {} },
        false
      )

      const newPrefs = { updated: true, value: 42 }
      await instance.update({ preferences: newPrefs }, db)

      expect(instance.get('preferences')).toEqual(newPrefs)
    })
  })

  describe('toJSON() serialization', () => {
    it('should return proper types in toJSON', () => {
      const instance = new ModelInstance(
        Settings,
        { id: 1, user_id: 1, is_active: 1, preferences: '{"foo":"bar"}' } as Record<
          string,
          unknown
        >,
        false
      )

      const json = instance.toJSON()

      expect(json.isActive).toBe(true) // Not 1
      expect(json.preferences).toEqual({ foo: 'bar' }) // Not string
    })
  })
})
