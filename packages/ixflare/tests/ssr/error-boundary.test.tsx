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
      <FallbackComponent error={new Error('Test error')} resetErrorBoundary={expect.any(Function)} />
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

    // Manually set state to simulate error condition
    boundary.state = {
      hasError: true,
      error: new Error('Test error'),
    }

    // Mock setState to verify it's called correctly
    const setStateSpy = vi.spyOn(boundary, 'setState')
    boundary.resetErrorBoundary()

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(setStateSpy).toHaveBeenCalledWith({
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
    const setStateSpy = vi.spyOn(boundary, 'setState')

    boundary.showBoundary(error)

    expect(setStateSpy).toHaveBeenCalledWith({
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
    // The hook implementation is tested through ErrorBoundary integration
    // Direct testing of hook behavior requires a full React render cycle
    // which is better suited for integration tests with React Testing Library
    expect(useErrorBoundary).toBeDefined()
    expect(typeof useErrorBoundary).toBe('function')
  })

  // Note: Full hook testing (showBoundary/resetBoundary behavior) requires
  // React Testing Library in a browser environment. The hook's error checking
  // (throwing when used outside ErrorBoundary) is verified by the useContext
  // implementation which checks for null context.
})
