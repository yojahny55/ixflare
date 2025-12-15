import { describe, it, expect } from 'vitest'
import {
  sanitizeHtml,
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  escapeUrl,
  isUrlSafe,
  presets,
} from '../../../src/security/xss'

describe('XSS Prevention Integration', () => {
  describe('Complete Flow: User Comment with Link', () => {
    it('should safely render user comment with sanitization', () => {
      const userInput =
        '<p>Check out <a href="javascript:alert(1)">this</a> and <script>malicious()</script>!</p>'

      const sanitized = sanitizeHtml(userInput, presets.basic)

      // Script tags should be stripped (but text content remains as plain text - safe)
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('</script>')

      // JavaScript URL should be blocked (href attribute removed)
      expect(sanitized).not.toContain('javascript:')

      // Safe content remains
      expect(sanitized).toContain('Check out')
      expect(sanitized).toContain('this')
      expect(sanitized).toContain('malicious()') // Safe as plain text, not executable
    })
  })

  describe('Complete Flow: Rich Content Post', () => {
    it('should handle blog post with mixed content', () => {
      const blogPost = `
        <h1>My Blog Post</h1>
        <p>This is a <b>great</b> article about security.</p>
        <img src="https://example.com/image.jpg" alt="Security" onerror="alert(1)">
        <a href="https://example.com">Read more</a>
      `

      const sanitized = sanitizeHtml(blogPost, presets.rich)

      // Safe elements preserved
      expect(sanitized).toContain('<h1>My Blog Post</h1>')
      expect(sanitized).toContain('<b>great</b>')
      expect(sanitized).toContain('href="https://example.com"')

      // Dangerous attributes removed
      expect(sanitized).not.toContain('onerror')

      // Image src preserved but onerror removed
      expect(sanitized).toContain('src="https://example.com/image.jpg"')
      expect(sanitized).toContain('alt="Security"')
    })
  })

  describe('Layered Defense: Escaping + Sanitization', () => {
    it('should provide defense in depth', () => {
      const input = '<img src=x onerror=alert(1)>'

      // First layer: escaping
      const escaped = escapeHtml(input)
      expect(escaped).not.toContain('<img')
      expect(escaped).toContain('&lt;img')

      // Second layer: sanitization (if escaping is bypassed)
      const sanitized = sanitizeHtml(input, presets.rich)
      expect(sanitized).not.toContain('onerror')
    })
  })

  describe('URL Validation in Context', () => {
    it('should validate URLs before allowing in sanitized output', () => {
      const links = [
        '<a href="https://safe.com">Safe</a>',
        '<a href="javascript:alert(1)">Dangerous JS</a>',
        '<a href="data:text/html,alert">Data URL</a>',
      ]

      links.forEach((link) => {
        const sanitized = sanitizeHtml(link, {
          allowedTags: ['a'],
          allowedAttributes: { a: ['href'] },
        })

        if (link.includes('https://safe.com')) {
          expect(sanitized).toContain('href="https://safe.com"')
        } else {
          // Dangerous URLs should have href attribute stripped
          expect(sanitized).not.toContain('href=')
          // Link text remains (safe)
          expect(sanitized).toContain('<a>')
        }
      })
    })
  })

  describe('Context-Specific Encoding', () => {
    it('should use appropriate encoding for different contexts', () => {
      const userInput = '"><script>alert(1)</script>'

      // HTML context
      const htmlSafe = escapeHtml(userInput)
      expect(htmlSafe).not.toContain('<script')

      // Attribute context (more strict)
      const attrSafe = escapeHtmlAttribute(userInput)
      expect(attrSafe).not.toContain('"')
      expect(attrSafe).not.toContain('<')

      // JavaScript context
      const jsSafe = escapeJavaScript(userInput)
      expect(jsSafe).toContain('\\"')

      // URL context
      const urlSafe = escapeUrl(userInput)
      expect(urlSafe).not.toContain('<')
    })
  })

  describe('Real-World XSS Payloads', () => {
    it('should block common XSS attack vectors', () => {
      const payloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<input onfocus=alert(1) autofocus>',
        '<a href="javascript:alert(1)">Click</a>',
        '<div onclick="alert(1)">Click</div>',
      ]

      payloads.forEach((payload) => {
        const sanitized = sanitizeHtml(payload, presets.basic)

        // No executable code should remain
        expect(sanitized).not.toContain('<script')
        expect(sanitized).not.toContain('onerror')
        expect(sanitized).not.toContain('onload')
        expect(sanitized).not.toContain('onclick')
        expect(sanitized).not.toContain('javascript:')
      })
    })
  })

  describe('Export Verification', () => {
    it('should export all required functions', () => {
      expect(typeof sanitizeHtml).toBe('function')
      expect(typeof escapeHtml).toBe('function')
      expect(typeof escapeHtmlAttribute).toBe('function')
      expect(typeof escapeJavaScript).toBe('function')
      expect(typeof escapeUrl).toBe('function')
      expect(typeof isUrlSafe).toBe('function')
      expect(typeof presets).toBe('object')
    })

    it('should have all preset configurations', () => {
      expect(presets).toHaveProperty('text')
      expect(presets).toHaveProperty('basic')
      expect(presets).toHaveProperty('rich')
    })
  })
})
