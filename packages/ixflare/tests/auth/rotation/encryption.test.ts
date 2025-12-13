/**
 * @module tests/auth/rotation/encryption
 * @description Tests for private key encryption at rest
 */

import { describe, it, expect } from 'vitest'
import {
  deriveEncryptionKey,
  encryptPrivateKey,
  decryptPrivateKey,
  isEncryptedData,
  type EncryptedData,
} from '@/auth/rotation/encryption'

describe('Key Encryption', () => {
  describe('deriveEncryptionKey', () => {
    it('should derive a consistent key from the same secret', async () => {
      const secret = 'test-master-secret-for-key-derivation'

      const key1 = await deriveEncryptionKey(secret)
      const key2 = await deriveEncryptionKey(secret)

      // Keys should be CryptoKey objects
      expect(key1.type).toBe('secret')
      expect(key2.type).toBe('secret')

      // Same secret should produce same key (test by encrypting/decrypting)
      const plaintext = 'test data'
      const encrypted = await encryptPrivateKey(plaintext, key1)
      const decrypted = await decryptPrivateKey(encrypted, key2)
      expect(decrypted).toBe(plaintext)
    })

    it('should derive different keys from different secrets', async () => {
      const key1 = await deriveEncryptionKey('secret-one')
      const key2 = await deriveEncryptionKey('secret-two')

      // Encrypt with key1
      const plaintext = 'test data'
      const encrypted = await encryptPrivateKey(plaintext, key1)

      // Decrypting with key2 should fail
      await expect(decryptPrivateKey(encrypted, key2)).rejects.toThrow()
    })

    it('should derive different keys from different salts', async () => {
      const secret = 'same-secret'
      const key1 = await deriveEncryptionKey(secret, 'salt-one')
      const key2 = await deriveEncryptionKey(secret, 'salt-two')

      const plaintext = 'test data'
      const encrypted = await encryptPrivateKey(plaintext, key1)

      // Decrypting with different salt should fail
      await expect(decryptPrivateKey(encrypted, key2)).rejects.toThrow()
    })
  })

  describe('encryptPrivateKey / decryptPrivateKey', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const secret = 'test-encryption-secret-32-chars!'
      const key = await deriveEncryptionKey(secret)
      const plaintext = JSON.stringify({ kty: 'EC', d: 'private-value', crv: 'P-256' })

      const encrypted = await encryptPrivateKey(plaintext, key)
      const decrypted = await decryptPrivateKey(encrypted, key)

      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (random IV)', async () => {
      const secret = 'test-encryption-secret-32-chars!'
      const key = await deriveEncryptionKey(secret)
      const plaintext = 'same plaintext data'

      const encrypted1 = await encryptPrivateKey(plaintext, key)
      const encrypted2 = await encryptPrivateKey(plaintext, key)

      // Ciphertexts should differ due to random IV
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)

      // But both should decrypt to same plaintext
      const decrypted1 = await decryptPrivateKey(encrypted1, key)
      const decrypted2 = await decryptPrivateKey(encrypted2, key)
      expect(decrypted1).toBe(plaintext)
      expect(decrypted2).toBe(plaintext)
    })

    it('should return correct encrypted data format', async () => {
      const key = await deriveEncryptionKey('test-secret')
      const encrypted = await encryptPrivateKey('test data', key)

      expect(encrypted.alg).toBe('A256GCM')
      expect(typeof encrypted.ciphertext).toBe('string')
      expect(typeof encrypted.iv).toBe('string')

      // IV should be base64url encoded 12-byte value
      // Base64url of 12 bytes = 16 characters (no padding)
      expect(encrypted.iv.length).toBe(16)
    })

    it('should handle large payloads', async () => {
      const key = await deriveEncryptionKey('test-secret')
      const largePlaintext = 'x'.repeat(10000) // 10KB of data

      const encrypted = await encryptPrivateKey(largePlaintext, key)
      const decrypted = await decryptPrivateKey(encrypted, key)

      expect(decrypted).toBe(largePlaintext)
    })

    it('should handle special characters in plaintext', async () => {
      const key = await deriveEncryptionKey('test-secret')
      const plaintext = '{"key":"value with émojis 🔐 and unicode: 中文"}'

      const encrypted = await encryptPrivateKey(plaintext, key)
      const decrypted = await decryptPrivateKey(encrypted, key)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('isEncryptedData', () => {
    it('should return true for valid encrypted data', () => {
      const encrypted: EncryptedData = {
        ciphertext: 'abc123',
        iv: 'def456',
        alg: 'A256GCM',
      }

      expect(isEncryptedData(encrypted)).toBe(true)
    })

    it('should return false for plain string', () => {
      expect(isEncryptedData('plain-string-key')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(isEncryptedData(null)).toBe(false)
      expect(isEncryptedData(undefined)).toBe(false)
    })

    it('should return false for object missing required fields', () => {
      expect(isEncryptedData({ ciphertext: 'abc' })).toBe(false)
      expect(isEncryptedData({ ciphertext: 'abc', iv: 'def' })).toBe(false)
      expect(isEncryptedData({ alg: 'A256GCM' })).toBe(false)
    })

    it('should return false for wrong algorithm', () => {
      expect(
        isEncryptedData({
          ciphertext: 'abc',
          iv: 'def',
          alg: 'RSA-OAEP',
        })
      ).toBe(false)
    })
  })

  describe('Security Properties', () => {
    it('should fail decryption with tampered ciphertext', async () => {
      const key = await deriveEncryptionKey('test-secret')
      const encrypted = await encryptPrivateKey('sensitive data', key)

      // Tamper with ciphertext
      const tampered: EncryptedData = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -4) + 'XXXX',
      }

      await expect(decryptPrivateKey(tampered, key)).rejects.toThrow()
    })

    it('should fail decryption with tampered IV', async () => {
      const key = await deriveEncryptionKey('test-secret')
      const encrypted = await encryptPrivateKey('sensitive data', key)

      // Tamper with IV
      const tampered: EncryptedData = {
        ...encrypted,
        iv: 'AAAAAAAAAAAAAAAA', // Different IV
      }

      await expect(decryptPrivateKey(tampered, key)).rejects.toThrow()
    })
  })
})
