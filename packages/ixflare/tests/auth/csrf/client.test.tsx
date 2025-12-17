/**
 * CSRF Client Helpers Tests
 * Story 5-6: CSRF Protection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  getCsrfToken,
  csrfToken,
  getCSRFInputProps,
  CSRFInput,
} from '../../../src/auth/csrf/client'

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

  describe('getCSRFInputProps', () => {
    beforeEach(() => {
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature',
      }
    })

    afterEach(() => {
      delete (global as any).document
    })

    it('should return props object with type, name, and value', () => {
      const props = getCSRFInputProps()

      expect(props).toEqual({
        type: 'hidden',
        name: '_csrf',
        value: 'token-value',
      })
    })

    it('should support custom field name', () => {
      const props = getCSRFInputProps('custom_csrf_field')

      expect(props).toEqual({
        type: 'hidden',
        name: 'custom_csrf_field',
        value: 'token-value',
      })
    })

    it('should return null if no token available', () => {
      delete (global as any).document

      const props = getCSRFInputProps()

      expect(props).toBeNull()
    })

    it('should return null if cookie not found', () => {
      ;(global as any).document = {
        cookie: '__session=sess-123',
      }

      const props = getCSRFInputProps()

      expect(props).toBeNull()
    })

    it('should return props that can be spread into an input element', () => {
      const props = getCSRFInputProps()

      // These props can be spread: <input {...props} />
      expect(props).not.toBeNull()
      expect(props!.type).toBe('hidden')
      expect(props!.name).toBe('_csrf')
      expect(typeof props!.value).toBe('string')
    })
  })

  describe('CSRFInput', () => {
    beforeEach(() => {
      ;(global as any).document = {
        cookie: '__csrf=token-value.signature',
      }
    })

    afterEach(() => {
      delete (global as any).document
    })

    it('should render a hidden input element with CSRF token', () => {
      const html = renderToStaticMarkup(<CSRFInput />)

      expect(html).toBe('<input type="hidden" name="_csrf" value="token-value"/>')
    })

    it('should render with custom field name', () => {
      const html = renderToStaticMarkup(<CSRFInput fieldName="my_token" />)

      expect(html).toBe('<input type="hidden" name="my_token" value="token-value"/>')
    })

    it('should render hidden input with default field name', () => {
      const html = renderToStaticMarkup(<CSRFInput />)

      expect(html).toContain('type="hidden"')
      expect(html).toContain('name="_csrf"')
      expect(html).toContain('value="token-value"')
    })

    it('should return null if no token available', () => {
      delete (global as any).document

      const result = CSRFInput({ fieldName: '_csrf' })

      expect(result).toBeNull()
    })

    it('should render empty when no token available', () => {
      delete (global as any).document

      const html = renderToStaticMarkup(<CSRFInput />)

      expect(html).toBe('')
    })
  })
})
