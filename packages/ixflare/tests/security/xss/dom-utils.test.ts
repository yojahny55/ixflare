/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setTextContent, setAttribute } from '../../../src/security/xss/dom-utils'

describe('DOM-Safe Utilities', () => {
  let element: HTMLElement

  beforeEach(() => {
    element = document.createElement('div')
  })

  describe('setTextContent', () => {
    it('should safely set text content', () => {
      const userInput = '<script>alert(1)</script>'
      setTextContent(element, userInput)

      expect(element.textContent).toBe(userInput)
      expect(element.innerHTML).not.toContain('<script')
    })

    it('should handle special characters', () => {
      const text = '< > & " \''
      setTextContent(element, text)

      expect(element.textContent).toBe(text)
    })

    it('should handle empty strings', () => {
      setTextContent(element, '')
      expect(element.textContent).toBe('')
    })

    it('should overwrite existing content', () => {
      element.textContent = 'Old content'
      setTextContent(element, 'New content')

      expect(element.textContent).toBe('New content')
    })
  })

  describe('setAttribute', () => {
    it('should safely set allowed attributes', () => {
      setAttribute(element, 'data-value', 'test')
      expect(element.getAttribute('data-value')).toBe('test')
    })

    it('should escape attribute values', () => {
      const malicious = '" onclick="alert(1)'
      setAttribute(element, 'data-test', malicious)

      // Attribute value should be set safely
      expect(element.getAttribute('data-test')).toBe(malicious)
      // But clicking shouldn't execute code
      expect(element.getAttribute('onclick')).toBeNull()
    })

    it('should block event handler attributes', () => {
      expect(() => {
        setAttribute(element, 'onclick', 'alert(1)')
      }).toThrow()
    })

    it('should block all on* attributes', () => {
      const eventHandlers = [
        'onclick',
        'onerror',
        'onload',
        'onmouseover',
        'onfocus',
      ]

      eventHandlers.forEach((handler) => {
        expect(() => {
          setAttribute(element, handler, 'alert(1)')
        }).toThrow()
      })
    })

    it('should allow safe attributes', () => {
      const safeAttrs = [
        ['class', 'btn btn-primary'],
        ['id', 'submit-button'],
        ['data-id', '123'],
        ['title', 'Click me'],
        ['aria-label', 'Submit form'],
      ]

      safeAttrs.forEach(([name, value]) => {
        expect(() => {
          setAttribute(element, name, value)
        }).not.toThrow()
        expect(element.getAttribute(name)).toBe(value)
      })
    })

    it('should handle empty attribute values', () => {
      setAttribute(element, 'data-empty', '')
      expect(element.getAttribute('data-empty')).toBe('')
    })
  })
})
