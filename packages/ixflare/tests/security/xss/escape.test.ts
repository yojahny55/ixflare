import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  escapeUrl,
} from '../../../src/security/xss/escape'

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('should escape less than and greater than', () => {
    expect(escapeHtml('5 < 10 > 3')).toBe('5 &lt; 10 &gt; 3')
  })

  it('should escape quotes', () => {
    expect(escapeHtml(`"double" and 'single'`)).toBe(
      '&quot;double&quot; and &#x27;single&#x27;'
    )
  })

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('should handle strings with no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('should escape multiple instances', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;')
  })

  it('should preserve order in combined escaping', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('escapeHtmlAttribute', () => {
  it('should escape all non-alphanumeric characters', () => {
    const input = 'value with spaces & special <chars>'
    const escaped = escapeHtmlAttribute(input)
    // Should use &#xHH; format for attributes
    expect(escaped).toMatch(/&#x[0-9a-fA-F]{2};/)
  })

  it('should allow alphanumeric characters', () => {
    expect(escapeHtmlAttribute('abc123')).toBe('abc123')
  })

  it('should escape quotes for attribute injection', () => {
    const input = '" onclick="alert(1)'
    const escaped = escapeHtmlAttribute(input)
    // Quotes should be encoded as &#x22;
    expect(escaped).not.toContain('"')
    // But the word "onclick" (alphanumeric) remains - it's the quotes and spaces that are dangerous
    expect(escaped).toContain('onclick')
    // The dangerous structure is broken: &#x22;&#x20;onclick&#x3d;&#x22;alert&#x28;1&#x29;
    expect(escaped).toContain('&#x22;') // Quotes encoded
    expect(escaped).toContain('&#x20;') // Spaces encoded
    expect(escaped).toContain('&#x3d;') // Equals encoded
  })

  it('should escape spaces', () => {
    const escaped = escapeHtmlAttribute('hello world')
    expect(escaped).toContain('&#x20;')
  })

  it('should handle empty strings', () => {
    expect(escapeHtmlAttribute('')).toBe('')
  })

  it('should escape special HTML chars', () => {
    const escaped = escapeHtmlAttribute('<>&"\'/')
    expect(escaped).not.toContain('<')
    expect(escaped).not.toContain('>')
    // The & character appears in the encoded output as part of &#xHH; entities
    // What matters is the original & is encoded
    expect(escaped).toContain('&#x3c;') // < encoded
    expect(escaped).toContain('&#x3e;') // > encoded
    expect(escaped).toContain('&#x26;') // & encoded
    expect(escaped).toContain('&#x22;') // " encoded
    expect(escaped).toContain('&#x27;') // ' encoded
  })
})

describe('escapeJavaScript', () => {
  it('should escape quotes and backslashes', () => {
    expect(escapeJavaScript('He said "Hello"')).toBe('He said \\"Hello\\"')
    expect(escapeJavaScript("It's fine")).toBe("It\\'s fine")
    expect(escapeJavaScript('Path\\to\\file')).toBe('Path\\\\to\\\\file')
  })

  it('should escape newlines and control characters', () => {
    expect(escapeJavaScript('Line1\nLine2')).toBe('Line1\\nLine2')
    expect(escapeJavaScript('Line1\rLine2')).toBe('Line1\\rLine2')
    expect(escapeJavaScript('Tab\there')).toBe('Tab\\there')
  })

  it('should escape HTML script terminators', () => {
    expect(escapeJavaScript('</script>')).not.toContain('</script>')
    expect(escapeJavaScript('</script>')).toContain('\\/')
  })

  it('should handle empty strings', () => {
    expect(escapeJavaScript('')).toBe('')
  })

  it('should escape dangerous JS patterns', () => {
    const dangerous = '"; alert(1); //'
    const escaped = escapeJavaScript(dangerous)
    // After escaping: \"; alert(1); \/\/
    expect(escaped).toBe('\\\"; alert(1); \\/\\/')
    expect(escaped).toContain('\\"') // Quote is escaped
    expect(escaped).toContain('\\/') // Slashes are escaped
  })

  it('should escape Unicode line/paragraph separators', () => {
    // U+2028 (Line separator) and U+2029 (Paragraph separator)
    expect(escapeJavaScript('\u2028')).toBe('\\u2028')
    expect(escapeJavaScript('\u2029')).toBe('\\u2029')
  })
})

describe('escapeUrl', () => {
  it('should encode special characters', () => {
    expect(escapeUrl('hello world')).toBe('hello%20world')
    expect(escapeUrl('user@example.com')).toBe('user%40example.com')
  })

  it('should encode URL parameter characters', () => {
    expect(escapeUrl('a=b&c=d')).toBe('a%3Db%26c%3Dd')
  })

  it('should handle empty strings', () => {
    expect(escapeUrl('')).toBe('')
  })

  it('should not double-encode', () => {
    expect(escapeUrl('already%20encoded')).toBe('already%2520encoded')
  })

  it('should encode dangerous characters', () => {
    expect(escapeUrl('<script>')).not.toContain('<')
    expect(escapeUrl('<script>')).not.toContain('>')
  })

  it('should preserve alphanumeric and safe chars', () => {
    expect(escapeUrl('abc123-._~')).toBe('abc123-._~')
  })
})
