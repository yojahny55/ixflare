/**
 * @module auth/algorithms/es256.test
 * @description Tests for ECDSA P-256 implementation
 */

import { describe, it, expect } from 'vitest'
import {
  importES256PrivateKey,
  importES256PublicKey,
  signES256,
  verifyES256,
} from '@/auth/algorithms/es256'

describe('ES256 Algorithm', () => {
  // Test key pair in PEM format (P-256, PKCS#8)
  // Generated using: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQajgEQYbFWvA4JGh
SRw/O5Bdodtaub+a3dM3wwvKl8OhRANCAARR/76D85QATCUwnrItTtUsTHNkLmlY
zgcui0ggRgnSiAAoEF5cqmaDQl14ZQCYZO9jun+AFUrcE1xoL90f+vH9
-----END PRIVATE KEY-----`

  const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEUf++g/OUAEwlMJ6yLU7VLExzZC5p
WM4HLotIIEYJ0ogAKBBeXKpmg0JdeGUAmGTvY7p/gBVK3BNcaC/dH/rx/Q==
-----END PUBLIC KEY-----`

  const testData = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0'

  describe('importES256PrivateKey', () => {
    it('should import private key from PEM format', async () => {
      const key = await importES256PrivateKey(privateKeyPem)

      expect(key).toBeInstanceOf(CryptoKey)
      expect(key.type).toBe('private')
      expect(key.algorithm.name).toBe('ECDSA')
    })

    it('should create key usable for signing', async () => {
      const key = await importES256PrivateKey(privateKeyPem)

      expect(key.usages).toContain('sign')
    })
  })

  describe('importES256PublicKey', () => {
    it('should import public key from PEM format', async () => {
      const key = await importES256PublicKey(publicKeyPem)

      expect(key).toBeInstanceOf(CryptoKey)
      expect(key.type).toBe('public')
      expect(key.algorithm.name).toBe('ECDSA')
    })

    it('should create key usable for verification', async () => {
      const key = await importES256PublicKey(publicKeyPem)

      expect(key.usages).toContain('verify')
    })
  })

  describe('signES256', () => {
    it('should sign data and return 64-byte raw signature', async () => {
      const signature = await signES256(testData, privateKeyPem)

      expect(signature).toBeInstanceOf(ArrayBuffer)
      expect(signature.byteLength).toBe(64) // Raw r||s format for P-256
    })

    it('should produce different signatures for different data (due to ECDSA randomness)', async () => {
      const sig1 = await signES256('data1', privateKeyPem)
      const sig2 = await signES256('data2', privateKeyPem)

      const arr1 = new Uint8Array(sig1)
      const arr2 = new Uint8Array(sig2)

      expect(Array.from(arr1)).not.toEqual(Array.from(arr2))
    })

    it('should handle empty data', async () => {
      const signature = await signES256('', privateKeyPem)

      expect(signature).toBeInstanceOf(ArrayBuffer)
      expect(signature.byteLength).toBe(64)
    })
  })

  describe('verifyES256', () => {
    it('should verify valid signature', async () => {
      const signature = await signES256(testData, privateKeyPem)
      const isValid = await verifyES256(testData, signature, publicKeyPem)

      expect(isValid).toBe(true)
    })

    it('should reject signature for modified data', async () => {
      const signature = await signES256('original data', privateKeyPem)
      const isValid = await verifyES256('modified data', signature, publicKeyPem)

      expect(isValid).toBe(false)
    })

    it('should reject tampered signature', async () => {
      const signature = await signES256(testData, privateKeyPem)

      // Tamper with signature
      const tamperedSig = new Uint8Array(signature)
      tamperedSig[0] ^= 0xff // Flip all bits in first byte

      const isValid = await verifyES256(testData, tamperedSig.buffer, publicKeyPem)

      expect(isValid).toBe(false)
    })

    it('should handle empty data verification', async () => {
      const signature = await signES256('', privateKeyPem)
      const isValid = await verifyES256('', signature, publicKeyPem)

      expect(isValid).toBe(true)
    })

    it('should reject signature from different key pair', async () => {
      // Different key pair
      const differentPrivateKeyPem = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQggHYG9aqJkK8MqGEa
MHve1QFprKahkQU5rKp8fTYCO7uhRANCAASndDPAT4MMce0LFtq9Q3BVhWswEqgc
itKQzc6ng67FxUmsmr1AMlH/J+VvVM+crglWB9H2zEh/kXTpEyU9Xk+6
-----END PRIVATE KEY-----`

      const signature = await signES256(testData, differentPrivateKeyPem)
      const isValid = await verifyES256(testData, signature, publicKeyPem)

      expect(isValid).toBe(false)
    })
  })

  describe('round-trip signing and verification', () => {
    it('should successfully sign and verify multiple payloads', async () => {
      const testCases = [
        'hello world',
        'The quick brown fox jumps over the lazy dog',
        '{"userId":123,"email":"test@example.com"}',
        '',
        'a'.repeat(1000), // Large payload
      ]

      for (const data of testCases) {
        const signature = await signES256(data, privateKeyPem)
        const isValid = await verifyES256(data, signature, publicKeyPem)

        expect(isValid).toBe(true)
      }
    })
  })
})
