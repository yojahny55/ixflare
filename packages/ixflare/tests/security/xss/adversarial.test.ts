/**
 * Adversarial XSS Test Suite
 *
 * These tests cover advanced XSS bypass techniques that attackers commonly use.
 * All tests MUST pass for the sanitizer to be considered secure.
 *
 * Attack vectors tested:
 * - Named HTML entity bypasses (&colon;, &Tab;, etc.)
 * - Control character injection (jav\tascript:)
 * - Multi-level encoding bypasses
 * - Regex parser edge cases
 * - Mutation XSS (mXSS) vectors
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../../../src/security/xss/sanitizer'
import { isUrlSafe } from '../../../src/security/xss/url-validation'

describe('Adversarial XSS Tests', () => {
  describe('Named Entity URL Scheme Bypass', () => {
    it('should detect javascript: encoded with &colon;', () => {
      // CRITICAL: &colon; decodes to : in browsers
      expect(isUrlSafe('javascript&colon;alert(1)')).toBe(false)
      expect(isUrlSafe('javascript&Colon;alert(1)')).toBe(false)
    })

    it('should detect data: encoded with &colon;', () => {
      expect(isUrlSafe('data&colon;text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('should detect vbscript: encoded with &colon;', () => {
      expect(isUrlSafe('vbscript&colon;alert(1)')).toBe(false)
    })

    it('should strip javascript&colon; from href in sanitizeHtml', () => {
      const html = '<a href="javascript&colon;alert(1)">Click me</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      expect(sanitized).not.toContain('javascript')
      expect(sanitized).not.toContain('&colon;')
    })

    it('should handle mixed entity encoding', () => {
      // j&#x61;v&#97;script&colon;alert(1)
      expect(isUrlSafe('j&#x61;v&#97;script&colon;alert(1)')).toBe(false)
    })

    it('should detect &Tab; entity bypass', () => {
      // &Tab; is a tab character which gets stripped
      expect(isUrlSafe('java&Tab;script:alert(1)')).toBe(false)
    })

    it('should detect &NewLine; entity bypass', () => {
      expect(isUrlSafe('java&NewLine;script:alert(1)')).toBe(false)
    })
  })

  describe('Control Character URL Scheme Bypass', () => {
    it('should detect javascript with embedded tab', () => {
      // jav\tascript:alert(1) - tab in the middle
      expect(isUrlSafe('jav\tascript:alert(1)')).toBe(false)
    })

    it('should detect javascript with embedded newline', () => {
      expect(isUrlSafe('jav\nascript:alert(1)')).toBe(false)
    })

    it('should detect javascript with embedded carriage return', () => {
      expect(isUrlSafe('jav\rascript:alert(1)')).toBe(false)
    })

    it('should detect javascript with multiple control characters', () => {
      expect(isUrlSafe('j\ta\nv\ra\0script:alert(1)')).toBe(false)
    })

    it('should detect javascript with null byte', () => {
      expect(isUrlSafe('java\0script:alert(1)')).toBe(false)
    })

    it('should strip control characters in sanitizeHtml', () => {
      const html = '<a href="jav\tascript:alert(1)">Click</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      expect(sanitized).not.toContain('javascript')
    })
  })

  describe('Multi-Level Encoding Bypass', () => {
    it('should detect double URL-encoded javascript', () => {
      // %256a%2561... = %6a%61... after first decode = javascript after second
      expect(isUrlSafe('%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)')).toBe(false)
    })

    it('should detect triple URL-encoded javascript', () => {
      expect(isUrlSafe('%25256a%252561%252576%252561%252573%252563%252572%252569%252570%252574:alert(1)')).toBe(false)
    })

    it('should detect mixed HTML entity + URL encoding', () => {
      // &#x6a; = j, %61 = a, etc.
      expect(isUrlSafe('&#x6a;%61vascript:alert(1)')).toBe(false)
    })

    it('should detect decimal entity encoded javascript', () => {
      // &#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116; = javascript
      expect(isUrlSafe('&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)')).toBe(false)
    })

    it('should detect hex entity encoded javascript', () => {
      // &#x6a;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74; = javascript
      expect(isUrlSafe('&#x6a;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)')).toBe(false)
    })
  })

  describe('HTML Parser Edge Cases', () => {
    it('should handle > inside quoted attribute values', () => {
      // This is the mXSS vector: <img title=">" onerror=alert(1)>
      const html = '<img title=">" onerror="alert(1)">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['title', 'src', 'alt'] },
      })
      // Should NOT contain onerror
      expect(sanitized).not.toContain('onerror')
      // The title attribute with > should be handled correctly
      expect(sanitized).toContain('title')
    })

    it('should handle single quotes inside double-quoted attributes', () => {
      const html = `<img title="it's fine" src="x" onerror="alert(1)">`
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['title', 'src'] },
      })
      expect(sanitized).not.toContain('onerror')
    })

    it('should handle double quotes inside single-quoted attributes', () => {
      const html = `<img title='say "hello"' src='x' onerror='alert(1)'>`
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['title', 'src'] },
      })
      expect(sanitized).not.toContain('onerror')
    })

    it('should strip unquoted attribute values with dangerous content', () => {
      const html = '<div onclick=alert(1)>text</div>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['div'],
        allowedAttributes: { div: ['class'] },
      })
      expect(sanitized).not.toContain('onclick')
    })
  })

  describe('Event Handler Bypass Attempts', () => {
    it('should strip all on* event handlers', () => {
      const eventHandlers = [
        'onclick', 'onerror', 'onload', 'onmouseover', 'onfocus',
        'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup',
        'onmousedown', 'onmouseup', 'ondblclick', 'oncontextmenu',
        'onscroll', 'onresize', 'oninput', 'onpaste', 'oncopy',
      ]

      eventHandlers.forEach((handler) => {
        const html = `<div ${handler}="alert(1)">text</div>`
        const sanitized = sanitizeHtml(html, {
          allowedTags: ['div'],
          allowedAttributes: { div: ['class', 'id'] },
        })
        expect(sanitized).not.toContain(handler)
      })
    })

    it('should strip event handlers with spaces', () => {
      const html = '<div on click="alert(1)">text</div>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['div'],
        allowedAttributes: { div: ['class'] },
      })
      // The malformed attribute shouldn't be preserved
      expect(sanitized).not.toContain('click')
    })

    it('should strip event handlers with mixed case', () => {
      const html = '<div ONCLICK="alert(1)" OnMouseOver="alert(2)">text</div>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['div'],
        allowedAttributes: { div: ['class'] },
      })
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).not.toContain('onmouseover')
      expect(sanitized).not.toContain('ONCLICK')
      expect(sanitized).not.toContain('OnMouseOver')
    })
  })

  describe('URL Attribute Bypass Attempts', () => {
    it('should validate all URL-bearing attributes', () => {
      const urlAttrs = ['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data']

      urlAttrs.forEach((attr) => {
        const tag = attr === 'href' ? 'a' : attr === 'action' ? 'form' : 'img'
        const html = `<${tag} ${attr}="javascript:alert(1)"></${tag}>`
        const sanitized = sanitizeHtml(html, {
          allowedTags: [tag],
          allowedAttributes: { [tag]: [attr] },
        })
        expect(sanitized).not.toContain('javascript')
      })
    })

    it('should detect javascript in srcset', () => {
      const html = '<img srcset="javascript:alert(1) 1x, /safe.jpg 2x">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['srcset'] },
      })
      expect(sanitized).not.toContain('javascript')
    })
  })

  describe('Dangerous Tag Stripping', () => {
    it('should strip script tags', () => {
      const html = '<p>Hello</p><script>alert(1)</script><p>World</p>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('</script>')
      expect(sanitized).toContain('<p>Hello</p>')
    })

    it('should strip iframe tags', () => {
      const html = '<p>Safe</p><iframe src="evil.html"></iframe>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('<iframe')
    })

    it('should strip object tags', () => {
      const html = '<p>Safe</p><object data="evil.swf"></object>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('<object')
    })

    it('should strip embed tags', () => {
      const html = '<p>Safe</p><embed src="evil.swf">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('<embed')
    })

    it('should strip svg with script', () => {
      const html = '<p>Safe</p><svg><script>alert(1)</script></svg>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('<svg')
      expect(sanitized).not.toContain('<script')
    })
  })

  describe('Real-World XSS Payloads', () => {
    const payloads = [
      // Basic payloads
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<iframe src="javascript:alert(1)">',

      // Encoding bypasses
      '<a href="javascript&colon;alert(1)">click</a>',
      '<a href="jav\tascript:alert(1)">click</a>',
      '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">click</a>',

      // Event handler variations
      '<div onmouseover="alert(1)">hover</div>',
      '<input onfocus=alert(1) autofocus>',
      '<marquee onstart=alert(1)>',
      '<video><source onerror="alert(1)"></video>',

      // Data URL
      '<a href="data:text/html,<script>alert(1)</script>">click</a>',
      '<object data="data:text/html,<script>alert(1)</script>">',

      // Protocol variations
      '<a href="vbscript:alert(1)">click</a>',
      '<a href="file:///etc/passwd">click</a>',
    ]

    payloads.forEach((payload, index) => {
      it(`should neutralize payload #${index + 1}`, () => {
        const sanitized = sanitizeHtml(payload, {
          allowedTags: ['a', 'p', 'div', 'span'],
          allowedAttributes: { a: ['href', 'title'] },
        })

        // These patterns should NEVER appear in sanitized output
        expect(sanitized).not.toMatch(/<script/i)
        expect(sanitized).not.toMatch(/onerror/i)
        expect(sanitized).not.toMatch(/onload/i)
        expect(sanitized).not.toMatch(/onclick/i)
        expect(sanitized).not.toMatch(/onmouseover/i)
        expect(sanitized).not.toMatch(/onfocus/i)
        expect(sanitized).not.toMatch(/onstart/i)
        expect(sanitized).not.toMatch(/javascript:/i)
        expect(sanitized).not.toMatch(/vbscript:/i)
        expect(sanitized).not.toMatch(/data:/i)
        expect(sanitized).not.toMatch(/<iframe/i)
        expect(sanitized).not.toMatch(/<svg/i)
        expect(sanitized).not.toMatch(/<object/i)
        expect(sanitized).not.toMatch(/<embed/i)
        expect(sanitized).not.toMatch(/<body/i)
        expect(sanitized).not.toMatch(/<marquee/i)
        expect(sanitized).not.toMatch(/<video/i)
        expect(sanitized).not.toMatch(/<input/i)
      })
    })
  })

  describe('Edge Case URL Validation', () => {
    it('should allow safe protocols', () => {
      expect(isUrlSafe('https://example.com')).toBe(true)
      expect(isUrlSafe('http://example.com')).toBe(true)
      expect(isUrlSafe('mailto:test@example.com')).toBe(true)
      expect(isUrlSafe('tel:+1234567890')).toBe(true)
    })

    it('should allow relative URLs', () => {
      expect(isUrlSafe('/path/to/page')).toBe(true)
      expect(isUrlSafe('./relative')).toBe(true)
      expect(isUrlSafe('../parent')).toBe(true)
      expect(isUrlSafe('#anchor')).toBe(true)
      expect(isUrlSafe('?query=param')).toBe(true)
    })

    it('should block dangerous protocols regardless of case', () => {
      expect(isUrlSafe('JAVASCRIPT:alert(1)')).toBe(false)
      expect(isUrlSafe('JavaScript:alert(1)')).toBe(false)
      expect(isUrlSafe('DATA:text/html,test')).toBe(false)
      expect(isUrlSafe('VBSCRIPT:alert(1)')).toBe(false)
      expect(isUrlSafe('FILE:///etc/passwd')).toBe(false)
    })

    it('should handle empty and whitespace URLs', () => {
      expect(isUrlSafe('')).toBe(false)
      expect(isUrlSafe('   ')).toBe(true) // Trimmed to empty, treated as relative
      expect(isUrlSafe('  https://example.com  ')).toBe(true)
    })

    it('should handle malformed URLs gracefully', () => {
      expect(() => isUrlSafe('://missing-scheme')).not.toThrow()
      expect(() => isUrlSafe('%invalid%encoding')).not.toThrow()
      expect(() => isUrlSafe('javascript:' + 'a'.repeat(10000))).not.toThrow()
    })
  })
})
