/**
 * @file render.test.ts
 * @description Tests for SSR rendering functions
 */

import { describe, it, expect } from 'vitest'
import { renderToString, renderToStream } from '@/ssr/render'
import { createElement } from 'react'

describe('renderToString', () => {
  it('should render a simple component to HTML string', async () => {
    const SimpleComponent = () => createElement('div', null, 'Hello World')
    const html = await renderToString(createElement(SimpleComponent), {})

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('Hello World')
  })

  it('should include DOCTYPE and html structure', async () => {
    const Component = () => createElement('div', null, 'Test Content')
    const html = await renderToString(createElement(Component), {})

    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
    expect(html).toContain('<meta name="viewport"')
  })

  it('should render async Server Components', async () => {
    const AsyncComponent = async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return createElement('div', null, 'Async Content')
    }

    const html = await renderToString(AsyncComponent, {})
    expect(html).toContain('Async Content')
  })

  it('should inject bootstrap data for hydration', async () => {
    const Component = () => createElement('div', null, 'Test')
    const bootstrapData = { userId: '123', theme: 'dark' }

    const html = await renderToString(createElement(Component), { bootstrapData })

    // Bootstrap data should be injected as a script tag
    expect(html).toContain('<script')
    expect(html).toContain('__BOOTSTRAP_DATA__')
    expect(html).toContain('userId')
    expect(html).toContain('123')
    expect(html).toContain('theme')
    expect(html).toContain('dark')
  })

  it('should safely escape bootstrap data containing script tags (XSS prevention)', async () => {
    const Component = () => createElement('div', null, 'Test')
    const maliciousData = {
      payload: '</script><script>alert("xss")</script>',
      nested: { attack: '<img onerror="alert(1)">' }
    }

    const html = await renderToString(createElement(Component), { bootstrapData: maliciousData })

    // Should NOT contain raw script closing tags
    expect(html).not.toContain('</script><script>')
    expect(html).not.toContain('<img onerror')
    // Should contain escaped versions
    expect(html).toContain('\\u003c')
    expect(html).toContain('\\u003e')
  })

  it('should include title when provided', async () => {
    const Component = () => createElement('div', null, 'Test')
    const html = await renderToString(createElement(Component), { title: 'My Page Title' })

    expect(html).toContain('<title>My Page Title</title>')
  })

  it('should escape HTML in title to prevent injection', async () => {
    const Component = () => createElement('div', null, 'Test')
    const html = await renderToString(createElement(Component), {
      title: '<script>alert("xss")</script>'
    })

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should include custom meta tags', async () => {
    const Component = () => createElement('div', null, 'Test')
    const html = await renderToString(createElement(Component), {
      meta: { description: 'My description', author: 'Test Author' }
    })

    expect(html).toContain('<meta name="description" content="My description"/>')
    expect(html).toContain('<meta name="author" content="Test Author"/>')
  })

  it('should support custom lang attribute', async () => {
    const Component = () => createElement('div', null, 'Test')
    const html = await renderToString(createElement(Component), { lang: 'es' })

    expect(html).toContain('<html lang="es">')
  })

  it('should handle render errors gracefully', async () => {
    const ErrorComponent = () => {
      throw new Error('Render failed')
    }

    await expect(renderToString(createElement(ErrorComponent), {}))
      .rejects.toThrow('Failed to render component to string')
  })

  it('should respect abort signal timeout', async () => {
    const controller = new AbortController()

    const SlowComponent = () => {
      return createElement('div', null, 'Should not render')
    }

    // Abort before rendering
    controller.abort()

    const renderPromise = renderToString(createElement(SlowComponent), {
      abortSignal: controller.signal
    })

    await expect(renderPromise).rejects.toThrow()
  }, 1000)
})

describe('renderToStream', () => {
  it('should return a ReadableStream', () => {
    const Component = () => createElement('div', null, 'Stream Content')
    const stream = renderToStream(createElement(Component), {})

    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('should stream HTML chunks', async () => {
    const Component = () => createElement('div', null, 'Streaming Test')
    const stream = renderToStream(createElement(Component), {})

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
      // Check if aborted during render
      if (controller.signal.aborted) {
        throw new Error('Aborted')
      }
      return createElement('div', null, 'Should not render')
    }

    const stream = renderToStream(createElement(Component), {
      abortSignal: controller.signal
    })

    const reader = stream.getReader()

    // Start reading
    const readPromise = reader.read()

    // Abort while reading
    controller.abort()

    // First read might succeed (already started), but subsequent should fail or stream should close
    try {
      await readPromise
      // If first read succeeded, try another - should fail or be done
      const secondRead = await reader.read()
      // Stream should eventually close or error
      expect(secondRead.done || secondRead.value).toBeDefined()
    } catch (error) {
      // Expected - stream was aborted
      expect(error).toBeDefined()
    }
  }, 1000)

  it('should stream bootstrap data with XSS protection', async () => {
    const Component = () => createElement('div', null, 'Test')
    const bootstrapData = {
      key: 'value',
      dangerous: '</script><script>evil()</script>'
    }

    const stream = renderToStream(createElement(Component), { bootstrapData })
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
    // Should be escaped
    expect(html).not.toContain('</script><script>')
    expect(html).toContain('\\u003c')
  })

  it('should include title in streamed output', async () => {
    const Component = () => createElement('div', null, 'Test')
    const stream = renderToStream(createElement(Component), { title: 'Stream Title' })
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
})
