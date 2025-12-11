/**
 * @module ssr/csr-shell.test
 * @description Tests for CSR shell generation
 */

import { describe, it, expect } from 'vitest'
import { generateCSRShell, createCSRShellResponse } from '@/ssr/csr-shell'

describe('CSR Shell', () => {
  describe('generateCSRShell', () => {
    it('should generate minimal CSR shell with required fields', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
      })

      expect(shell).toContain('<!DOCTYPE html>')
      expect(shell).toContain('<html lang="en">')
      expect(shell).toContain('<meta charset="utf-8"/>')
      expect(shell).toContain('<meta name="viewport"')
      expect(shell).toContain('<div id="root"></div>')
      expect(shell).toContain('<script type="module" src="/client.js"></script>')
      expect(shell).toContain('</body>')
      expect(shell).toContain('</html>')
    })

    it('should include custom title', () => {
      const shell = generateCSRShell({
        title: 'Dashboard App',
        scriptSrc: '/client.js',
      })

      expect(shell).toContain('<title>Dashboard App</title>')
    })

    it('should use custom lang attribute', () => {
      const shell = generateCSRShell({
        lang: 'es',
        scriptSrc: '/client.js',
      })

      expect(shell).toContain('<html lang="es">')
    })

    it('should include custom meta tags', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        meta: {
          description: 'A test app',
          keywords: 'test, csr',
        },
      })

      expect(shell).toContain('<meta name="description" content="A test app"/>')
      expect(shell).toContain('<meta name="keywords" content="test, csr"/>')
    })

    it('should include custom html attributes', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        htmlAttributes: {
          class: 'dark',
          dir: 'rtl',
        },
      })

      expect(shell).toContain('<html lang="en" class="dark" dir="rtl">')
    })

    it('should include custom body attributes', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        bodyAttributes: {
          class: 'bg-white',
          'data-theme': 'light',
        },
      })

      expect(shell).toContain('<body class="bg-white" data-theme="light">')
    })

    it('should use custom mount ID', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        mountId: 'app',
      })

      expect(shell).toContain('<div id="app"></div>')
      expect(shell).not.toContain('<div id="root"></div>')
    })

    it('should escape HTML in title', () => {
      const shell = generateCSRShell({
        title: '<script>alert("xss")</script>',
        scriptSrc: '/client.js',
      })

      expect(shell).toContain('<title>&lt;script&gt;alert')
      expect(shell).not.toContain('<script>alert')
    })

    it('should escape HTML in meta content', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        meta: {
          description: '<script>xss</script>',
        },
      })

      expect(shell).toContain('content="&lt;script&gt;xss')
      expect(shell).not.toContain('content="<script>')
    })

    it('should escape HTML in attributes', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        htmlAttributes: {
          class: '"><script>alert(1)</script>',
        },
      })

      expect(shell).toContain('class="&quot;&gt;&lt;script&gt;')
      expect(shell).not.toContain('class=""><script>')
    })

    it('should escape scriptSrc to prevent injection', () => {
      const shell = generateCSRShell({
        scriptSrc: '"></script><script>alert(1)</script><script src="',
      })

      expect(shell).toContain('src="&quot;&gt;&lt;/script&gt;')
      expect(shell).not.toContain('src=""></script><script>alert')
    })

    it('should handle empty meta object', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
        meta: {},
      })

      expect(shell).toContain('<div id="root"></div>')
      expect(shell).not.toContain('<meta name=""')
    })

    it('should handle all options combined', () => {
      const shell = generateCSRShell({
        title: 'Full Featured App',
        lang: 'fr',
        scriptSrc: '/dist/client.bundle.js',
        meta: {
          description: 'Complete example',
          author: 'Test',
        },
        htmlAttributes: {
          class: 'theme-dark',
        },
        bodyAttributes: {
          class: 'font-sans',
        },
        mountId: 'app-root',
      })

      expect(shell).toContain('<title>Full Featured App</title>')
      expect(shell).toContain('<html lang="fr" class="theme-dark">')
      expect(shell).toContain('<body class="font-sans">')
      expect(shell).toContain('<div id="app-root"></div>')
      expect(shell).toContain('<script type="module" src="/dist/client.bundle.js"></script>')
      expect(shell).toContain('<meta name="description" content="Complete example"/>')
      expect(shell).toContain('<meta name="author" content="Test"/>')
    })

    it('should not include empty attributes when none provided', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
      })

      expect(shell).toContain('<html lang="en">')
      expect(shell).not.toContain('class=""')
      expect(shell).not.toContain('dir=""')
    })
  })

  describe('createCSRShellResponse', () => {
    it('should return Response with HTML content', async () => {
      const response = createCSRShellResponse({
        scriptSrc: '/client.js',
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')

      const html = await response.text()
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain('<script type="module" src="/client.js"></script>')
    })

    it('should include all options in response', async () => {
      const response = createCSRShellResponse({
        title: 'CSR App',
        scriptSrc: '/app.js',
        meta: { description: 'Test' },
      })

      const html = await response.text()
      expect(html).toContain('<title>CSR App</title>')
      expect(html).toContain('src="/app.js"')
      expect(html).toContain('name="description"')
    })

    it('should be a valid Response object', () => {
      const response = createCSRShellResponse({
        scriptSrc: '/client.js',
      })

      expect(response).toBeInstanceOf(Response)
      expect(response.body).toBeDefined()
    })
  })

  describe('CSR Shell Structure', () => {
    it('should have proper HTML structure with required elements', () => {
      const shell = generateCSRShell({
        scriptSrc: '/client.js',
      })

      // Check document structure
      expect(shell).toMatch(/<!DOCTYPE html>/)
      expect(shell).toMatch(/<html lang="\w+">/)
      expect(shell).toMatch(/<head>/)
      expect(shell).toMatch(/<\/head>/)
      expect(shell).toMatch(/<body.*>/)
      expect(shell).toMatch(/<\/body>/)
      expect(shell).toMatch(/<\/html>/)

      // Check required meta tags
      expect(shell).toMatch(/<meta charset="utf-8"\/>/)
      expect(shell).toMatch(/<meta name="viewport"/)

      // Check mount point
      expect(shell).toMatch(/<div id="\w+"><\/div>/)

      // Check script tag
      expect(shell).toMatch(/<script type="module" src="[^"]+"><\/script>/)
    })

    it('should place elements in correct order', () => {
      const shell = generateCSRShell({
        title: 'Order Test',
        scriptSrc: '/client.js',
        meta: { description: 'Test' },
      })

      // Find positions of key elements
      const doctypePos = shell.indexOf('<!DOCTYPE html>')
      const htmlPos = shell.indexOf('<html')
      const headPos = shell.indexOf('<head>')
      const charsetPos = shell.indexOf('<meta charset')
      const viewportPos = shell.indexOf('<meta name="viewport"')
      const titlePos = shell.indexOf('<title>')
      const metaDescPos = shell.indexOf('<meta name="description"')
      const headClosePos = shell.indexOf('</head>')
      const bodyPos = shell.indexOf('<body')
      const divPos = shell.indexOf('<div id=')
      const scriptPos = shell.indexOf('<script')
      const bodyClosePos = shell.indexOf('</body>')
      const htmlClosePos = shell.indexOf('</html>')

      // Assert correct order
      expect(doctypePos).toBeLessThan(htmlPos)
      expect(htmlPos).toBeLessThan(headPos)
      expect(headPos).toBeLessThan(charsetPos)
      expect(charsetPos).toBeLessThan(viewportPos)
      expect(viewportPos).toBeLessThan(titlePos)
      expect(titlePos).toBeLessThan(metaDescPos)
      expect(metaDescPos).toBeLessThan(headClosePos)
      expect(headClosePos).toBeLessThan(bodyPos)
      expect(bodyPos).toBeLessThan(divPos)
      expect(divPos).toBeLessThan(scriptPos)
      expect(scriptPos).toBeLessThan(bodyClosePos)
      expect(bodyClosePos).toBeLessThan(htmlClosePos)
    })
  })
})
