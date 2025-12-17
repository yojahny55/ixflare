import { describe, it, expect } from 'vitest'
import { isUrlSafe } from '../../../src/security/xss/url-validation'

describe('isUrlSafe', () => {
  describe('Dangerous Schemes', () => {
    it('should block javascript: protocol', () => {
      expect(isUrlSafe('javascript:alert(1)')).toBe(false)
      expect(isUrlSafe('JavaScript:alert(1)')).toBe(false)
      expect(isUrlSafe('JAVASCRIPT:alert(1)')).toBe(false)
    })

    it('should block data: protocol', () => {
      expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isUrlSafe('DATA:text/html,test')).toBe(false)
    })

    it('should block vbscript: protocol', () => {
      expect(isUrlSafe('vbscript:alert(1)')).toBe(false)
      expect(isUrlSafe('VBScript:msgbox(1)')).toBe(false)
    })

    it('should block file: protocol', () => {
      expect(isUrlSafe('file:///etc/passwd')).toBe(false)
      expect(isUrlSafe('FILE:///C:/windows')).toBe(false)
    })
  })

  describe('Safe Schemes', () => {
    it('should allow http: protocol', () => {
      expect(isUrlSafe('http://example.com')).toBe(true)
      expect(isUrlSafe('HTTP://example.com')).toBe(true)
    })

    it('should allow https: protocol', () => {
      expect(isUrlSafe('https://example.com')).toBe(true)
      expect(isUrlSafe('HTTPS://example.com')).toBe(true)
    })

    it('should allow mailto: protocol', () => {
      expect(isUrlSafe('mailto:test@example.com')).toBe(true)
      expect(isUrlSafe('MAILTO:admin@site.com')).toBe(true)
    })

    it('should allow tel: protocol', () => {
      expect(isUrlSafe('tel:+1234567890')).toBe(true)
      expect(isUrlSafe('TEL:555-1234')).toBe(true)
    })
  })

  describe('Relative URLs', () => {
    it('should allow relative paths by default', () => {
      expect(isUrlSafe('/path/to/page')).toBe(true)
      expect(isUrlSafe('../parent/page')).toBe(true)
      expect(isUrlSafe('./sibling/page')).toBe(true)
      expect(isUrlSafe('page.html')).toBe(true)
    })

    it('should allow query strings', () => {
      expect(isUrlSafe('/search?q=test')).toBe(true)
      expect(isUrlSafe('?param=value')).toBe(true)
    })

    it('should allow fragments', () => {
      expect(isUrlSafe('#section')).toBe(true)
      expect(isUrlSafe('/page#top')).toBe(true)
    })
  })

  describe('Custom Configuration', () => {
    it('should respect custom allowed schemes', () => {
      expect(isUrlSafe('ftp://example.com', { allowedSchemes: ['ftp'] })).toBe(true)
      expect(isUrlSafe('ftp://example.com', { allowedSchemes: ['http', 'https'] })).toBe(false)
    })

    it('should block schemes not in allowed list', () => {
      expect(isUrlSafe('http://example.com', { allowedSchemes: ['https'] })).toBe(false)
    })

    it('should allow disabling relative URLs', () => {
      expect(isUrlSafe('/path', { allowRelative: false })).toBe(false)
      expect(isUrlSafe('https://example.com', { allowRelative: false })).toBe(true)
    })
  })

  describe('Encoding Bypass Prevention', () => {
    it('should decode URL-encoded schemes', () => {
      // %6a%61%76%61%73%63%72%69%70%74 = javascript
      expect(isUrlSafe('%6a%61%76%61%73%63%72%69%70%74:alert(1)')).toBe(false)
    })

    it('should handle mixed encoding', () => {
      expect(isUrlSafe('java%73cript:alert(1)')).toBe(false)
    })

    it('should handle double encoding', () => {
      // %25 = %, so %256a = %6a after first decode
      expect(isUrlSafe('%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)')).toBe(false)
    })

    it('should handle triple encoding', () => {
      // Triple-encoded 'javascript'
      // j = %6a -> %256a -> %25256a
      expect(
        isUrlSafe('%25256a%252561%252576%252561%252573%252563%252572%252569%252570%252574:alert(1)')
      ).toBe(false)
    })

    it('should prevent infinite decoding loops', () => {
      // Malformed but shouldn't hang
      const malformed = '%'.repeat(100) + 'javascript:alert(1)'
      expect(() => isUrlSafe(malformed)).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(isUrlSafe('')).toBe(false)
    })

    it('should handle whitespace', () => {
      expect(isUrlSafe('  https://example.com  ')).toBe(true)
    })

    it('should handle malformed URLs gracefully', () => {
      expect(isUrlSafe('not a url at all')).toBe(true) // Treated as relative
    })

    it('should handle URLs with ports', () => {
      expect(isUrlSafe('https://example.com:8080/path')).toBe(true)
    })

    it('should handle URLs with authentication', () => {
      expect(isUrlSafe('https://user:pass@example.com')).toBe(true)
    })
  })
})
