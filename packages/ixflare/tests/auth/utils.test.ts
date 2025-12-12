/**
 * @module auth/utils.test
 * @description Tests for JWT utility functions
 */

import { describe, it, expect } from 'vitest'
import { base64urlEncode, base64urlDecode, parseDuration } from '@/auth/utils'

describe('JWT Utils', () => {
  describe('base64urlEncode', () => {
    it('should encode ArrayBuffer to base64url string', () => {
      const data = new TextEncoder().encode('hello world')
      const encoded = base64urlEncode(data.buffer)

      expect(encoded).toBe('aGVsbG8gd29ybGQ')
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')
    })

    it('should handle empty buffer', () => {
      const data = new Uint8Array(0)
      const encoded = base64urlEncode(data.buffer)

      expect(encoded).toBe('')
    })

    it('should produce URL-safe output', () => {
      // Test data that would produce + or / in standard base64
      const data = new Uint8Array([0xff, 0xfe, 0xfd])
      const encoded = base64urlEncode(data.buffer)

      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')
    })
  })

  describe('base64urlDecode', () => {
    it('should decode base64url string to ArrayBuffer', () => {
      const encoded = 'aGVsbG8gd29ybGQ'
      const decoded = base64urlDecode(encoded)
      const text = new TextDecoder().decode(decoded)

      expect(text).toBe('hello world')
    })

    it('should handle empty string', () => {
      const decoded = base64urlDecode('')
      expect(decoded.byteLength).toBe(0)
    })

    it('should handle base64url characters (- and _)', () => {
      // Encode then decode to verify round-trip
      const original = new Uint8Array([0xff, 0xfe, 0xfd])
      const encoded = base64urlEncode(original.buffer)
      const decoded = base64urlDecode(encoded)
      const result = new Uint8Array(decoded)

      expect(Array.from(result)).toEqual(Array.from(original))
    })

    it('should round-trip encode/decode correctly', () => {
      const testCases = [
        'hello world',
        'The quick brown fox jumps over the lazy dog',
        '{"userId":123,"email":"test@example.com"}',
        '',
      ]

      for (const testCase of testCases) {
        const original = new TextEncoder().encode(testCase)
        const encoded = base64urlEncode(original.buffer)
        const decoded = base64urlDecode(encoded)
        const result = new TextDecoder().decode(decoded)

        expect(result).toBe(testCase)
      }
    })
  })

  describe('parseDuration', () => {
    it('should parse seconds', () => {
      expect(parseDuration('30s')).toBe(30)
      expect(parseDuration('1s')).toBe(1)
    })

    it('should parse minutes', () => {
      expect(parseDuration('15m')).toBe(900)
      expect(parseDuration('1m')).toBe(60)
    })

    it('should parse hours', () => {
      expect(parseDuration('1h')).toBe(3600)
      expect(parseDuration('24h')).toBe(86400)
    })

    it('should parse days', () => {
      expect(parseDuration('1d')).toBe(86400)
      expect(parseDuration('7d')).toBe(604800)
    })

    it('should handle numeric duration as seconds', () => {
      expect(parseDuration(300)).toBe(300)
      expect(parseDuration(3600)).toBe(3600)
    })

    it('should throw error for invalid format', () => {
      expect(() => parseDuration('invalid')).toThrow('Invalid duration format')
      expect(() => parseDuration('15x')).toThrow('Invalid duration format')
      expect(() => parseDuration('m15')).toThrow('Invalid duration format')
    })
  })
})
