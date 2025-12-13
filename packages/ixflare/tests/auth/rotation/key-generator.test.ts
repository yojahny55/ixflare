/**
 * @module tests/auth/rotation/key-generator
 * @description Tests for key generation
 */

import { describe, it, expect } from 'vitest'
import {
  generateES256KeyPair,
  generateHS256Secret,
  generateKeyId,
  exportKeyAsBase64url,
} from '@/auth/rotation/key-generator'

describe('Key Generator', () => {
  describe('generateES256KeyPair', () => {
    it('should generate valid ES256 key pair', async () => {
      const { privateKey, publicKey, publicJwk } = await generateES256KeyPair()

      expect(privateKey).toBeDefined()
      expect(publicKey).toBeDefined()
      expect(publicJwk).toBeDefined()

      // Verify JWK structure
      expect(publicJwk.kty).toBe('EC')
      expect(publicJwk.crv).toBe('P-256')
      expect(publicJwk.x).toBeDefined()
      expect(publicJwk.y).toBeDefined()
    })

    it('should generate extractable keys', async () => {
      const { privateKey, publicKey } = await generateES256KeyPair()

      expect(privateKey.extractable).toBe(true)
      expect(publicKey.extractable).toBe(true)
    })
  })

  describe('generateHS256Secret', () => {
    it('should generate valid HS256 secret', async () => {
      const secret = await generateHS256Secret()

      expect(secret).toBeDefined()
      expect(secret.type).toBe('secret')
      expect(secret.extractable).toBe(true)
    })

    it('should generate 512-bit secret (64 bytes)', async () => {
      const secret = await generateHS256Secret()
      const exported = await crypto.subtle.exportKey('raw', secret)

      // HMAC-SHA256 generates 512-bit (64 byte) keys
      expect(exported.byteLength).toBe(64)
    })
  })

  describe('generateKeyId', () => {
    it('should generate kid in correct format', () => {
      const kid = generateKeyId()

      // Format: key-YYYY-MM-DD-xxxx
      expect(kid).toMatch(/^key-\d{4}-\d{2}-\d{2}-[a-f0-9]{4}$/)
    })

    it('should generate unique kids', () => {
      const kid1 = generateKeyId()
      const kid2 = generateKeyId()

      expect(kid1).not.toBe(kid2)
    })

    it('should include current date', () => {
      const kid = generateKeyId()
      const today = new Date().toISOString().slice(0, 10)

      expect(kid).toContain(today)
    })
  })

  describe('exportKeyAsBase64url', () => {
    it('should export key as base64url string', async () => {
      const secret = await generateHS256Secret()
      const exported = await exportKeyAsBase64url(secret)

      expect(typeof exported).toBe('string')
      expect(exported.length).toBeGreaterThan(0)
      // Base64url should not contain +, /, or =
      expect(exported).not.toMatch(/[+/=]/)
    })
  })
})
