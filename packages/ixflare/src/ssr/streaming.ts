/**
 * @module ssr/streaming
 * @description Streaming SSR utilities and helpers for progressive HTML streaming
 */

import React from 'react'
import type { RenderOptions } from './types'

/**
 * Creates a Response object with proper streaming headers.
 *
 * Sets Transfer-Encoding: chunked and other security headers for streaming HTML.
 *
 * @param stream - ReadableStream of HTML content to send as the response body
 * @param options - Optional configuration for the response
 * @param options.status - HTTP status code (default: 200)
 * @param options.headers - Additional headers to merge with defaults
 * @returns Response configured for streaming with chunked transfer encoding
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
 * Wraps a render stream with first-chunk callback notification.
 *
 * Creates a TransformStream that monitors the stream and fires the
 * callback when the first chunk is emitted. In React streaming SSR,
 * the first chunk typically contains the shell content (HTML structure
 * before Suspense boundaries), though this is not guaranteed.
 *
 * **Note:** This fires on the first chunk of data, which in practice
 * corresponds to when React's shell is ready. For precise shell-ready
 * timing, use the `onShellReady` option in `renderToStream` directly.
 *
 * @param stream - Original ReadableStream to monitor
 * @param onShellReady - Callback to fire when first chunk is emitted (shell ready)
 * @returns New ReadableStream that pipes through the monitor, or original stream if no callback
 *
 * @example
 * ```typescript
 * const stream = renderToStream(<App />)
 * const monitoredStream = streamWithShellCallback(stream, () => {
 *   console.log('First chunk ready, sending response headers')
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
 * The cleanup function should be called when the timeout is no longer
 * needed (e.g., when shell is ready) to prevent unnecessary aborts.
 *
 * @param timeoutMs - Timeout duration in milliseconds before auto-abort
 * @returns Object containing:
 *   - `controller`: AbortController instance with signal for render options
 *   - `cleanup`: Function to cancel the timeout (call when shell is ready)
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
 * or when the stream is cancelled. If the user provides their own `abortSignal`,
 * this function creates a combined signal that aborts on either user abort OR timeout.
 *
 * @param renderFn - Function that creates the render stream (typically renderToStream)
 * @param options - Render options including timeoutMs for timeout duration
 * @param options.timeoutMs - Timeout in ms; if not provided, returns stream without timeout
 * @param options.abortSignal - Optional user-provided signal (combined with timeout signal)
 * @param options.onShellReady - Optional callback, will be called after timeout cleanup
 * @returns ReadableStream with timeout protection that aborts after timeoutMs
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

  // Combine user's abort signal with timeout signal if both exist
  let combinedSignal: AbortSignal = controller.signal
  if (options.abortSignal) {
    // If user signal already aborted, abort immediately
    if (options.abortSignal.aborted) {
      cleanup()
      combinedSignal = options.abortSignal
    } else {
      // Listen to user's signal to also abort our controller
      options.abortSignal.addEventListener('abort', () => {
        controller.abort(options.abortSignal?.reason)
        cleanup()
      }, { once: true })
    }
  }

  // Wrap the original onShellReady to cleanup timeout
  const originalOnShellReady = options.onShellReady
  const wrappedOnShellReady = () => {
    cleanup()
    originalOnShellReady?.()
  }

  const stream = renderFn({
    ...options,
    abortSignal: combinedSignal,
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
 * Creates a standardized Suspense fallback component with proper ARIA attributes
 * for accessibility.
 *
 * Returns a valid React element that can be used directly as a Suspense fallback.
 * The fallback includes accessibility attributes for screen readers.
 *
 * @param message - Loading message to display to users
 * @param id - Optional unique identifier for the fallback element
 * @returns React element suitable for use as a Suspense fallback
 *
 * @example
 * ```typescript
 * import { Suspense } from 'react'
 * import { createSuspenseFallback } from 'ixflare/ssr'
 *
 * <Suspense fallback={createSuspenseFallback('Loading stats...')}>
 *   <SlowStats />
 * </Suspense>
 *
 * // With custom ID for styling/testing
 * <Suspense fallback={createSuspenseFallback('Loading...', 'stats-loader')}>
 *   <SlowStats />
 * </Suspense>
 * ```
 */
export function createSuspenseFallback(message: string, id?: string): React.ReactElement {
  return React.createElement('div', {
    role: 'status',
    'aria-live': 'polite',
    'aria-busy': 'true',
    ...(id && { id })
  }, message)
}
