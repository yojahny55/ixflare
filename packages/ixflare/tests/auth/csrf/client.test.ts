/**
 * CSRF Client Helpers Tests
 * Story 5-6: CSRF Protection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCsrfToken, csrfToken } from '../../../src/auth/csrf/client'

describe('CSRF Client Helpers', () => {
  describe('getCsrfToken', () => {
    let originalDocument: typeof document | undefined

    beforeEach(() => {
      // Save original document
      originalDocument = (global as any).document

      // Mock document.cookie
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature',
      }
    })

    afterEach(() => {
      // Restore original document
      if (originalDocument === undefined) {
        delete (global as any).document
      } else {
        ;(global as any).document = originalDocument
      }
    })

    it('should extract token value from cookie', () => {
      const token = getCsrfToken()

      expect(token).toBe('token-value')
    })

    it('should extract token value from signed cookie format', () => {
      ;(global as any).document = {
        cookie: '__csrf=uuid-abc-123.base64-signature',
      }

      const token = getCsrfToken()

      expect(token).toBe('uuid-abc-123')
    })

    it('should handle custom cookie name', () => {
      ;(global as any).document = {
        cookie: '_custom_csrf=custom-token-value.signature',
      }

      const token = getCsrfToken('_custom_csrf')

      expect(token).toBe('custom-token-value')
    })

    it('should parse token from multiple cookies', () => {
      ;(global as any).document = {
        cookie: '__session=sess-123; __csrf=token-value.signature; other=value',
      }

      const token = getCsrfToken()

      expect(token).toBe('token-value')
    })

    it('should return null if cookie not found', () => {
      ;(global as any).document = {
        cookie: '__session=sess-123',
      }

      const token = getCsrfToken()

      expect(token).toBeNull()
    })

    it('should return null if cookie is empty', () => {
      ;(global as any).document = {
        cookie: '',
      }

      const token = getCsrfToken()

      expect(token).toBeNull()
    })

    it('should handle cookie with spaces', () => {
      ;(global as any).document = {
        cookie: ' __csrf=token-value.signature ',
      }

      const token = getCsrfToken()

      expect(token).toBe('token-value')
    })

    it('should return null on server-side (no document)', () => {
      delete (global as any).document

      const token = getCsrfToken()

      expect(token).toBeNull()
    })

    it('should handle malformed cookie (no signature)', () => {
      ;(global as any).document = {
        cookie: '__csrf=token-value-only',
      }

      const token = getCsrfToken()

      // Should return the value as-is if no dot separator
      expect(token).toBe('token-value-only')
    })
  })

  describe('csrfToken', () => {
    beforeEach(() => {
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature',
      }
    })

    afterEach(() => {
      delete (global as any).document
    })

    it('should return token value', () => {
      const token = csrfToken()

      expect(token).toBe('token-value')
    })

    it('should return empty string if no token available', () => {
      delete (global as any).document

      const token = csrfToken()

      expect(token).toBe('')
    })

    it('should return empty string if cookie not found', () => {
      ;(global as any).document = {
        cookie: '__session=sess-123',
      }

      const token = csrfToken()

      expect(token).toBe('')
    })
  })

  describe('Security Considerations', () => {
    beforeEach(() => {
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature',
      }
    })

    afterEach(() => {
      delete (global as any).document
    })

    it('should extract only token value, not signature', () => {
      // This ensures the signature stays in httpOnly cookie
      const token = getCsrfToken()

      expect(token).toBe('token-value')
      expect(token).not.toContain('signature')
      expect(token).not.toContain('.')
    })

    it('should work with httpOnly=false cookies only', () => {
      // This test documents that CSRF cookies MUST have httpOnly=false
      // otherwise document.cookie won't have access

      // Simulate httpOnly=false cookie (accessible via document.cookie)
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature',
      }

      const token = getCsrfToken()

      expect(token).toBe('token-value')
    })
  })
})
