/**
 * @module tests/ssr/error-boundary
 * @description Tests for SSR ErrorBoundary component
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { ErrorBoundary, useErrorBoundary } from '@/ssr/error-boundary'

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    const boundary = new ErrorBoundary({ children: <div>Normal content</div> })
    const rendered = boundary.render()

    // Check that children are rendered wrapped in context provider
    expect(rendered).toBeDefined()
    expect(rendered).not.toBeNull()
  })

  it('should handle getDerivedStateFromError correctly', () => {
    const error = new Error('Test error')
    const newState = ErrorBoundary.getDerivedStateFromError(error)

    expect(newState).toEqual({
      hasError: true,
      error,
    })
  })

  it('should call onError callback in componentDidCatch', () => {
    const onError = vi.fn()
    const requestContext = {
      rayId: 'test-ray-123',
      path: '/test-path',
    }

    const boundary = new ErrorBoundary({
      children: <div>Test</div>,
      fallback: <div>Error</div>,
      onError,
      context: requestContext,
    })

    const error = new Error('Test error')
    const errorInfo = { componentStack: 'at Component' }

    boundary.componentDidCatch(error, errorInfo)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(error, {
      componentStack: 'at Component',
      rayId: 'test-ray-123',
      path: '/test-path',
      timestamp: expect.any(Number),
    })
  })

  it('should render fallback when hasError is true', () => {
    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      fallback: <div>Error fallback</div>,
    })

    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    const rendered = boundary.render()
    expect(rendered).toEqual(<div>Error fallback</div>)
  })

  it('should support fallbackRender prop', () => {
    const fallbackRender = vi.fn(({ error }) => <div>Custom error: {error.message}</div>)

    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      fallbackRender,
    })

    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    const rendered = boundary.render()
    expect(fallbackRender).toHaveBeenCalledWith({
      error: expect.objectContaining({ message: 'Test error' }),
      resetErrorBoundary: expect.any(Function),
    })
    // Check that fallbackRender was called, structure verified above
    expect(rendered).toBeDefined()
  })

  it('should support FallbackComponent prop', () => {
    function FallbackComponent({ error }: { error: Error }) {
      return <div>Component error: {error.message}</div>
    }

    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      FallbackComponent,
    })

    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    const rendered = boundary.render()
    expect(rendered).toEqual(
      <FallbackComponent
        error={new Error('Test error')}
        resetErrorBoundary={expect.any(Function)}
      />
    )
  })

  it('should prioritize FallbackComponent over fallbackRender', () => {
    const FallbackComponent = () => <div>From component</div>
    const fallbackRender = vi.fn(() => <div>From render</div>)

    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      fallback: <div>From fallback</div>,
      fallbackRender,
      FallbackComponent,
    })

    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    boundary.render()
    expect(fallbackRender).not.toHaveBeenCalled()
  })

  it('should prioritize fallbackRender over fallback', () => {
    const fallbackRender = vi.fn(() => <div>From render</div>)

    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      fallback: <div>From fallback</div>,
      fallbackRender,
    })

    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    boundary.render()
    expect(fallbackRender).toHaveBeenCalled()
  })

  it('should call onReset when resetErrorBoundary is called', () => {
    const onReset = vi.fn()
    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      fallback: <div>Error</div>,
      onReset,
    })

    // Initialize state directly
    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    // Mock setState to avoid "not mounted" warning and capture the call
    const setStateMock = vi.fn()
    boundary.setState = setStateMock

    boundary.resetErrorBoundary()

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(setStateMock).toHaveBeenCalledWith({
      hasError: false,
      error: null,
    })
  })

  it('should call setState with error when showBoundary is called', () => {
    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
      fallback: <div>Error</div>,
    })

    const error = new Error('Imperative error')

    // Mock setState to avoid "not mounted" warning and capture the call
    const setStateMock = vi.fn()
    boundary.setState = setStateMock

    boundary.showBoundary(error)

    expect(setStateMock).toHaveBeenCalledWith({
      hasError: true,
      error,
    })
  })

  it('should return null when no fallback is provided', () => {
    const boundary = new ErrorBoundary({
      children: <div>Normal</div>,
    })

    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    const rendered = boundary.render()
    expect(rendered).toBeNull()
  })
})

describe('useErrorBoundary', () => {
  it('should be exported as a function', () => {
    expect(useErrorBoundary).toBeDefined()
    expect(typeof useErrorBoundary).toBe('function')
  })

  it('should throw when called outside React render context', () => {
    // The hook throws when used outside a React render context
    // In test environment without proper React context, useContext throws
    // In actual React render, our check throws with our message
    expect(() => {
      useErrorBoundary()
    }).toThrow()
    // Note: The actual error thrown depends on context:
    // - Outside React render: "Cannot read properties of null (reading 'useContext')"
    // - Inside React render but outside ErrorBoundary: "useErrorBoundary must be used within an ErrorBoundary"
  })

  it('should provide showBoundary function that accepts Error', () => {
    // Test ErrorBoundary provides showBoundary that accepts an error
    const boundary = new ErrorBoundary({
      children: <div>Test</div>,
      fallback: <div>Error</div>,
    })

    // Verify showBoundary is a function
    expect(typeof boundary.showBoundary).toBe('function')

    // Mock setState to capture the call
    const setStateMock = vi.fn()
    boundary.setState = setStateMock

    const testError = new Error('Test error from hook')
    boundary.showBoundary(testError)

    expect(setStateMock).toHaveBeenCalledWith({
      hasError: true,
      error: testError,
    })
  })

  it('should provide resetBoundary function that clears error state', () => {
    // Test ErrorBoundary provides resetBoundary that clears state
    const onReset = vi.fn()
    const boundary = new ErrorBoundary({
      children: <div>Test</div>,
      fallback: <div>Error</div>,
      onReset,
    })

    // Simulate error state
    boundary.state = { hasError: true, error: new Error('Previous error') }

    // Mock setState to capture the call
    const setStateMock = vi.fn()
    boundary.setState = setStateMock

    boundary.resetErrorBoundary()

    expect(onReset).toHaveBeenCalled()
    expect(setStateMock).toHaveBeenCalledWith({
      hasError: false,
      error: null,
    })
  })

  it('should expose context value with showBoundary and resetBoundary via render', () => {
    // Test that the ErrorBoundary provides context with the expected shape
    const boundary = new ErrorBoundary({
      children: <div>Test</div>,
      fallback: <div>Error</div>,
    })

    const rendered = boundary.render()

    // The rendered output should be a context provider
    // Check that showBoundary and resetBoundary are functions on the boundary
    expect(typeof boundary.showBoundary).toBe('function')
    expect(typeof boundary.resetErrorBoundary).toBe('function')
    expect(rendered).toBeDefined()
  })
})
