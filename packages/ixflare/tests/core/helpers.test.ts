import { describe, it, expect } from 'vitest'
import { json, html, redirect, notFound } from '../../src/core/helpers'

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
    it('should create HTML response with correct content-type', () => {
      const content = '<h1>Hello</h1>'
      const response = html(content)

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
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
