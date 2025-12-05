/**
 * @fileoverview Tests for response helpers
 * @worker-only
 */

import { describe, it, expect } from 'vitest'
import {
  json,
  text,
  html,
  redirect,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from '../../src/types/response'

describe('Response helpers', () => {
  describe('json', () => {
    it('should create JSON response with correct Content-Type', async () => {
      const data = { id: 1, name: 'Test' }
      const response = json(data)

      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(await response.json()).toEqual(data)
      expect(response.status).toBe(200)
    })

    it('should accept custom status code', async () => {
      const response = json({ error: 'Not found' }, { status: 404 })

      expect(response.status).toBe(404)
    })
  })

  describe('text', () => {
    it('should create text response with correct Content-Type', async () => {
      const response = text('Hello, World!')

      expect(response.headers.get('Content-Type')).toBe('text/plain')
      expect(await response.text()).toBe('Hello, World!')
    })
  })

  describe('html', () => {
    it('should create HTML response with correct Content-Type', async () => {
      const response = html('<h1>Hello</h1>')

      expect(response.headers.get('Content-Type')).toBe('text/html')
      expect(await response.text()).toBe('<h1>Hello</h1>')
    })
  })

  describe('redirect', () => {
    it('should create redirect response with default 302 status', () => {
      const response = redirect('https://example.com')

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://example.com')
    })

    it('should accept custom redirect status', () => {
      const response = redirect('https://example.com', 301)

      expect(response.status).toBe(301)
    })
  })

  describe('error responses', () => {
    it('should create 404 response', async () => {
      const response = notFound('User not found')

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('User not found')
    })

    it('should create 400 response', async () => {
      const response = badRequest('Invalid input')

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error.code).toBe('BAD_REQUEST')
    })

    it('should create 401 response', async () => {
      const response = unauthorized()

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('should create 403 response', async () => {
      const response = forbidden()

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('should create 500 response', async () => {
      const response = serverError()

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
