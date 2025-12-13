/**
 * @module tests/auth/rotation/key-store
 * @description Tests for KV-based key storage
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { KeyStore } from '@/auth/rotation/key-store'
import { KeyNotFoundError, KeyRotationError } from '@/auth/rotation/errors'

describe('KeyStore', () => {
  let mockKV: Map<string, string>
  let keyStore: KeyStore

  beforeEach(() => {
    // Mock KV namespace
    mockKV = new Map()
    const kvNamespace = {
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

  describe('storeKey', () => {
    it('should store key with metadata', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000 // 30 days
      const gracePeriodEndsAt = expiresAt + 24 * 60 * 60 * 1000 // +24h

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', expiresAt, gracePeriodEndsAt, {
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
      })

      // Verify key was stored
      const stored = mockKV.get(`jwt:keys:${kid}`)
      expect(stored).toBeDefined()

      const parsed = JSON.parse(stored!)
      expect(parsed.metadata.kid).toBe(kid)
      expect(parsed.metadata.algorithm).toBe('ES256')
      expect(parsed.privateKey).toBe('private-key-data')
      expect(parsed.publicKey).toBeDefined()
    })

    it('should update current key pointer', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', now + 1000, now + 2000)

      const current = mockKV.get('jwt:keys:current')
      expect(current).toBeDefined()

      const parsed = JSON.parse(current!)
      expect(parsed.kid).toBe(kid)
    })

    it('should update key list', async () => {
      const kid1 = 'key-2025-12-12-aaa'
      const kid2 = 'key-2025-12-12-bbb'
      const now = Date.now()

      await keyStore.storeKey(kid1, 'key1', 'ES256', now + 1000, now + 2000)
      await keyStore.storeKey(kid2, 'key2', 'ES256', now + 1000, now + 2000)

      const list = mockKV.get('jwt:keys:list')
      expect(list).toBeDefined()

      const parsed = JSON.parse(list!)
      expect(parsed).toEqual([kid2, kid1]) // Newest first
    })
  })

  describe('getKey', () => {
    it('should retrieve stored key', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000
      const gracePeriodEndsAt = expiresAt + 24 * 60 * 60 * 1000

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', expiresAt, gracePeriodEndsAt)

      const key = await keyStore.getKey(kid)

      expect(key.metadata.kid).toBe(kid)
      expect(key.metadata.algorithm).toBe('ES256')
      expect(key.metadata.status).toBe('active')
      expect(key.privateKey).toBe('private-key-data')
    })

    it('should throw KeyNotFoundError for missing key', async () => {
      await expect(keyStore.getKey('nonexistent')).rejects.toThrow(KeyNotFoundError)
    })

    it('should mark key as grace when past expiry', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()
      const expiresAt = now - 1000 // Already expired
      const gracePeriodEndsAt = now + 1000 // Still in grace

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', expiresAt, gracePeriodEndsAt)

      const key = await keyStore.getKey(kid)

      expect(key.metadata.status).toBe('grace')
    })

    it('should mark key as expired when past grace period', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()
      const expiresAt = now - 2000
      const gracePeriodEndsAt = now - 1000 // Grace period ended

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', expiresAt, gracePeriodEndsAt)

      const key = await keyStore.getKey(kid)

      expect(key.metadata.status).toBe('expired')
    })
  })

  describe('listActiveKeys', () => {
    it('should return all non-expired keys', async () => {
      const now = Date.now()
      const future = now + 30 * 24 * 60 * 60 * 1000

      await keyStore.storeKey('key-active', 'key1', 'ES256', future, future + 1000)
      await keyStore.storeKey('key-grace', 'key2', 'ES256', now - 1000, now + 1000)
      await keyStore.storeKey('key-expired', 'key3', 'ES256', now - 2000, now - 1000)

      const keys = await keyStore.listActiveKeys()

      // Should include active and grace, not expired
      expect(keys.length).toBe(2)
      expect(keys.find((k) => k.metadata.kid === 'key-active')).toBeDefined()
      expect(keys.find((k) => k.metadata.kid === 'key-grace')).toBeDefined()
      expect(keys.find((k) => k.metadata.kid === 'key-expired')).toBeUndefined()
    })

    it('should sort active keys first', async () => {
      const now = Date.now()
      const future = now + 30 * 24 * 60 * 60 * 1000

      await keyStore.storeKey('key-grace', 'key1', 'ES256', now - 1000, now + 1000)
      await keyStore.storeKey('key-active', 'key2', 'ES256', future, future + 1000)

      const keys = await keyStore.listActiveKeys()

      // Active should be first
      expect(keys[0].metadata.status).toBe('active')
      expect(keys[1].metadata.status).toBe('grace')
    })
  })

  describe('deleteKey', () => {
    it('should delete key from KV', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', now + 1000, now + 2000)
      await keyStore.deleteKey(kid)

      await expect(keyStore.getKey(kid)).rejects.toThrow(KeyNotFoundError)
    })

    it('should remove key from list', async () => {
      const kid1 = 'key-2025-12-12-aaa'
      const kid2 = 'key-2025-12-12-bbb'
      const now = Date.now()

      await keyStore.storeKey(kid1, 'key1', 'ES256', now + 1000, now + 2000)
      await keyStore.storeKey(kid2, 'key2', 'ES256', now + 1000, now + 2000)
      await keyStore.deleteKey(kid1)

      const list = mockKV.get('jwt:keys:list')
      const parsed = JSON.parse(list!)

      expect(parsed).toEqual([kid2])
      expect(parsed).not.toContain(kid1)
    })
  })

  describe('getCurrentKeyId', () => {
    it('should return current key ID', async () => {
      const kid = 'key-2025-12-12-test'
      const now = Date.now()

      await keyStore.storeKey(kid, 'private-key-data', 'ES256', now + 1000, now + 2000)

      const currentKid = await keyStore.getCurrentKeyId()

      expect(currentKid).toBe(kid)
    })

    it('should throw KeyRotationError when no current key', async () => {
      await expect(keyStore.getCurrentKeyId()).rejects.toThrow(KeyRotationError)
    })
  })
})
