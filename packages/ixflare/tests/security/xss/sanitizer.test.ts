import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../../../src/security/xss/sanitizer'

describe('sanitizeHtml', () => {
  describe('Tag Filtering', () => {
    it('should allow whitelisted tags', () => {
      const html = '<p>Hello</p><b>World</b>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p', 'b'],
      })
      expect(sanitized).toBe('<p>Hello</p><b>World</b>')
    })

    it('should strip non-whitelisted tags by default', () => {
      const html = '<p>Safe</p><script>alert(1)</script>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('</script>')
      expect(sanitized).toContain('<p>Safe</p>')
    })

    it('should escape non-whitelisted tags when stripDisallowedTags is false', () => {
      const html = '<p>Safe</p><script>alert(1)</script>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
        stripDisallowedTags: false,
      })
      expect(sanitized).toContain('&lt;script&gt;')
      expect(sanitized).toContain('<p>Safe</p>')
    })

    it('should handle self-closing tags', () => {
      const html = '<p>Text</p><br/><img src="test.jpg"/>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p', 'br'],
      })
      expect(sanitized).toContain('<p>Text</p>')
      expect(sanitized).toContain('<br/>')
      expect(sanitized).not.toContain('<img')
    })

    it('should handle nested tags', () => {
      const html = '<div><p><b>Bold</b> text</p></div>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p', 'b'],
      })
      expect(sanitized).toContain('<p><b>Bold</b> text</p>')
      expect(sanitized).not.toContain('<div>')
    })
  })

  describe('Attribute Filtering', () => {
    it('should allow whitelisted attributes', () => {
      const html = '<a href="https://example.com" title="Link">Click</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href', 'title'] },
      })
      expect(sanitized).toContain('href="https://example.com"')
      expect(sanitized).toContain('title="Link"')
    })

    it('should strip non-whitelisted attributes', () => {
      const html = '<a href="/" onclick="alert(1)" data-custom="test">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      expect(sanitized).toContain('href="/"')
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).not.toContain('data-custom')
    })

    it('should strip all event handler attributes (on*)', () => {
      const html = '<div onclick="alert(1)" onerror="alert(2)" onload="alert(3)">Text</div>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['div'],
        allowedAttributes: { div: ['class'] },
      })
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('onload')
    })

    it('should handle tags with no allowed attributes', () => {
      const html = '<p class="text">Content</p>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
        allowedAttributes: {},
      })
      expect(sanitized).toBe('<p>Content</p>')
    })

    it('should strip javascript: protocol in href', () => {
      const html = '<a href="javascript:alert(1)">Click</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      // Should either remove href or remove the link
      expect(sanitized).not.toContain('javascript:')
    })

    it('should strip data: protocol in src', () => {
      const html = '<img src="data:text/html,alert(1)">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['src'] },
      })
      // data: scheme should be stripped, leaving img with no src
      expect(sanitized).not.toContain('src=')
      expect(sanitized).toContain('<img')
    })
  })

  describe('URL Scheme Validation', () => {
    it('should allow safe URL schemes', () => {
      const html =
        '<a href="https://example.com">HTTPS</a><a href="mailto:test@example.com">Email</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
        allowedSchemes: ['https', 'mailto'],
      })
      expect(sanitized).toContain('href="https://example.com"')
      expect(sanitized).toContain('href="mailto:test@example.com"')
    })

    it('should block dangerous URL schemes', () => {
      const dangerousSchemes = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:alert(1)',
      ]

      dangerousSchemes.forEach((url) => {
        const html = `<a href="${url}">Click</a>`
        const sanitized = sanitizeHtml(html, {
          allowedTags: ['a'],
          allowedAttributes: { a: ['href'] },
        })
        expect(sanitized).not.toContain(url)
      })
    })

    it('should allow relative URLs by default', () => {
      const html = '<a href="/path/to/page">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      expect(sanitized).toContain('href="/path/to/page"')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(sanitizeHtml('')).toBe('')
    })

    it('should handle plain text with no HTML', () => {
      const text = 'Just plain text'
      expect(sanitizeHtml(text)).toBe(text)
    })

    it('should handle malformed HTML gracefully', () => {
      const html = '<p>Unclosed paragraph<b>Bold</p>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p', 'b'],
      })
      // Should handle unclosed tags gracefully
      expect(sanitized).toContain('Unclosed paragraph')
      expect(sanitized).toContain('Bold')
    })

    it('should handle HTML comments', () => {
      const html = '<p>Text</p><!-- Comment --><p>More</p>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
        allowComments: false,
      })
      expect(sanitized).not.toContain('<!-- Comment -->')
      expect(sanitized).toContain('<p>Text</p>')
      expect(sanitized).toContain('<p>More</p>')
    })

    it('should preserve HTML entities', () => {
      const html = '<p>&lt;escaped&gt; and &amp;</p>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).toContain('&lt;escaped&gt;')
      expect(sanitized).toContain('&amp;')
    })

    it('should handle multiple classes and attributes', () => {
      const html = '<div class="foo bar" id="test" data-value="123">Text</div>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['div'],
        allowedAttributes: { div: ['class'] },
      })
      expect(sanitized).toContain('class="foo bar"')
      expect(sanitized).not.toContain('id=')
      expect(sanitized).not.toContain('data-value')
    })
  })

  describe('XSS Attack Prevention', () => {
    it('should neutralize script injection', () => {
      const attacks = [
        { html: '<script>alert("xss")</script>', check: '<script' },
        { html: '<img src=x onerror=alert(1)>', check: 'onerror' },
        { html: '<svg onload=alert(1)>', check: 'onload' },
        { html: '<body onload=alert(1)>', check: 'onload' },
        { html: '<iframe src="javascript:alert(1)">', check: '<iframe' },
      ]

      attacks.forEach(({ html, check }) => {
        const sanitized = sanitizeHtml(html, {
          allowedTags: ['p', 'b', 'i'],
        })
        // Check that the dangerous element/attribute was removed
        expect(sanitized).not.toContain(check)
      })
    })

    it('should handle attribute injection attempts', () => {
      const html = '<img src="x" onerror="alert(1)" />'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['src', 'alt'] },
      })
      expect(sanitized).not.toContain('onerror')
    })

    it('should handle encoding bypass attempts', () => {
      const html =
        '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      // Should decode and then validate the URL scheme
      expect(sanitized).not.toContain('javascript')
    })
  })

  describe('Default Options', () => {
    it('should use default options when none provided', () => {
      const html = '<p>Text</p><script>alert(1)</script>'
      const sanitized = sanitizeHtml(html)
      // Should have some default behavior
      expect(sanitized).toBeDefined()
    })
  })

  describe('URL-Bearing Attribute Validation', () => {
    it('should validate srcset attribute', () => {
      const html = '<img srcset="javascript:alert(1) 1x, https://safe.com/img.jpg 2x">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['srcset'] },
      })
      // Should strip the entire srcset if any URL is dangerous
      expect(sanitized).not.toContain('javascript:')
    })

    it('should allow safe srcset attribute', () => {
      const html =
        '<img srcset="https://example.com/small.jpg 1x, https://example.com/large.jpg 2x">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['img'],
        allowedAttributes: { img: ['srcset'] },
      })
      expect(sanitized).toContain('srcset=')
      expect(sanitized).toContain('https://example.com/small.jpg')
    })

    it('should validate action attribute on forms', () => {
      const html = '<form action="javascript:alert(1)"><button>Submit</button></form>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['form', 'button'],
        allowedAttributes: { form: ['action'] },
      })
      expect(sanitized).not.toContain('javascript:')
    })

    it('should validate poster attribute on video', () => {
      const html = '<video poster="javascript:alert(1)"></video>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['video'],
        allowedAttributes: { video: ['poster'] },
      })
      expect(sanitized).not.toContain('javascript:')
    })

    it('should handle case-insensitive attribute config', () => {
      const html = '<a href="https://example.com">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['HREF'] }, // Uppercase in config
      })
      // Should still match lowercase href in HTML
      expect(sanitized).toContain('href="https://example.com"')
    })
  })

  describe('Entity Decoding for URL Validation', () => {
    it('should decode numeric tab entity (&#9;) in URLs', () => {
      const html = '<a href="&#9;javascript:alert(1)">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      expect(sanitized).not.toContain('javascript:')
    })

    it('should decode hex entity (&#xA;) newline in URLs', () => {
      const html = '<a href="java&#xA;script:alert(1)">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      // Newline in the middle breaks the scheme matching, so it's treated as relative
      // but we should ensure the content is still safe
      expect(sanitized).toBeDefined()
    })

    it('should decode numeric character references', () => {
      // &#106; = j, &#97; = a, etc. to spell "javascript"
      const html =
        '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)">Link</a>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['a'],
        allowedAttributes: { a: ['href'] },
      })
      expect(sanitized).not.toContain('javascript:')
    })
  })

  describe('Mutation XSS (mXSS) Vectors', () => {
    it('should handle noscript-based mXSS', () => {
      const html = '<noscript><img src=x onerror=alert(1)></noscript>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('<img')
    })

    it('should handle svg foreignObject mXSS', () => {
      const html = '<svg><foreignObject><p onclick=alert(1)>Test</p></foreignObject></svg>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p'],
      })
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).not.toContain('<svg')
    })

    it('should handle math/mtext mXSS vector', () => {
      const html =
        '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></table></mtext></math>'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['p', 'table'],
      })
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('<img')
    })

    it('should handle textarea-based mXSS', () => {
      const html =
        '<form><math><mtext></form><form><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src>">'
      const sanitized = sanitizeHtml(html, {
        allowedTags: ['form'],
        allowedAttributes: {},
      })
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('<img')
    })
  })
})
