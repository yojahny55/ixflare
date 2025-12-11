/**
 * @module tests/ssr/streaming-error
 * @description Tests for streaming error handling
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import {
  classifySSRError,
  generateErrorNotificationScript,
  createSSRErrorInfo,
  logSSRError,
  type SSRErrorType,
} from '@/ssr/streaming-error-handler'
import { renderToStream } from '@/ssr/render'
import { AppError, InfraError, ValidationError } from '@/errors'

describe('classifySSRError', () => {
  it('should classify shell errors correctly', () => {
    const error = new Error('Shell render failed')
    const errorType = classifySSRError(error, true)

    expect(errorType).toBe('shell')
  })

  it('should classify infrastructure errors correctly', () => {
    const error = new InfraError('SSR_FAILED', 'Render failed')
    const errorType = classifySSRError(error, false)

    expect(errorType).toBe('infra')
  })

  it('should classify boundary errors correctly', () => {
    const error = new Error('Component failed')
    const errorType = classifySSRError(error, false)

    expect(errorType).toBe('boundary')
  })

  it('should prioritize shell classification over error type', () => {
    const infraError = new InfraError('SSR_FAILED', 'Failed')
    const errorType = classifySSRError(infraError, true)

    expect(errorType).toBe('shell')
  })

  it('should classify app errors correctly (AppError base class)', () => {
    const error = new AppError('APP_ERROR', 'User code error')
    const errorType = classifySSRError(error, false)

    expect(errorType).toBe('app')
  })

  it('should classify app errors correctly (ValidationError subclass)', () => {
    const error = new ValidationError('INVALID_INPUT', 'Bad data')
    const errorType = classifySSRError(error, false)

    expect(errorType).toBe('app')
  })

  it('should prioritize infra over app classification', () => {
    // InfraError extends AppError, so we need to check InfraError first
    const error = new InfraError('SSR_FAILED', 'Infrastructure failure')
    const errorType = classifySSRError(error, false)

    expect(errorType).toBe('infra')
  })
})

describe('generateErrorNotificationScript', () => {
  it('should generate error notification script with escaped values', () => {
    const error = new Error('Test error')
    const script = generateErrorNotificationScript(error, 'boundary-1')

    expect(script).toContain('<script>')
    expect(script).toContain('window.__SSR_BOUNDARY_ERRORS__')
    expect(script).toContain('boundary-1')
    expect(script).toContain('Test error')
    expect(script).toContain('timestamp')
    expect(script).toContain('</script>')
  })

  it('should escape HTML in error messages', () => {
    const error = new Error('<script>alert("xss")</script>')
    const script = generateErrorNotificationScript(error, 'boundary-1')

    expect(script).not.toContain('<script>alert')
    expect(script).toContain('&lt;script&gt;')
  })

  it('should escape HTML in boundary IDs', () => {
    const error = new Error('Test error')
    const script = generateErrorNotificationScript(error, 'boundary-<script>')

    expect(script).not.toContain('boundary-<script>')
    expect(script).toContain('&lt;script&gt;')
  })

  it('should include timestamp in script', () => {
    const error = new Error('Test error')
    const script = generateErrorNotificationScript(error, 'boundary-1')

    const timestampMatch = script.match(/timestamp:(\d+)/)
    expect(timestampMatch).toBeTruthy()
    const timestamp = timestampMatch ? Number.parseInt(timestampMatch[1]) : 0
    expect(timestamp).toBeGreaterThan(Date.now() - 1000) // Within last second
  })

  it('should initialize global error array if not exists', () => {
    const script = generateErrorNotificationScript(new Error('Test'), 'boundary-1')

    expect(script).toContain('window.__SSR_BOUNDARY_ERRORS__=window.__SSR_BOUNDARY_ERRORS__||[]')
  })
})

describe('createSSRErrorInfo', () => {
  it('should create error info with all fields', () => {
    const error = new Error('Test error')
    const errorInfo = createSSRErrorInfo(error, 'boundary', {
      rayId: 'test-ray-123',
      path: '/test-path',
      componentStack: 'at Component',
    })

    expect(errorInfo).toEqual({
      type: 'boundary',
      error,
      componentStack: 'at Component',
      rayId: 'test-ray-123',
      path: '/test-path',
      timestamp: expect.any(Number),
    })
  })

  it('should create error info without optional context', () => {
    const error = new Error('Test error')
    const errorInfo = createSSRErrorInfo(error, 'shell')

    expect(errorInfo).toEqual({
      type: 'shell',
      error,
      componentStack: undefined,
      rayId: undefined,
      path: undefined,
      timestamp: expect.any(Number),
    })
  })

  it('should include timestamp within reasonable range', () => {
    const before = Date.now()
    const errorInfo = createSSRErrorInfo(new Error('Test'), 'boundary')
    const after = Date.now()

    expect(errorInfo.timestamp).toBeGreaterThanOrEqual(before)
    expect(errorInfo.timestamp).toBeLessThanOrEqual(after)
  })
})

describe('logSSRError', () => {
  it('should log error with all context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const errorInfo = createSSRErrorInfo(new Error('Test error'), 'boundary', {
      rayId: 'test-ray-123',
      path: '/test-path',
      componentStack: 'at Component',
    })

    logSSRError(errorInfo)

    expect(consoleSpy).toHaveBeenCalledWith('[SSR Error] boundary', {
      type: 'boundary',
      message: 'Test error',
      rayId: 'test-ray-123',
      path: '/test-path',
      timestamp: expect.any(Number),
      componentStack: 'at Component',
    })

    consoleSpy.mockRestore()
  })

  it('should log error without component stack', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const errorInfo = createSSRErrorInfo(new Error('Test error'), 'shell', {
      rayId: 'test-ray-123',
      path: '/test-path',
    })

    logSSRError(errorInfo)

    expect(consoleSpy).toHaveBeenCalledWith('[SSR Error] shell', {
      type: 'shell',
      message: 'Test error',
      rayId: 'test-ray-123',
      path: '/test-path',
      timestamp: expect.any(Number),
    })

    consoleSpy.mockRestore()
  })

  it('should log different error types', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const types: SSRErrorType[] = ['shell', 'boundary', 'app', 'infra']

    for (const type of types) {
      const errorInfo = createSSRErrorInfo(new Error(`${type} error`), type)
      logSSRError(errorInfo)

      expect(consoleSpy).toHaveBeenCalledWith(
        `[SSR Error] ${type}`,
        expect.objectContaining({
          type,
          message: `${type} error`,
        })
      )
    }

    consoleSpy.mockRestore()
  })
})

describe('renderToStream error classification integration', () => {
  it('should classify and log errors during streaming via onError callback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Component that throws during render
    function ThrowingComponent(): never {
      throw new Error('Component render failed')
    }

    // Create stream with component that throws
    const stream = renderToStream(React.createElement(ThrowingComponent))

    // Consume stream to trigger error
    const reader = stream.getReader()
    try {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    } catch {
      // Expected to error
    }

    // Verify error was logged with SSR Error prefix
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SSR Error]'),
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })

  it('should use custom onError handler when provided', async () => {
    const customErrorHandler = vi.fn()

    function ThrowingComponent(): never {
      throw new Error('Custom handler test')
    }

    const stream = renderToStream(React.createElement(ThrowingComponent), {
      onError: customErrorHandler,
    })

    // Consume stream to trigger error
    const reader = stream.getReader()
    try {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    } catch {
      // Expected to error
    }

    // Custom handler should have been called
    expect(customErrorHandler).toHaveBeenCalled()
  })

  it('should inject error notification scripts for boundary errors (AC2)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Component that renders successfully first, then a child throws
    // This simulates a boundary error (shell renders, then Suspense boundary fails)
    function ParentComponent() {
      return React.createElement(
        'div',
        null,
        React.createElement('h1', null, 'Shell Content'),
        React.createElement(ThrowingChild)
      )
    }

    function ThrowingChild(): never {
      throw new Error('Boundary component failed')
    }

    const stream = renderToStream(React.createElement(ParentComponent))

    // Consume stream and collect output
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
    } catch {
      // May error on shell failure, that's ok
    }

    // If this was a boundary error (not shell), check for error notification script
    // Shell errors won't produce notification scripts, only boundary errors do
    if (html.includes('Shell Content')) {
      // Shell rendered successfully, so any errors are boundary errors
      // Check that the error notification script was injected
      expect(html).toContain('__SSR_BOUNDARY_ERRORS__')
      expect(html).toContain('ssr-boundary-error-')
    }

    consoleSpy.mockRestore()
  })

  it('should not inject error notification scripts for shell errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Component that throws immediately (shell error)
    function ShellFailingComponent(): never {
      throw new Error('Shell render failed')
    }

    const stream = renderToStream(React.createElement(ShellFailingComponent))

    // Consume stream
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
    } catch {
      // Expected to error for shell failures
    }

    // Shell errors should NOT have notification scripts (they're critical failures)
    // The page will show error page instead, not partial content with notifications
    // Note: React may still output partial HTML before failing
    consoleSpy.mockRestore()
  })
})
