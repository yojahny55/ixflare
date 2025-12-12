/**
 * @module auth/jwt.test
 * @description Tests for JWT implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { jwt } from '@/auth'
import {
  TokenExpiredError,
  TokenInvalidError,
  AlgorithmMismatchError,
  SignatureVerificationError,
} from '@/auth/errors'

describe('JWT Module', () => {
  beforeEach(() => {
    // Configure JWT before each test
    jwt.configure({
      algorithm: 'HS256',
      secret: 'test-secret-key-for-jwt-testing',
      defaultExpiresIn: '15m',
    })
  })

  describe('Error Classes', () => {
    it('should create TokenExpiredError with expiredAt timestamp', () => {
      const expiredAt = Math.floor(Date.now() / 1000) - 3600
      const error = new TokenExpiredError(expiredAt)

      expect(error).toBeInstanceOf(TokenExpiredError)
      expect(error.name).toBe('TokenExpiredError')
      expect(error.expiredAt).toBe(expiredAt)
      expect(error.code).toBe('AUTH.TOKEN_EXPIRED')
      expect(error.status).toBe(401)
    })

    it('should create TokenInvalidError', () => {
      const error = new TokenInvalidError()

      expect(error).toBeInstanceOf(TokenInvalidError)
      expect(error.name).toBe('TokenInvalidError')
      expect(error.code).toBe('AUTH.TOKEN_INVALID')
      expect(error.status).toBe(401)
    })

    it('should create AlgorithmMismatchError with expected and received algorithms', () => {
      const error = new AlgorithmMismatchError('ES256', 'HS256')

      expect(error).toBeInstanceOf(AlgorithmMismatchError)
      expect(error.name).toBe('AlgorithmMismatchError')
      expect(error.code).toBe('AUTH.ALGORITHM_MISMATCH')
      expect(error.message).toContain('ES256')
      expect(error.message).toContain('HS256')
      expect(error.status).toBe(401)
    })

    it('should create SignatureVerificationError', () => {
      const error = new SignatureVerificationError()

      expect(error).toBeInstanceOf(SignatureVerificationError)
      expect(error.name).toBe('SignatureVerificationError')
      expect(error.code).toBe('AUTH.SIGNATURE_VERIFICATION_FAILED')
      expect(error.status).toBe(401)
    })
  })

  describe('jwt.sign()', () => {
    it('should create a valid JWT token', async () => {
      const payload = { userId: 123, email: 'test@example.com' }
      const token = await jwt.sign(payload)

      expect(token).toBeTypeOf('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should include iat and exp claims', async () => {
      const payload = { userId: 123 }
      const token = await jwt.sign(payload)
      const decoded = jwt.decode(token)

      expect(decoded.payload.iat).toBeTypeOf('number')
      expect(decoded.payload.exp).toBeTypeOf('number')
      expect(decoded.payload.exp).toBeGreaterThan(decoded.payload.iat!)
    })

    it('should use default expiry of 15 minutes', async () => {
      const payload = { userId: 123 }
      const token = await jwt.sign(payload)
      const decoded = jwt.decode(token)

      const expectedExp = decoded.payload.iat! + 900 // 15m = 900s
      expect(decoded.payload.exp).toBe(expectedExp)
    })

    it('should respect custom expiresIn option', async () => {
      const payload = { userId: 123 }
      const token = await jwt.sign(payload, { expiresIn: '1h' })
      const decoded = jwt.decode(token)

      const expectedExp = decoded.payload.iat! + 3600 // 1h = 3600s
      expect(decoded.payload.exp).toBe(expectedExp)
    })

    it('should preserve custom payload fields', async () => {
      const payload = { userId: 123, email: 'test@example.com', role: 'admin' }
      const token = await jwt.sign(payload)
      const decoded = jwt.decode(token)

      expect(decoded.payload.userId).toBe(123)
      expect(decoded.payload.email).toBe('test@example.com')
      expect(decoded.payload.role).toBe('admin')
    })

    it('should create HS256 header', async () => {
      const token = await jwt.sign({ userId: 123 })
      const decoded = jwt.decode(token)

      expect(decoded.header.alg).toBe('HS256')
      expect(decoded.header.typ).toBe('JWT')
    })
  })

  describe('jwt.verify()', () => {
    it('should verify and decode valid token', async () => {
      const payload = { userId: 123, email: 'test@example.com' }
      const token = await jwt.sign(payload)
      const verified = await jwt.verify(token)

      expect(verified.userId).toBe(123)
      expect(verified.email).toBe('test@example.com')
    })

    it('should throw TokenExpiredError for expired token', async () => {
      const payload = { userId: 123 }
      const token = await jwt.sign(payload, { expiresIn: '1s' })

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      await expect(jwt.verify(token)).rejects.toThrow(TokenExpiredError)
    })

    it('should throw TokenInvalidError for malformed token', async () => {
      await expect(jwt.verify('invalid.token')).rejects.toThrow(TokenInvalidError)
      await expect(jwt.verify('not-a-token')).rejects.toThrow(TokenInvalidError)
    })

    it('should throw SignatureVerificationError for tampered token', async () => {
      const token = await jwt.sign({ userId: 123 })
      const parts = token.split('.')
      // Tamper with payload
      parts[1] = parts[1].slice(0, -1) + 'X'
      const tamperedToken = parts.join('.')

      await expect(jwt.verify(tamperedToken)).rejects.toThrow(SignatureVerificationError)
    })

    it('should throw SignatureVerificationError for wrong secret', async () => {
      const token = await jwt.sign({ userId: 123 })

      // Change secret
      jwt.configure({
        algorithm: 'HS256',
        secret: 'different-secret',
        defaultExpiresIn: '15m',
      })

      await expect(jwt.verify(token)).rejects.toThrow(SignatureVerificationError)
    })

    it('should validate algorithm before signature check', async () => {
      // Create token with HS256
      const payload = { userId: 123 }
      const token = await jwt.sign(payload)

      // Decode and change algorithm header
      const parts = token.split('.')
      const header = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), (c) =>
            c.charCodeAt(0)
          )
        )
      )
      header.alg = 'RS256'

      // Re-encode header
      const newHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const tamperedToken = `${newHeader}.${parts[1]}.${parts[2]}`

      await expect(jwt.verify(tamperedToken)).rejects.toThrow(AlgorithmMismatchError)
    })
  })

  describe('jwt.decode()', () => {
    it('should decode token without verification', async () => {
      const payload = { userId: 123, email: 'test@example.com' }
      const token = await jwt.sign(payload)
      const decoded = jwt.decode(token)

      expect(decoded.header.alg).toBe('HS256')
      expect(decoded.payload.userId).toBe(123)
      expect(decoded.payload.email).toBe('test@example.com')
    })

    it('should decode expired token without throwing', async () => {
      const payload = { userId: 123 }
      const token = await jwt.sign(payload, { expiresIn: '1s' })

      await new Promise((resolve) => setTimeout(resolve, 1100))

      const decoded = jwt.decode(token)
      expect(decoded.payload.userId).toBe(123)
    })

    it('should throw for malformed token', () => {
      expect(() => jwt.decode('invalid.token')).toThrow(TokenInvalidError)
      expect(() => jwt.decode('not-a-token')).toThrow(TokenInvalidError)
    })
  })

  describe('Security Tests (AC5, Task 12)', () => {
    it('should prevent algorithm confusion attack', async () => {
      const token = await jwt.sign({ userId: 123 })

      // Attempt to change algorithm to "none"
      const parts = token.split('.')
      const noneHeader = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      const noneToken = `${noneHeader}.${parts[1]}.`

      await expect(jwt.verify(noneToken)).rejects.toThrow()
    })

    it('should reject expired tokens', async () => {
      const token = await jwt.sign({ userId: 123 }, { expiresIn: '0s' })

      await expect(jwt.verify(token)).rejects.toThrow(TokenExpiredError)
    })

    it('should handle malformed tokens safely', async () => {
      const malformedTokens = [
        '',
        'a',
        'a.b',
        'a.b.c.d',
        'not-base64.not-base64.not-base64',
        '{}',
      ]

      for (const token of malformedTokens) {
        await expect(jwt.verify(token)).rejects.toThrow()
      }
    })

    it('should reject invalid signatures', async () => {
      const token = await jwt.sign({ userId: 123 })
      const parts = token.split('.')

      // Replace signature with invalid one
      const invalidToken = `${parts[0]}.${parts[1]}.invalidSignature`

      await expect(jwt.verify(invalidToken)).rejects.toThrow()
    })
  })
})
