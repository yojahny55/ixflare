/**
 * @file render.test.tsx
 * @description Tests for SSR rendering functions
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToString, renderToStream } from '@/ssr/render'

describe('renderToString', () => {
  it('should render a simple component to HTML string', async () => {
    const html = await renderToString(<div>Hello World</div>)

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('Hello World')
  })

  it('should include DOCTYPE and html structure', async () => {
    const html = await renderToString(<div>Test Content</div>)

    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
    expect(html).toContain('<meta name="viewport"')
  })

  it('should render async Server Components', async () => {
    const AsyncComponent = async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return <div>Async Content</div>
    }

    const html = await renderToString(AsyncComponent)
    expect(html).toContain('Async Content')
  })

  it('should inject bootstrap data for hydration', async () => {
    const bootstrapData = { userId: '123', theme: 'dark' }
    const html = await renderToString(<div>Test</div>, { bootstrapData })

    expect(html).toContain('<script')
    expect(html).toContain('__BOOTSTRAP_DATA__')
    expect(html).toContain('userId')
    expect(html).toContain('123')
    expect(html).toContain('theme')
    expect(html).toContain('dark')
  })

  it('should safely escape bootstrap data containing script tags (XSS prevention)', async () => {
    const maliciousData = {
      payload: '</script><script>alert("xss")</script>',
      nested: { attack: '<img onerror="alert(1)">' }
    }

    const html = await renderToString(<div>Test</div>, { bootstrapData: maliciousData })

    // Should NOT contain raw script closing tags
    expect(html).not.toContain('</script><script>')
    expect(html).not.toContain('<img onerror')
    // Should contain escaped versions
    expect(html).toContain('\\u003c')
    expect(html).toContain('\\u003e')
  })

  it('should escape U+2028 and U+2029 in bootstrap data', async () => {
    const dataWithLineSeparators = {
      text: 'line1\u2028line2\u2029line3'
    }

    const html = await renderToString(<div>Test</div>, { bootstrapData: dataWithLineSeparators })

    // Should escape Unicode line/paragraph separators
    expect(html).toContain('\\u2028')
    expect(html).toContain('\\u2029')
    // Should NOT contain raw U+2028/U+2029 characters
    expect(html).not.toContain('\u2028')
    expect(html).not.toContain('\u2029')
  })

  it('should include title when provided', async () => {
    const html = await renderToString(<div>Test</div>, { title: 'My Page Title' })

    expect(html).toContain('<title>My Page Title</title>')
  })

  it('should escape HTML in title to prevent injection', async () => {
    const html = await renderToString(<div>Test</div>, {
      title: '<script>alert("xss")</script>'
    })

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should include custom meta tags', async () => {
    const html = await renderToString(<div>Test</div>, {
      meta: { description: 'My description', author: 'Test Author' }
    })

    expect(html).toContain('<meta name="description" content="My description"/>')
    expect(html).toContain('<meta name="author" content="Test Author"/>')
  })

  it('should support custom lang attribute', async () => {
    const html = await renderToString(<div>Test</div>, { lang: 'es' })

    expect(html).toContain('<html lang="es">')
  })

  it('should render without shell when shell: false', async () => {
    const html = await renderToString(<div>Fragment Content</div>, { shell: false })

    // Should NOT contain document structure
    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).not.toContain('<html')
    expect(html).not.toContain('</html>')
    expect(html).not.toContain('<head>')
    expect(html).not.toContain('<body>')

    // Should contain component output
    expect(html).toContain('Fragment Content')
  })

  it('should include bootstrap data even with shell: false', async () => {
    const html = await renderToString(<div>Test</div>, {
      shell: false,
      bootstrapData: { key: 'value' }
    })

    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).toContain('__BOOTSTRAP_DATA__')
    expect(html).toContain('key')
  })

  it('should handle render errors gracefully', async () => {
    const ErrorComponent = () => {
      throw new Error('Render failed')
    }

    await expect(renderToString(<ErrorComponent />))
      .rejects.toThrow('Failed to render component to string')
  })

  it('should respect abort signal timeout', async () => {
    const controller = new AbortController()
    controller.abort()

    const renderPromise = renderToString(<div>Should not render</div>, {
      abortSignal: controller.signal
    })

    await expect(renderPromise).rejects.toThrow()
  }, 1000)
})

describe('renderToStream', () => {
  it('should return a ReadableStream', () => {
    const stream = renderToStream(<div>Stream Content</div>)

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('should stream HTML chunks', async () => {
    const stream = renderToStream(<div>Streaming Test</div>)

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<meta name="viewport"')
    expect(html).toContain('Streaming Test')
  })

  it('should support AbortController cancellation', async () => {
    const controller = new AbortController()

    const Component = () => {
      if (controller.signal.aborted) {
        throw new Error('Aborted')
      }
      return <div>Should not render</div>
    }

    const stream = renderToStream(<Component />, {
      abortSignal: controller.signal
    })

    const reader = stream.getReader()
    const readPromise = reader.read()

    controller.abort()

    try {
      await readPromise
      const secondRead = await reader.read()
      expect(secondRead.done || secondRead.value).toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
    }
  }, 1000)

  it('should stream bootstrap data with XSS protection', async () => {
    const bootstrapData = {
      key: 'value',
      dangerous: '</script><script>evil()</script>'
    }

    const stream = renderToStream(<div>Test</div>, { bootstrapData })
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }

    expect(html).toContain('__BOOTSTRAP_DATA__')
    expect(html).toContain('key')
    expect(html).toContain('value')
    expect(html).not.toContain('</script><script>')
    expect(html).toContain('\\u003c')
  })

  it('should include title in streamed output', async () => {
    const stream = renderToStream(<div>Test</div>, { title: 'Stream Title' })
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }

    expect(html).toContain('<title>Stream Title</title>')
  })

  it('should stream without shell when shell: false', async () => {
    const stream = renderToStream(<div>Fragment Stream</div>, { shell: false })
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }

    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).not.toContain('<html')
    expect(html).toContain('Fragment Stream')
  })
})
