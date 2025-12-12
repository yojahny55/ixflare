/**
 * @module auth/algorithms/hs256.test
 * @description Tests for HMAC-SHA256 implementation
 */

import { describe, it, expect } from 'vitest'
import { importHS256Key, signHS256, verifyHS256 } from '@/auth/algorithms/hs256'

describe('HS256 Algorithm', () => {
  const testSecret = 'test-secret-key-for-hmac'
  const testData = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0'

  describe('importHS256Key', () => {
    it('should import HMAC key from secret string', async () => {
      const key = await importHS256Key(testSecret)

      expect(key).toBeInstanceOf(CryptoKey)
      expect(key.type).toBe('secret')
      expect(key.algorithm.name).toBe('HMAC')
    })

    it('should create usable key for signing and verification', async () => {
      const key = await importHS256Key(testSecret)

      expect(key.usages).toContain('sign')
      expect(key.usages).toContain('verify')
    })
  })

  describe('signHS256', () => {
    it('should sign data and return ArrayBuffer', async () => {
      const signature = await signHS256(testData, testSecret)

      expect(signature).toBeInstanceOf(ArrayBuffer)
      expect(signature.byteLength).toBe(32) // SHA-256 produces 32 bytes
    })

    it('should produce consistent signatures for same data', async () => {
      const sig1 = await signHS256(testData, testSecret)
      const sig2 = await signHS256(testData, testSecret)

      const arr1 = new Uint8Array(sig1)
      const arr2 = new Uint8Array(sig2)

      expect(Array.from(arr1)).toEqual(Array.from(arr2))
    })

    it('should produce different signatures for different data', async () => {
      const sig1 = await signHS256('data1', testSecret)
      const sig2 = await signHS256('data2', testSecret)

      const arr1 = new Uint8Array(sig1)
      const arr2 = new Uint8Array(sig2)

      expect(Array.from(arr1)).not.toEqual(Array.from(arr2))
    })

    it('should produce different signatures for different secrets', async () => {
      const sig1 = await signHS256(testData, 'secret1')
      const sig2 = await signHS256(testData, 'secret2')

      const arr1 = new Uint8Array(sig1)
      const arr2 = new Uint8Array(sig2)

      expect(Array.from(arr1)).not.toEqual(Array.from(arr2))
    })
  })

  describe('verifyHS256', () => {
    it('should verify valid signature', async () => {
      const signature = await signHS256(testData, testSecret)
      const isValid = await verifyHS256(testData, signature, testSecret)

      expect(isValid).toBe(true)
    })

    it('should reject signature with wrong secret', async () => {
      const signature = await signHS256(testData, 'secret1')
      const isValid = await verifyHS256(testData, signature, 'secret2')

      expect(isValid).toBe(false)
    })

    it('should reject signature for modified data', async () => {
      const signature = await signHS256('original data', testSecret)
      const isValid = await verifyHS256('modified data', signature, testSecret)

      expect(isValid).toBe(false)
    })

    it('should reject tampered signature', async () => {
      const signature = await signHS256(testData, testSecret)

      // Tamper with signature
      const tamperedSig = new Uint8Array(signature)
      tamperedSig[0] ^= 0xff // Flip all bits in first byte

      const isValid = await verifyHS256(testData, tamperedSig.buffer, testSecret)

      expect(isValid).toBe(false)
    })

    it('should handle empty data', async () => {
      const signature = await signHS256('', testSecret)
      const isValid = await verifyHS256('', signature, testSecret)

      expect(isValid).toBe(true)
    })
  })
})
