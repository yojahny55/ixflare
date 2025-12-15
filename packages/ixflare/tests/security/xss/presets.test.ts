import { describe, it, expect } from 'vitest'
import { presets } from '../../../src/security/xss/presets'
import { sanitizeHtml } from '../../../src/security/xss/sanitizer'

describe('Sanitization Presets', () => {
  describe('presets.text', () => {
    it('should strip all HTML tags', () => {
      const html = '<p>Hello <b>World</b></p>'
      const sanitized = sanitizeHtml(html, presets.text)
      expect(sanitized).toBe('Hello World')
    })

    it('should preserve plain text', () => {
      const text = 'Just plain text'
      const sanitized = sanitizeHtml(text, presets.text)
      expect(sanitized).toBe(text)
    })

    it('should strip dangerous content', () => {
      const html = '<script>alert(1)</script>Text<img onerror="alert(1)">'
      const sanitized = sanitizeHtml(html, presets.text)
      expect(sanitized).not.toContain('<')
      expect(sanitized).not.toContain('>')
      expect(sanitized).toContain('Text')
    })
  })

  describe('presets.basic', () => {
    it('should allow only basic formatting tags', () => {
      const html = '<p>Text with <b>bold</b> and <i>italic</i></p>'
      const sanitized = sanitizeHtml(html, presets.basic)
      // Basic preset allows b, i, br, a
      expect(sanitized).toContain('<b>bold</b>')
      expect(sanitized).toContain('<i>italic</i>')
    })

    it('should allow links with href', () => {
      const html = '<a href="https://example.com">Link</a>'
      const sanitized = sanitizeHtml(html, presets.basic)
      expect(sanitized).toContain('<a href="https://example.com">Link</a>')
    })

    it('should strip disallowed tags', () => {
      const html = '<p>Text</p><script>alert(1)</script><div>Block</div>'
      const sanitized = sanitizeHtml(html, presets.basic)
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('<div')
      expect(sanitized).not.toContain('<p')
    })

    it('should allow br tags', () => {
      const html = 'Line 1<br/>Line 2'
      const sanitized = sanitizeHtml(html, presets.basic)
      expect(sanitized).toContain('<br/>')
    })

    it('should strip dangerous attributes', () => {
      const html = '<a href="/" onclick="alert(1)">Link</a>'
      const sanitized = sanitizeHtml(html, presets.basic)
      expect(sanitized).not.toContain('onclick')
      expect(sanitized).toContain('href="/"')
    })
  })

  describe('presets.rich', () => {
    it('should allow rich content tags', () => {
      const html = '<p>Paragraph</p><h1>Heading</h1><ul><li>Item</li></ul>'
      const sanitized = sanitizeHtml(html, presets.rich)
      expect(sanitized).toContain('<p>Paragraph</p>')
      expect(sanitized).toContain('<h1>Heading</h1>')
      expect(sanitized).toContain('<ul><li>Item</li></ul>')
    })

    it('should allow images with src and alt', () => {
      const html = '<img src="https://example.com/img.jpg" alt="Image">'
      const sanitized = sanitizeHtml(html, presets.rich)
      expect(sanitized).toContain('<img')
      expect(sanitized).toContain('src="https://example.com/img.jpg"')
      expect(sanitized).toContain('alt="Image"')
    })

    it('should allow code blocks', () => {
      const html = '<pre><code>const x = 1;</code></pre>'
      const sanitized = sanitizeHtml(html, presets.rich)
      expect(sanitized).toContain('<pre><code>const x = 1;</code></pre>')
    })

    it('should allow blockquotes', () => {
      const html = '<blockquote>Quote text</blockquote>'
      const sanitized = sanitizeHtml(html, presets.rich)
      expect(sanitized).toContain('<blockquote>Quote text</blockquote>')
    })

    it('should strip scripts and dangerous tags', () => {
      const html = '<p>Safe</p><script>alert(1)</script><iframe src="evil"></iframe>'
      const sanitized = sanitizeHtml(html, presets.rich)
      expect(sanitized).not.toContain('<script')
      expect(sanitized).not.toContain('<iframe')
      expect(sanitized).toContain('<p>Safe</p>')
    })

    it('should strip event handlers', () => {
      const html = '<img src="test.jpg" onerror="alert(1)" alt="Test">'
      const sanitized = sanitizeHtml(html, presets.rich)
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).toContain('src="test.jpg"')
      expect(sanitized).toContain('alt="Test"')
    })

    it('should block dangerous URL schemes in images', () => {
      const html = '<img src="javascript:alert(1)">'
      const sanitized = sanitizeHtml(html, presets.rich)
      // Should strip the src attribute with dangerous scheme
      expect(sanitized).not.toContain('javascript:')
    })
  })

  describe('Preset Configuration Structure', () => {
    it('should have required preset properties', () => {
      expect(presets.text).toHaveProperty('allowedTags')
      expect(presets.basic).toHaveProperty('allowedTags')
      expect(presets.rich).toHaveProperty('allowedTags')
    })

    it('should allow custom overrides on presets', () => {
      const html = '<p>Text</p><custom>Tag</custom>'
      const customPreset = {
        ...presets.basic,
        allowedTags: [...(presets.basic.allowedTags || []), 'custom'],
      }
      const sanitized = sanitizeHtml(html, customPreset)
      expect(sanitized).toContain('<custom>Tag</custom>')
    })
  })
})
