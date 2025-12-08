import { describe, it, expect } from 'vitest'
import { html, htmlResponse, text, stream, eventStream } from '../../src/core/helpers'

/**
 * Integration tests for response helpers
 * Tests helpers in realistic request/response simulation flows
 */
describe('Response Helpers Integration', () => {
  describe('html helper simulated route flow', () => {
    it('should create HTML from user-provided data', async () => {
      // Simulate route handler receiving dynamic user data
      const userData = { name: 'Alice', role: 'Admin' }

      const response = html`
        <div class="user-card">
          <h1>${userData.name}</h1>
          <span class="role">${userData.role}</span>
        </div>
      `

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')

      const body = await response.text()
      expect(body).toContain('Alice')
      expect(body).toContain('Admin')
    })

    it('should safely handle user-submitted content with XSS', async () => {
      // Simulate form submission with malicious content
      const formData = {
        comment: '<script>document.cookie</script>',
        author: 'Hacker<img src=x onerror=alert(1)>',
      }

      const response = html`
        <article>
          <p>${formData.comment}</p>
          <footer>By: ${formData.author}</footer>
        </article>
      `

      const body = await response.text()

      // Verify XSS is escaped - HTML tags are escaped preventing execution
      expect(body).not.toContain('<script>')
      expect(body).not.toContain('<img')
      expect(body).toContain('&lt;script&gt;')
      expect(body).toContain('&lt;img')
      // The = is safe when HTML tags are escaped - the browser won't execute onerror
      // because <img becomes &lt;img which is just text, not an element
    })
  })

  describe('htmlResponse helper simulated flow', () => {
    it('should create HTML response with status and headers', async () => {
      // Simulate creating a new resource and returning HTML confirmation
      const createdItem = { id: 123, name: 'New<Product>' }

      const response = htmlResponse`
        <div class="success">
          <h1>Created!</h1>
          <p>Item: ${createdItem.name}</p>
        </div>
      `({
        status: 201,
        headers: {
          'X-Resource-Id': String(createdItem.id),
          'Cache-Control': 'no-store',
        },
      })

      expect(response.status).toBe(201)
      expect(response.headers.get('X-Resource-Id')).toBe('123')
      expect(response.headers.get('Cache-Control')).toBe('no-store')

      const body = await response.text()
      expect(body).toContain('New&lt;Product&gt;')
    })
  })

  describe('stream helper simulated flow', () => {
    it('should stream data progressively', async () => {
      // Simulate streaming a large dataset
      const items = ['Item 1', 'Item 2', 'Item 3']

      const response = stream(async function* () {
        yield '[\n'
        for (let i = 0; i < items.length; i++) {
          yield `  "${items[i]}"${i < items.length - 1 ? ',' : ''}\n`
        }
        yield ']\n'
      })

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(response.body).toBeDefined()

      const body = await response.text()
      expect(body).toBe('[\n  "Item 1",\n  "Item 2",\n  "Item 3"\n]\n')
    })

    it('should handle stream with async database simulation', async () => {
      // Simulate streaming records from async data source
      async function* fetchRecords() {
        const records = [
          { id: 1, name: 'Record A' },
          { id: 2, name: 'Record B' },
        ]

        for (const record of records) {
          // Simulate async fetch delay
          await new Promise((resolve) => setTimeout(resolve, 1))
          yield JSON.stringify(record) + '\n'
        }
      }

      const response = stream(fetchRecords)
      const body = await response.text()

      expect(body).toContain('"id":1')
      expect(body).toContain('"id":2')
    })
  })

  describe('eventStream helper simulated flow', () => {
    it('should format SSE for real-time updates', async () => {
      // Simulate real-time notification stream
      const response = eventStream(async function* () {
        yield { event: 'connected', data: JSON.stringify({ status: 'ok' }) }
        yield { event: 'notification', id: '1', data: JSON.stringify({ message: 'New message!' }) }
        yield {
          event: 'notification',
          id: '2',
          data: JSON.stringify({ message: 'Another update' }),
        }
      })

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')

      const body = await response.text()

      // Verify SSE format
      expect(body).toContain('event: connected')
      expect(body).toContain('event: notification')
      expect(body).toContain('id: 1')
      expect(body).toContain('id: 2')
      expect(body).toContain('data: {"status":"ok"}')
      expect(body).toContain('data: {"message":"New message!"}')
    })

    it('should support SSE with retry configuration', async () => {
      const response = eventStream(async function* () {
        yield { retry: 5000, data: 'initial' }
        yield { data: 'heartbeat' }
      })

      const body = await response.text()
      expect(body).toContain('retry: 5000')
    })
  })

  describe('text helper simulated flow', () => {
    it('should return health check response', async () => {
      // Simulate health check endpoint
      const response = text('OK', {
        headers: { 'X-Health-Status': 'healthy' },
      })

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('X-Health-Status')).toBe('healthy')
      expect(await response.text()).toBe('OK')
    })

    it('should return error response as plain text', async () => {
      const response = text('Service temporarily unavailable', {
        status: 503,
        headers: { 'Retry-After': '60' },
      })

      expect(response.status).toBe(503)
      expect(response.headers.get('Retry-After')).toBe('60')
    })
  })

  describe('combined helper workflow', () => {
    it('should handle complete request simulation', async () => {
      // Simulate a complete request/response cycle
      const mockRequest = {
        query: { format: 'html' },
        body: { name: '<script>alert("xss")</script>' },
      }

      // Route handler logic
      const format = mockRequest.query.format
      const userName = mockRequest.body.name

      let response: Response
      if (format === 'html') {
        response = html`<h1>Welcome, ${userName}!</h1>`
      } else {
        response = text(`Welcome, ${userName}!`)
      }

      // Verify safe output
      const body = await response.text()
      expect(body).not.toContain('<script>')
      expect(body).toContain('&lt;script&gt;')
    })
  })
})
