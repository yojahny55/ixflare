/**
 * @module ssr/error-boundary
 * @description React ErrorBoundary component for SSR error isolation
 * @packageDocumentation
 */

import React, { Component, createContext, useContext } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

/**
 * Request context for error logging
 */
export interface ErrorRequestContext {
  /** Ray ID for distributed tracing */
  rayId?: string
  /** Request path */
  path?: string
}

/**
 * Error info with request context
 */
export interface ErrorBoundaryInfo {
  /** React component stack trace */
  componentStack: string
  /** Ray ID for distributed tracing */
  rayId?: string
  /** Request path */
  path?: string
  /** Timestamp when error occurred */
  timestamp?: number
}

/**
 * Props for fallback render function
 */
export interface FallbackProps {
  /** The error that was caught */
  error: Error
  /** Function to reset the error boundary and retry render */
  resetErrorBoundary: () => void
}

/**
 * ErrorBoundary component props
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode
  /** Static fallback UI to render on error */
  fallback?: ReactNode
  /** Function to render fallback UI with error info */
  fallbackRender?: (props: FallbackProps) => ReactNode
  /** React component to render as fallback */
  FallbackComponent?: React.ComponentType<FallbackProps>
  /** Callback when error is caught */
  onError?: (error: Error, info: ErrorBoundaryInfo) => void
  /** Callback when error boundary is reset */
  onReset?: () => void
  /** Request context for error logging */
  context?: ErrorRequestContext
}

/**
 * ErrorBoundary state
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean
  /** The caught error */
  error: Error | null
}

/**
 * Context for useErrorBoundary hook
 */
interface ErrorBoundaryContextValue {
  /** Imperatively trigger the error boundary */
  showBoundary: (error: Error) => void
  /** Reset the error boundary and retry render */
  resetBoundary: () => void
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextValue | null>(null)

/**
 * React Error Boundary component for SSR error isolation.
 *
 * Catches errors in child components and renders a fallback UI instead of
 * crashing the entire page. Supports multiple fallback rendering strategies
 * and integrates with request context for logging.
 *
 * @example
 * ```typescript
 * // Static fallback
 * <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // Dynamic fallback with error info
 * <ErrorBoundary
 *   fallbackRender={({ error, resetErrorBoundary }) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={resetErrorBoundary}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With error logging
 * <ErrorBoundary
 *   fallback={<p>Error occurred</p>}
 *   onError={(error, info) => {
 *     console.error('Caught error:', error)
 *     console.error('Ray ID:', info.rayId)
 *     console.error('Path:', info.path)
 *   }}
 *   context={{ rayId: ctx.rayId, path: ctx.request.url }}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  /**
   * Derive state from error to trigger fallback rendering.
   * Called during render phase when a child component throws.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  /**
   * Called after an error is caught. Used for side effects like logging.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const info: ErrorBoundaryInfo = {
      componentStack: errorInfo.componentStack || '',
      rayId: this.props.context?.rayId,
      path: this.props.context?.path,
      timestamp: Date.now(),
    }

    this.props.onError?.(error, info)
  }

  /**
   * Reset the error boundary state to retry rendering.
   * Call this from a retry button in the fallback UI.
   */
  resetErrorBoundary = (): void => {
    this.props.onReset?.()
    this.setState({
      hasError: false,
      error: null,
    })
  }

  /**
   * Imperatively trigger the error boundary from event handlers.
   * Used by useErrorBoundary hook for programmatic error handling.
   */
  showBoundary = (error: Error): void => {
    this.setState({
      hasError: true,
      error,
    })
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback, fallbackRender, FallbackComponent } = this.props

    if (hasError && error) {
      // Priority order: FallbackComponent > fallbackRender > fallback
      if (FallbackComponent) {
        return <FallbackComponent error={error} resetErrorBoundary={this.resetErrorBoundary} />
      }

      if (fallbackRender) {
        return fallbackRender({ error, resetErrorBoundary: this.resetErrorBoundary })
      }

      return fallback ?? null
    }

    // No error - render children with error boundary context
    return (
      <ErrorBoundaryContext.Provider
        value={{
          showBoundary: this.showBoundary,
          resetBoundary: this.resetErrorBoundary,
        }}
      >
        {children}
      </ErrorBoundaryContext.Provider>
    )
  }
}

/**
 * Hook to imperatively trigger error boundaries from event handlers.
 *
 * Must be used within an ErrorBoundary component. Provides functions to
 * programmatically show errors and reset the boundary state.
 *
 * This hook is client-side only - calling showBoundary during SSR will
 * have no effect until hydration completes on the client.
 *
 * @returns Object with showBoundary and resetBoundary functions
 * @throws Error if used outside an ErrorBoundary
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { showBoundary, resetBoundary } = useErrorBoundary()
 *
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation()
 *     } catch (error) {
 *       showBoundary(error as Error)
 *     }
 *   }
 *
 *   return <button onClick={handleClick}>Risk it</button>
 * }
 * ```
 */
export function useErrorBoundary(): ErrorBoundaryContextValue {
  const context = useContext(ErrorBoundaryContext)

  if (!context) {
    throw new Error('useErrorBoundary must be used within an ErrorBoundary')
  }

  return context
}
