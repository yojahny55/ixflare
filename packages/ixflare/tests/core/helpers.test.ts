import { describe, it, expect } from 'vitest'
import { json, html, htmlResponse, redirect, notFound, text, stream, eventStream, type SSEEvent } from '../../src/core/helpers'

describe('Response Helpers', () => {
  describe('json', () => {
    it('should create JSON response with correct content-type', () => {
      const data = { id: 1, name: 'Test' }
      const response = json(data)

      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should serialize data to JSON', async () => {
      const data = { id: 1, name: 'Test' }
      const response = json(data)
      const body = await response.json()

      expect(body).toEqual(data)
    })
  })

  describe('html', () => {
    it('should create HTML response with correct content-type (legacy string)', () => {
      const content = '<h1>Hello</h1>'
      const response = html(content)

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    })

    it('should support legacy string overload with custom init', async () => {
      const content = '<h1>Hello</h1>'
      const response = html(content, { headers: { 'X-Custom': 'value' } })

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(response.headers.get('X-Custom')).toBe('value')
      expect(await response.text()).toBe(content)
    })

    it('should create HTML from tagged template literal', async () => {
      const response = html`<h1>Hello</h1>`

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(await response.text()).toBe('<h1>Hello</h1>')
    })

    it('should escape interpolated values in tagged template', async () => {
      const userInput = '<script>alert("xss")</script>'
      const response = html`<p>${userInput}</p>`

      const body = await response.text()
      expect(body).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>')
      expect(body).not.toContain('<script>')
    })

    it('should escape all HTML special characters', async () => {
      const dangerous = '& < > " \''
      const response = html`<p>${dangerous}</p>`

      const body = await response.text()
      expect(body).toBe('<p>&amp; &lt; &gt; &quot; &#039;</p>')
    })

    it('should handle multiple interpolations', async () => {
      const name = 'Alice'
      const greeting = 'Hello'
      const response = html`<p>${greeting}, ${name}!</p>`

      const body = await response.text()
      expect(body).toBe('<p>Hello, Alice!</p>')
    })

    it('should escape each interpolation separately', async () => {
      const safe = 'Safe'
      const unsafe = '<script>alert("xss")</script>'
      const response = html`<div>${safe} ${unsafe}</div>`

      const body = await response.text()
      expect(body).toBe('<div>Safe &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>')
    })

    it('should handle empty interpolations', async () => {
      const empty = ''
      const response = html`<p>${empty}test</p>`

      const body = await response.text()
      expect(body).toBe('<p>test</p>')
    })

    // Tests for non-string interpolations (HIGH-1 fix)
    it('should handle null interpolation', async () => {
      const value = null
      const response = html`<p>${value}</p>`

      const body = await response.text()
      expect(body).toBe('<p>null</p>')
    })

    it('should handle undefined interpolation', async () => {
      const value = undefined
      const response = html`<p>${value}</p>`

      const body = await response.text()
      expect(body).toBe('<p>undefined</p>')
    })

    it('should handle number interpolation', async () => {
      const count = 42
      const response = html`<p>Count: ${count}</p>`

      const body = await response.text()
      expect(body).toBe('<p>Count: 42</p>')
    })

    it('should handle boolean interpolation', async () => {
      const active = true
      const response = html`<p>Active: ${active}</p>`

      const body = await response.text()
      expect(body).toBe('<p>Active: true</p>')
    })

    it('should handle object interpolation (renders as [object Object])', async () => {
      const obj = { name: 'test' }
      const response = html`<p>${obj}</p>`

      const body = await response.text()
      expect(body).toBe('<p>[object Object]</p>')
    })

    it('should handle array interpolation (joins with commas)', async () => {
      const arr = ['a', 'b', 'c']
      const response = html`<p>${arr}</p>`

      const body = await response.text()
      expect(body).toBe('<p>a,b,c</p>')
    })

    it('should escape HTML in array elements', async () => {
      const arr = ['<script>', 'safe']
      const response = html`<p>${arr}</p>`

      const body = await response.text()
      expect(body).toBe('<p>&lt;script&gt;,safe</p>')
    })
  })

  describe('htmlResponse', () => {
    it('should create HTML with XSS escaping and custom headers', async () => {
      const userInput = '<script>alert("xss")</script>'
      const response = htmlResponse`<h1>Hello ${userInput}</h1>`({
        headers: { 'X-Custom': 'value' },
      })

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(response.headers.get('X-Custom')).toBe('value')
      const body = await response.text()
      expect(body).toBe('<h1>Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</h1>')
    })

    it('should support custom status code', async () => {
      const response = htmlResponse`<h1>Created</h1>`({ status: 201 })

      expect(response.status).toBe(201)
      expect(await response.text()).toBe('<h1>Created</h1>')
    })

    it('should work without init parameter', async () => {
      const name = 'World'
      const response = htmlResponse`<p>Hello ${name}</p>`()

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(await response.text()).toBe('<p>Hello World</p>')
    })

    it('should escape multiple values with custom headers', async () => {
      const user = '<admin>'
      const role = 'super&user'
      const response = htmlResponse`<p>${user}: ${role}</p>`({
        headers: { 'Cache-Control': 'no-cache' },
      })

      const body = await response.text()
      expect(body).toBe('<p>&lt;admin&gt;: super&amp;user</p>')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
    })
  })

  describe('text', () => {
    it('should create plain text response with correct content-type', async () => {
      const response = text('Hello, World!')

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(await response.text()).toBe('Hello, World!')
    })

    it('should support custom headers', () => {
      const response = text('Hello', { headers: { 'X-Custom': 'value' } })

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('X-Custom')).toBe('value')
    })
  })

  describe('stream', () => {
    it('should create streaming response from async generator', async () => {
      const response = stream(async function* () {
        yield 'Hello'
        yield ' '
        yield 'World'
      })

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(response.body).toBeDefined()

      const text = await response.text()
      expect(text).toBe('Hello World')
    })

    it('should handle empty generator', async () => {
      const response = stream(async function* () {
        // Empty generator
      })

      const text = await response.text()
      expect(text).toBe('')
    })

    it('should stream multiple chunks correctly', async () => {
      const response = stream(async function* () {
        yield 'Line 1\n'
        yield 'Line 2\n'
        yield 'Line 3\n'
      })

      const text = await response.text()
      expect(text).toBe('Line 1\nLine 2\nLine 3\n')
    })

    it('should support custom headers', () => {
      const response = stream(
        async function* () {
          yield 'test'
        },
        { headers: { 'X-Custom': 'value' } }
      )

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('X-Custom')).toBe('value')
    })

    it('should handle async operations in generator', async () => {
      const response = stream(async function* () {
        for (const item of ['a', 'b', 'c']) {
          // Simulate async work
          await Promise.resolve()
          yield item
        }
      })

      const text = await response.text()
      expect(text).toBe('abc')
    })

    it('should propagate generator errors', async () => {
      const response = stream(async function* () {
        yield 'Before error\n'
        throw new Error('Generator failed')
      })

      // The error should propagate when reading the stream
      await expect(response.text()).rejects.toThrow('Generator failed')
    })
  })

  describe('eventStream', () => {
    it('should create SSE response with correct headers', () => {
      const response = eventStream(async function* () {
        yield { data: 'test' }
      })

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      // Note: Connection header intentionally omitted - it's a hop-by-hop header
      // handled by HTTP/2+ and often stripped by proxies/CDNs
    })

    it('should format basic SSE message', async () => {
      const response = eventStream(async function* () {
        yield { data: 'Hello' }
      })

      const text = await response.text()
      expect(text).toBe('data: Hello\n\n')
    })

    it('should include event name when provided', async () => {
      const response = eventStream(async function* () {
        yield { event: 'update', data: 'test' }
      })

      const text = await response.text()
      expect(text).toBe('event: update\ndata: test\n\n')
    })

    it('should include event ID when provided', async () => {
      const response = eventStream(async function* () {
        yield { id: '123', data: 'test' }
      })

      const text = await response.text()
      expect(text).toBe('id: 123\ndata: test\n\n')
    })

    it('should include retry when provided', async () => {
      const response = eventStream(async function* () {
        yield { retry: 3000, data: 'test' }
      })

      const text = await response.text()
      expect(text).toBe('retry: 3000\ndata: test\n\n')
    })

    it('should format complete SSE message with all fields', async () => {
      const response = eventStream(async function* () {
        yield {
          event: 'update',
          id: '123',
          retry: 3000,
          data: JSON.stringify({ message: 'hello' }),
        }
      })

      const text = await response.text()
      expect(text).toBe('event: update\nid: 123\nretry: 3000\ndata: {"message":"hello"}\n\n')
    })

    it('should handle multiple events', async () => {
      const response = eventStream(async function* () {
        yield { data: 'Event 1' }
        yield { data: 'Event 2' }
      })

      const text = await response.text()
      expect(text).toBe('data: Event 1\n\ndata: Event 2\n\n')
    })

    it('should support custom headers', () => {
      const response = eventStream(
        async function* () {
          yield { data: 'test' }
        },
        { headers: { 'X-Custom': 'value' } }
      )

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('X-Custom')).toBe('value')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
    })

    it('should handle empty generator', async () => {
      const response = eventStream(async function* () {
        // Empty generator
      })

      const text = await response.text()
      expect(text).toBe('')
    })

    it('should propagate generator errors', async () => {
      const response = eventStream(async function* () {
        yield { data: 'Event 1' }
        throw new Error('SSE generator failed')
      })

      // The error should propagate when reading the stream
      await expect(response.text()).rejects.toThrow('SSE generator failed')
    })
  })

  describe('redirect', () => {
    it('should create redirect response with default 302 status', () => {
      const response = redirect('/new-location')

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/new-location')
    })

    it('should support custom redirect status codes', () => {
      const response = redirect('/permanent', 301)

      expect(response.status).toBe(301)
    })
  })

  describe('notFound', () => {
    it('should create 404 response', () => {
      const response = notFound()

      expect(response.status).toBe(404)
    })

    it('should support custom message', async () => {
      const response = notFound('Resource not found')

      expect(await response.text()).toBe('Resource not found')
    })
  })
})
