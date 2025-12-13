/**
 * @module tests/auth/rotation/scheduler
 * @description Tests for rotation scheduling logic
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  shouldRotate,
  rotateKeys,
  cleanupExpiredKeys,
  validateRotationConfig,
} from '@/auth/rotation/scheduler'
import { KeyStore } from '@/auth/rotation/key-store'
import { InvalidRotationConfigError } from '@/auth/rotation/errors'

describe('Rotation Scheduler', () => {
  let mockKV: Map<string, string>
  let kvNamespace: KVNamespace
  let keyStore: KeyStore

  beforeEach(() => {
    mockKV = new Map()
    kvNamespace = {
      get: async (key: string) => mockKV.get(key) || null,
      put: async (key: string, value: string) => {
        mockKV.set(key, value)
      },
      delete: async (key: string) => {
        mockKV.delete(key)
      },
    } as unknown as KVNamespace

    keyStore = new KeyStore(kvNamespace)
  })

  describe('validateRotationConfig', () => {
    it('should validate correct config', () => {
      const result = validateRotationConfig({
        interval: '30d',
        gracePeriod: '24h',
      })

      expect(result.intervalSeconds).toBe(30 * 86400)
      expect(result.gracePeriodSeconds).toBe(24 * 3600)
    })

    it('should reject interval less than 1 day', () => {
      expect(() =>
        validateRotationConfig({
          interval: '12h', // Too short
          gracePeriod: '1h',
        })
      ).toThrow(InvalidRotationConfigError)
    })

    it('should reject grace period >= interval', () => {
      expect(() =>
        validateRotationConfig({
          interval: '7d',
          gracePeriod: '8d', // Longer than interval
        })
      ).toThrow(InvalidRotationConfigError)
    })
  })

  describe('shouldRotate', () => {
    it('should return true when no current key exists', async () => {
      const config = { interval: '30d', gracePeriod: '24h' }

      const result = await shouldRotate(config, keyStore)

      expect(result).toBe(true)
    })

    it('should return true when interval has elapsed', async () => {
      const config = { interval: '1d', gracePeriod: '1h' }
      const now = Date.now()

      // Store key created 2 days ago
      await keyStore.storeKey('old-key', 'data', 'ES256', now + 1000, now + 2000)

      // Manually set creation time to 2 days ago
      mockKV.set(
        'jwt:keys:current',
        JSON.stringify({
          kid: 'old-key',
          createdAt: now - 2 * 24 * 60 * 60 * 1000,
        })
      )

      const result = await shouldRotate(config, keyStore)

      expect(result).toBe(true)
    })

    it('should return false when interval has not elapsed', async () => {
      const config = { interval: '30d', gracePeriod: '24h' }
      const now = Date.now()

      await keyStore.storeKey('recent-key', 'data', 'ES256', now + 1000, now + 2000)

      const result = await shouldRotate(config, keyStore)

      expect(result).toBe(false)
    })
  })

  describe('rotateKeys', () => {
    it('should generate new ES256 key', async () => {
      const config = { interval: '30d', gracePeriod: '24h' }

      const result = await rotateKeys(config, keyStore, 'ES256')

      expect(result.kid).toBeDefined()
      expect(result.rotatedAt).toBeDefined()

      const storedKey = await keyStore.getKey(result.kid)
      expect(storedKey.metadata.algorithm).toBe('ES256')
      expect(storedKey.publicKey).toBeDefined()
    })

    it('should generate new HS256 key', async () => {
      const config = { interval: '30d', gracePeriod: '24h' }

      const result = await rotateKeys(config, keyStore, 'HS256')

      const storedKey = await keyStore.getKey(result.kid)
      expect(storedKey.metadata.algorithm).toBe('HS256')
      expect(storedKey.publicKey).toBeUndefined()
    })

    it('should set correct expiration times', async () => {
      const config = { interval: '30d', gracePeriod: '24h' }
      const before = Date.now()

      const result = await rotateKeys(config, keyStore, 'ES256')
      const after = Date.now()

      const storedKey = await keyStore.getKey(result.kid)

      // Expiry should be ~30 days from now
      const expectedExpiry = before + 30 * 24 * 60 * 60 * 1000
      expect(storedKey.metadata.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000)
      expect(storedKey.metadata.expiresAt).toBeLessThanOrEqual(
        after + 30 * 24 * 60 * 60 * 1000 + 1000
      )

      // Grace period ends ~31 days from now
      const expectedGraceEnd = before + 31 * 24 * 60 * 60 * 1000
      expect(storedKey.metadata.gracePeriodEndsAt).toBeGreaterThanOrEqual(expectedGraceEnd - 1000)
    })
  })

  describe('cleanupExpiredKeys', () => {
    it('should remove expired keys', async () => {
      const now = Date.now()

      // Expired key
      await keyStore.storeKey('key-expired', 'data1', 'ES256', now - 2000, now - 1000)

      // Active key
      await keyStore.storeKey('key-active', 'data2', 'ES256', now + 10000, now + 20000)

      const deleted = await cleanupExpiredKeys(keyStore)

      expect(deleted).toContain('key-expired')
      expect(deleted).not.toContain('key-active')
    })

    it('should not remove grace period keys', async () => {
      const now = Date.now()

      // Grace period key
      await keyStore.storeKey(
        'key-grace',
        'data1',
        'ES256',
        now - 1000, // Expired
        now + 24 * 60 * 60 * 1000 // Grace ends in 24h
      )

      const deleted = await cleanupExpiredKeys(keyStore)

      expect(deleted).not.toContain('key-grace')

      // Key should still be accessible
      const key = await keyStore.getKey('key-grace')
      expect(key.metadata.status).toBe('grace')
    })

    it('should return empty array when no expired keys', async () => {
      const now = Date.now()

      await keyStore.storeKey('key-active', 'data', 'ES256', now + 10000, now + 20000)

      const deleted = await cleanupExpiredKeys(keyStore)

      expect(deleted).toEqual([])
    })
  })
})
