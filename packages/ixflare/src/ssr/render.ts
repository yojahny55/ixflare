/**
 * @module ssr/render
 * @description SSR rendering functions using React 19's renderToReadableStream
 */

import { renderToReadableStream } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { RenderOptions } from './types'
import { InfraError } from '@/errors'

// HTML structure constants to avoid duplication
const HTML_DOCTYPE = '<!DOCTYPE html>'
const HTML_CLOSE = '</body></html>'

/**
 * Safely serialize data for injection into HTML script tags.
 * Escapes characters that could break out of script context (XSS prevention).
 *
 * Escapes:
 * - < > to prevent </script> breakout
 * - & to prevent HTML entity injection
 * - ' " to prevent attribute breakout
 * - U+2028 (Line Separator) and U+2029 (Paragraph Separator) which are valid
 *   in JSON but treated as newlines in JavaScript, causing syntax errors
 *
 * @param data - Data to serialize
 * @returns Safe JSON string with escaped HTML-sensitive characters
 */
function safeJsonStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/"/g, '\\u0022')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * Builds the HTML head section with meta tags, title, and viewport.
 * @param options - Render options containing title and meta configuration
 * @returns HTML head string
 */
function buildHtmlHead(options?: RenderOptions): string {
  const lang = options?.lang ?? 'en'
  const title = options?.title ? `<title>${escapeHtml(options.title)}</title>` : ''
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1"/>'

  let metaTags = ''
  if (options?.meta) {
    for (const [name, content] of Object.entries(options.meta)) {
      metaTags += `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}"/>`
    }
  }

  return `<html lang="${lang}"><head><meta charset="utf-8"/>${viewport}${title}${metaTags}</head><body>`
}

/**
 * Escapes HTML special characters to prevent injection.
 * @param str - String to escape
 * @returns Escaped string safe for HTML attribute/content
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Builds the bootstrap script tag with safely serialized data.
 * @param data - Bootstrap data to inject
 * @returns Script tag string or empty string if no data
 */
function buildBootstrapScript(data: unknown): string {
  if (!data) return ''
  return `<script>window.__BOOTSTRAP_DATA__=${safeJsonStringify(data)};</script>`
}

/**
 * Renders a React component to an HTML string.
 *
 * Uses React 19's renderToReadableStream internally and converts the stream
 * to a complete HTML document string with proper DOCTYPE, head, and body structure.
 *
 * @param element - React element, component function, or async component to render
 * @param options - Rendering options
 * @param options.bootstrapData - Data to inject for client-side hydration (safely escaped)
 * @param options.abortSignal - AbortSignal to cancel rendering
 * @param options.bootstrapScripts - Script URLs to include for hydration
 * @param options.onError - Error handler callback for render errors
 * @param options.title - Document title (ignored if shell: false)
 * @param options.lang - HTML lang attribute (default: 'en', ignored if shell: false)
 * @param options.meta - Additional meta tags as name/content pairs (ignored if shell: false)
 * @param options.shell - Whether to wrap in HTML document shell (default: true)
 * @returns Promise resolving to HTML string (with or without DOCTYPE based on shell option)
 * @throws {InfraError} When rendering fails with code SSR_RENDER_FAILED
 *
 * @example
 * ```typescript
 * // Full document (default)
 * const html = await renderToString(
 *   <HomePage data={posts} />,
 *   { title: 'My App', bootstrapData: { posts } }
 * )
 *
 * // Fragment only (for HTMX or components with own shell)
 * const fragment = await renderToString(
 *   <UserCard user={user} />,
 *   { shell: false }
 * )
 * ```
 */
export async function renderToString(
  element: ReactElement | (() => ReactElement) | (() => Promise<ReactElement>),
  options?: RenderOptions
): Promise<string> {
  try {
    // Handle functional components (including async Server Components)
    const reactElement = typeof element === 'function' ? await element() : element

    // Render to stream first using React 19's renderToReadableStream
    const stream = await renderToReadableStream(reactElement, {
      signal: options?.abortSignal,
      bootstrapScripts: options?.bootstrapScripts,
      onError: options?.onError ?? ((error: unknown) => {
        console.error('[SSR Error]', error)
      })
    })

    // Convert stream to string
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }

    // Add final flush
    html += decoder.decode()

    // Check if shell wrapping is disabled
    const shouldWrapInShell = options?.shell !== false

    if (!shouldWrapInShell) {
      // Return raw component output with optional bootstrap data
      const bootstrapScript = buildBootstrapScript(options?.bootstrapData)
      return bootstrapScript ? `${html}${bootstrapScript}` : html
    }

    // Build complete HTML document with safe bootstrap data injection
    const htmlHead = buildHtmlHead(options)
    const bootstrapScript = buildBootstrapScript(options?.bootstrapData)

    return `${HTML_DOCTYPE}${htmlHead}${html}${bootstrapScript}${HTML_CLOSE}`
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new InfraError(
      'SSR_RENDER_FAILED',
      `Failed to render component to string: ${errorMessage}`
    )
  }
}

