/**
 * @module ssr/render
 * @description SSR rendering functions
 */

import type { RenderOptions } from './types'

export async function renderToString(_element: unknown, _options?: RenderOptions): Promise<string> {
  // Placeholder - will be implemented in Epic 4
  return '<!DOCTYPE html><html><body>SSR Placeholder</body></html>'
}

export function renderToStream(_element: unknown, _options?: RenderOptions): ReadableStream {
  // Placeholder - will be implemented in Epic 4
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          '<!DOCTYPE html><html><body>SSR Streaming Placeholder</body></html>'
        )
      )
      controller.close()
    },
  })
}
