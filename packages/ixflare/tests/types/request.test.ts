/**
 * @fileoverview Tests for request helpers
 * @worker-only
 */

import { describe, it, expect } from 'vitest'
import {
  parseJson,
  parseFormData,
  parseText,
  getQueryParam,
  getQueryParams,
  getParam,
} from '../../src/types/request'
import { createEdgeContext } from '../../src/types/context'

describe('Request helpers', () => {
  describe('parseJson', () => {
    it('should parse JSON request body', async () => {
      const data = { name: 'Test', value: 123 }
      const request = new Request('https://example.com', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      })

      const parsed = await parseJson(request)
      expect(parsed).toEqual(data)
    })
  })

  describe('parseText', () => {
    it('should parse text request body', async () => {
      const request = new Request('https://example.com', {
        method: 'POST',
        body: 'Hello, World!',
      })

      const text = await parseText(request)
      expect(text).toBe('Hello, World!')
    })
  })

  describe('parseFormData', () => {
    it('should parse form data request body', async () => {
      const formData = new FormData()
      formData.append('name', 'Test')
      formData.append('email', 'test@example.com')

      const request = new Request('https://example.com', {
        method: 'POST',
        body: formData,
      })

      const parsed = await parseFormData(request)
      expect(parsed.get('name')).toBe('Test')
      expect(parsed.get('email')).toBe('test@example.com')
    })
  })

  describe('getQueryParam', () => {
    it('should get single query parameter', () => {
      const request = new Request('https://example.com?filter=active&page=2')
      const context = createEdgeContext(request, {}, {} as ExecutionContext)

      expect(getQueryParam(context, 'filter')).toBe('active')
      expect(getQueryParam(context, 'page')).toBe('2')
      expect(getQueryParam(context, 'missing')).toBeNull()
    })
  })

  describe('getQueryParams', () => {
    it('should get all values for query parameter', () => {
      const request = new Request('https://example.com?tag=a&tag=b&tag=c')
      const context = createEdgeContext(request, {}, {} as ExecutionContext)

      const tags = getQueryParams(context, 'tag')
      expect(tags).toEqual(['a', 'b', 'c'])
    })
  })

  describe('getParam', () => {
    it('should get route parameter', () => {
      const request = new Request('https://example.com/users/123')
      const context = createEdgeContext(
        request,
        {},
        {} as ExecutionContext,
        { id: '123', type: 'user' }
      )

      expect(getParam(context, 'id')).toBe('123')
      expect(getParam(context, 'type')).toBe('user')
      expect(getParam(context, 'missing')).toBeUndefined()
    })
  })
})
