/**
 * @module tests/ssr/error-page
 * @description Tests for custom error page rendering
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderErrorPage, createFallbackErrorHtml, findErrorPage } from '@/ssr/error-page-renderer'
import type { ErrorProps } from '@/ssr/types'

describe('renderErrorPage', () => {
  it('should render default error page with basic error', async () => {
    const error = new Error('Test error')
    const response = await renderErrorPage(error)

    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('no-store')

    const html = await response.text()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('500')
    expect(html).toContain('Something went wrong')
    expect(html).toContain('Test error')
  })

  it('should render error page with custom status code', async () => {
    const error = new Error('Not found')
    const response = await renderErrorPage(error, { statusCode: 404 })

    expect(response.status).toBe(404)
    const html = await response.text()
    expect(html).toContain('404')
    expect(html).toContain('Not found')
  })

  it('should include Ray ID when provided', async () => {
    const error = new Error('Test error')
    const response = await renderErrorPage(error, {
      rayId: 'test-ray-123',
    })

    const html = await response.text()
    expect(html).toContain('test-ray-123')
    expect(html).toContain('Error ID')
  })

  it('should use custom error component if provided', async () => {
    function CustomErrorPage({ error, statusCode }: ErrorProps) {
      return (
        <div>
          <h1>Custom Error {statusCode}</h1>
          <p>{error.message}</p>
        </div>
      )
    }

    const error = new Error('Custom error message')
    const response = await renderErrorPage(error, {
      ErrorComponent: CustomErrorPage,
    })

    const html = await response.text()
    // React renders {statusCode} with a space comment: "Custom Error <!-- -->500"
    expect(html).toContain('Custom Error')
    expect(html).toContain('500')
    expect(html).toContain('Custom error message')
  })

  it('should never cache error pages', async () => {
    const error = new Error('Test error')
    const response = await renderErrorPage(error)

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('createFallbackErrorHtml', () => {
  it('should create minimal HTML with status and message', () => {
    const html = createFallbackErrorHtml(500, 'Server error')

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('500')
    expect(html).toContain('Server error')
    expect(html).toContain('Something went wrong')
  })

  it('should include Ray ID when provided', () => {
    const html = createFallbackErrorHtml(500, 'Server error', 'test-ray-456')

    expect(html).toContain('test-ray-456')
    expect(html).toContain('Error ID')
  })

  it('should escape HTML in error messages', () => {
    const html = createFallbackErrorHtml(500, '<script>alert("xss")</script>')

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should escape HTML in Ray ID', () => {
    const html = createFallbackErrorHtml(500, 'Error', '<script>xss</script>')

    expect(html).not.toContain('<script>xss')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should handle different status codes', () => {
    const codes = [400, 404, 500, 503]

    for (const code of codes) {
      const html = createFallbackErrorHtml(code, `Error ${code}`)
      expect(html).toContain(`${code}`)
      expect(html).toContain(`${code} Error`)
    }
  })

  it('should not include Ray ID section when not provided', () => {
    const html = createFallbackErrorHtml(500, 'Error')

    expect(html).not.toContain('Error ID')
  })
})

describe('findErrorPage', () => {
  it('should return null when no custom error page exists', async () => {
    const ErrorComponent = await findErrorPage('/dashboard/stats')

    expect(ErrorComponent).toBeNull()
  })

  // Note: Full error page detection requires Vite plugin integration
  // These tests will be expanded when build-time error page scanning is implemented
})
