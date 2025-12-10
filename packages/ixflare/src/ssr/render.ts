/**
 * @module ssr/render
 * @description SSR rendering functions using React 19's renderToReadableStream
 */

import { renderToReadableStream } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { RenderOptions } from './types'
import { InfraError } from '@/errors'

/**
 * Renders a React component to an HTML string
 * @param element - React element or component to render
 * @param options - Rendering options
 * @returns Complete HTML string with DOCTYPE
 */
export async function renderToString(
  element: ReactElement | (() => ReactElement) | (() => Promise<ReactElement>),
  options?: RenderOptions
): Promise<string> {
  try {
    // Handle functional components
    const reactElement = typeof element === 'function' ? await element() : element

    // Render to stream first
    const stream = await renderToReadableStream(reactElement, {
      signal: options?.abortSignal,
      bootstrapScripts: options?.bootstrapScripts,
      onError: options?.onError || ((error: unknown) => {
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

    // Wrap with proper HTML document structure
    let bodyContent = html

    if (options?.bootstrapData) {
      const bootstrapScript = `<script>window.__BOOTSTRAP_DATA__ = ${JSON.stringify(options.bootstrapData)};</script>`
      bodyContent = `${html}${bootstrapScript}`
    }

    const finalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${bodyContent}</body></html>`

    return finalHtml
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new InfraError(
      'SSR_RENDER_FAILED',
      `Failed to render component to string: ${errorMessage}`
    )
  }
}

/**
 * Renders a React component to a ReadableStream for streaming SSR
 * @param element - React element or component to render
 * @param options - Rendering options
 * @returns ReadableStream of HTML chunks
 */
export function renderToStream(
  element: ReactElement | (() => ReactElement) | (() => Promise<ReactElement>),
  options?: RenderOptions
): ReadableStream {
  // Create a new stream that wraps React's stream with DOCTYPE and bootstrap data
  return new ReadableStream({
    async start(controller) {
      try {
        // Handle functional components
        const reactElement = typeof element === 'function' ? await element() : element

        // Enqueue HTML document start
        controller.enqueue(new TextEncoder().encode('<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>'))

        // Render React component to stream
        const reactStream = await renderToReadableStream(reactElement, {
          signal: options?.abortSignal,
          bootstrapScripts: options?.bootstrapScripts,
          onError: options?.onError || ((error: unknown) => {
            console.error('[SSR Stream Error]', error)
          })
        })

        // Pipe React stream chunks
        const reader = reactStream.getReader()

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Inject bootstrap data before closing
            if (options?.bootstrapData) {
              const bootstrapScript = `<script>window.__BOOTSTRAP_DATA__ = ${JSON.stringify(options.bootstrapData)};</script>`
              controller.enqueue(new TextEncoder().encode(bootstrapScript))
            }
            // Close HTML document
            controller.enqueue(new TextEncoder().encode('</body></html>'))
            controller.close()
            break
          }

          controller.enqueue(value)

          // Check if aborted
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
      // Stream was cancelled
    }
  })
}