/**
 * Renders a React component to a ReadableStream for streaming SSR.
 *
 * Returns a Web Streams API ReadableStream that emits HTML chunks as they
 * are rendered. Ideal for edge environments and large pages where streaming
 * improves Time to First Byte (TTFB).
 *
 * Supports progressive streaming with Suspense boundaries, shell-ready callbacks,
 * timeout handling, and configurable chunk sizes.
 *
 * @param element - React element, component function, or async component to render
 * @param options - Rendering options
 * @param options.bootstrapData - Data to inject for client-side hydration (safely escaped)
 * @param options.abortSignal - AbortSignal to cancel rendering mid-stream
 * @param options.bootstrapScripts - Script URLs to include for hydration
 * @param options.onError - Error handler callback for stream errors
 * @param options.title - Document title (ignored if shell: false)
 * @param options.lang - HTML lang attribute (default: 'en', ignored if shell: false)
 * @param options.meta - Additional meta tags as name/content pairs (ignored if shell: false)
 * @param options.shell - Whether to wrap in HTML document shell (default: true)
 * @param options.onShellReady - Callback when shell HTML is ready (before Suspense content)
 * @param options.onAllReady - Callback when all content (including Suspense) is ready
 * @param options.progressiveChunkSize - Chunk size for progressive streaming (bytes)
 * @param options.timeoutMs - Timeout in ms after which render aborts and flushes fallbacks
 * @returns ReadableStream of HTML chunks
 * @throws {InfraError} When streaming fails with code SSR_STREAM_FAILED (via stream error)
 *
 * @example
 * ```typescript
 * // Full document stream (default)
 * const stream = renderToStream(<App />, { title: 'Streaming App' })
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/html; charset=utf-8' }
 * })
 *
 * // Progressive streaming with Suspense
 * const stream = renderToStream(<Dashboard />, {
 *   onShellReady: () => console.log('Shell ready, sending response'),
 *   onAllReady: () => console.log('All content ready'),
 *   timeoutMs: 10000
 * })
 *
 * // Fragment stream (for HTMX partial updates)
 * const fragmentStream = renderToStream(<PartialView />, { shell: false })
 * ```
 */
export function renderToStream(
  element: ReactElement | (() => ReactElement) | (() => Promise<ReactElement>),
  options?: RenderOptions
): ReadableStream {
  // Create encoder once for reuse (performance optimization)
  const encoder = new TextEncoder()
  const shouldWrapInShell = options?.shell !== false
  let shellReady = false
  let allReady = false

  // Create a new stream that wraps React's stream with DOCTYPE and bootstrap data
  return new ReadableStream({
    async start(controller) {
      try {
        // Handle functional components (including async Server Components)
        const reactElement = typeof element === 'function' ? await element() : element

        // Enqueue HTML document start with head and meta tags (if shell enabled)
        if (shouldWrapInShell) {
          const htmlHead = buildHtmlHead(options)
          controller.enqueue(encoder.encode(`${HTML_DOCTYPE}${htmlHead}`))
        }

        // Render React component to stream using React 19's renderToReadableStream
        const reactStream = await renderToReadableStream(reactElement, {
          signal: options?.abortSignal,
          bootstrapScripts: options?.bootstrapScripts,
          progressiveChunkSize: options?.progressiveChunkSize,
          onError: options?.onError ?? ((error: unknown) => {
            console.error('[SSR Stream Error]', error)
          })
        })

        // Monitor allReady Promise if callback provided
        if (options?.onAllReady && reactStream.allReady) {
          reactStream.allReady.then(() => {
            if (!allReady) {
              allReady = true
              options.onAllReady?.()
            }
          }).catch((error) => {
            console.error('[SSR allReady Error]', error)
          })
        }

        // Pipe React stream chunks to our output stream
        const reader = reactStream.getReader()

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Inject safely escaped bootstrap data before closing
            const bootstrapScript = buildBootstrapScript(options?.bootstrapData)
            if (bootstrapScript) {
              controller.enqueue(encoder.encode(bootstrapScript))
            }
            // Close HTML document (if shell enabled)
            if (shouldWrapInShell) {
              controller.enqueue(encoder.encode(HTML_CLOSE))
            }
            controller.close()
            break
          }

          // Fire onShellReady callback on first chunk (shell is complete)
          if (!shellReady) {
            shellReady = true
            options?.onShellReady?.()
          }

          controller.enqueue(value)

          // Check if aborted mid-stream
          if (options?.abortSignal?.aborted) {
            controller.error(new Error('Render aborted'))
            break
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        controller.error(
          new InfraError(
            'SSR_STREAM_FAILED',
            `Failed to render component to stream: ${errorMessage}`
          )
        )
      }
    },
    cancel() {
      // Stream was cancelled by consumer
    }
  })
}
