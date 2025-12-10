/**
 * @module ssr/streaming
 * @description Streaming SSR utilities and helpers for progressive HTML streaming
 */

import type { RenderOptions } from './types'

/**
 * Creates a Response object with proper streaming headers.
 *
 * Sets Transfer-Encoding: chunked and other security headers for streaming HTML.
 *
 * @param stream - ReadableStream of HTML content
 * @param options - Optional status code and additional headers
 * @returns Response configured for streaming
 *
 * @example
 * ```typescript
 * const stream = renderToStream(<App />)
 * return createStreamingResponse(stream)
 * ```
 */
export function createStreamingResponse(
  stream: ReadableStream,
  options?: { status?: number; headers?: Record<string, string> }
): Response {
  return new Response(stream, {
    status: options?.status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
      ...options?.headers
    }
  })
}

/**
 * Wraps a render stream with shell-ready callback notification.
 *
 * Creates a TransformStream that monitors the stream and fires the
 * onShellReady callback when shell content is complete (before Suspense boundaries).
 *
 * @param stream - Original ReadableStream from renderToStream
 * @param onShellReady - Callback to fire when shell is ready
 * @returns New ReadableStream that pipes through the monitor
 *
 * @example
 * ```typescript
 * const stream = renderToStream(<App />)
 * const monitoredStream = streamWithShellCallback(stream, () => {
 *   console.log('Shell ready, sending response headers')
 * })
 * ```
 */
export function streamWithShellCallback(
  stream: ReadableStream,
  onShellReady?: () => void
): ReadableStream {
  if (!onShellReady) {
    return stream
  }

  let shellReady = false

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      // First chunk indicates shell is ready
      if (!shellReady) {
        shellReady = true
        onShellReady()
      }
      controller.enqueue(chunk)
    }
  })

  return stream.pipeThrough(transformStream)
}

/**
 * Creates an AbortController that auto-aborts after a timeout.
 *
 * Useful for implementing SSR timeouts to prevent hanging renders.
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with controller and cleanup function
 *
 * @example
 * ```typescript
 * const { controller, cleanup } = createTimeoutController(10000)
 *
 * const stream = renderToStream(<App />, {
 *   abortSignal: controller.signal,
 *   onShellReady: () => cleanup() // Cancel timeout when shell is ready
 * })
 * ```
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController
  cleanup: () => void
} {
  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`SSR render timeout after ${timeoutMs}ms`))
  }, timeoutMs)

  const cleanup = () => clearTimeout(timeoutId)

  return { controller, cleanup }
}

/**
 * Wraps renderToStream with automatic timeout handling.
 *
 * Creates a timeout controller and automatically cleans up when shell is ready
 * or when the stream is cancelled.
 *
 * @param renderFn - Function that creates the render stream
 * @param options - Render options including timeoutMs
 * @returns ReadableStream with timeout protection
 *
 * @example
 * ```typescript
 * const stream = withTimeout(
 *   (opts) => renderToStream(<App />, opts),
 *   { timeoutMs: 10000, onShellReady: () => console.log('Shell ready') }
 * )
 * ```
 */
export function withTimeout(
  renderFn: (options: RenderOptions) => ReadableStream,
  options: RenderOptions
): ReadableStream {
  if (!options.timeoutMs) {
    return renderFn(options)
  }

  const { controller, cleanup } = createTimeoutController(options.timeoutMs)

  // Wrap the original onShellReady to cleanup timeout
  const originalOnShellReady = options.onShellReady
  const wrappedOnShellReady = () => {
    cleanup()
    originalOnShellReady?.()
  }

  const stream = renderFn({
    ...options,
    abortSignal: options.abortSignal ?? controller.signal,
    onShellReady: wrappedOnShellReady
  })

  // Create a passthrough stream that cleans up on cancellation
  const transformStream = new TransformStream({
    transform(chunk, outputController) {
      outputController.enqueue(chunk)
    },
    flush() {
      cleanup()
    },
    cancel() {
      cleanup()
    }
  })

  return stream.pipeThrough(transformStream)
}

/**
 * Injects Suspense fallback helper for consistent loading states.
 *
 * Creates a standardized fallback component with proper ARIA attributes
 * for accessibility.
 *
 * @param message - Loading message to display
 * @param id - Optional unique identifier for the fallback
 * @returns JSX element for Suspense fallback
 *
 * @example
 * ```typescript
 * import { Suspense } from 'react'
 * import { createSuspenseFallback } from 'ixflare/ssr'
 *
 * <Suspense fallback={createSuspenseFallback('Loading stats...')}>
 *   <SlowStats />
 * </Suspense>
 * ```
 */
export function createSuspenseFallback(message: string, id?: string) {
  return {
    type: 'div',
    props: {
      role: 'status',
      'aria-live': 'polite',
      'aria-busy': 'true',
      ...(id && { id }),
      children: message
    }
  }
}
