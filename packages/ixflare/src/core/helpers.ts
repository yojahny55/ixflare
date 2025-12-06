/**
 * @module core/helpers
 * @description Response helper functions
 */

export function json<T>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @internal
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Creates an HTML response from a tagged template literal
 * Automatically escapes interpolated values for XSS prevention
 *
 * @example
 * ```typescript
 * const name = '<script>alert("xss")</script>'
 * return html`<h1>Hello ${name}</h1>` // Safely escapes the script tag
 * ```
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Response

/**
 * Creates an HTML response from a string (legacy)
 *
 * @example
 * ```typescript
 * return html('<h1>Hello World</h1>')
 * ```
 */
export function html(content: string, init?: ResponseInit): Response

/**
 * Creates an HTML response with proper Content-Type header
 * Supports both tagged template literals (with XSS escaping) and plain strings
 */
export function html(
  stringsOrContent: TemplateStringsArray | string,
  ...valuesOrInit: unknown[]
): Response {
  // Check if it's a tagged template literal
  if (Array.isArray(stringsOrContent) && 'raw' in stringsOrContent) {
    const strings = stringsOrContent as TemplateStringsArray
    const values = valuesOrInit
    const escaped = values.map(v => escapeHtml(String(v)))
    const content = strings.reduce((acc, str, i) =>
      acc + str + (escaped[i] ?? ''), '')
    return new Response(content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Legacy string overload
  const content = stringsOrContent as string
  const init = valuesOrInit[0] as ResponseInit | undefined
  return new Response(content, {
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...init?.headers,
    },
  })
}

export function redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: url,
    },
  })
}

export function notFound(message = 'Not Found'): Response {
  return new Response(message, { status: 404 })
}

/**
 * Creates a plain text response
 *
 * @example
 * ```typescript
 * return text('Hello, World!')
 * ```
 */
export function text(content: string, init?: ResponseInit): Response {
  return new Response(content, {
    ...init,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...init?.headers,
    },
  })
}

/**
 * Creates a streaming response from an async generator
 * Uses ReadableStream.from() for efficient streaming
 *
 * @example
 * ```typescript
 * return stream(async function* () {
 *   yield 'Starting...\n'
 *   for (const item of items) {
 *     yield JSON.stringify(item) + '\n'
 *   }
 *   yield 'Done!\n'
 * })
 * ```
 *
 * @param generator - Async generator function yielding string chunks
 * @param init - Optional ResponseInit for custom headers
 */
export function stream(
  generator: () => AsyncGenerator<string, void, unknown>,
  init?: ResponseInit
): Response {
  const encoder = new TextEncoder()

  // Transform string chunks to Uint8Array for proper streaming
  async function* encodedGenerator() {
    for await (const chunk of generator()) {
      yield encoder.encode(chunk)
    }
  }

  // Use ReadableStream.from() if available (Cloudflare Workers April 2024+)
  // TypeScript doesn't have the type yet, so we cast through any
  const readable = (ReadableStream as any).from(encodedGenerator())

  return new Response(readable, {
    ...init,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...init?.headers,
    },
  })
}

/**
 * Server-Sent Events (SSE) event structure
 */
export interface SSEEvent {
  /** The event data payload */
  data: string
  /** Optional event type name */
  event?: string
  /** Optional event ID for client tracking */
  id?: string
  /** Optional reconnection time in milliseconds */
  retry?: number
}

/**
 * Creates a Server-Sent Events streaming response
 *
 * @example
 * ```typescript
 * return eventStream(async function* () {
 *   yield { data: JSON.stringify({ message: 'Hello' }) }
 *   yield { event: 'update', data: JSON.stringify({ count: 1 }) }
 * })
 * ```
 */
export function eventStream(
  generator: () => AsyncGenerator<SSEEvent, void, unknown>,
  init?: ResponseInit
): Response {
  const encoder = new TextEncoder()

  async function* sseGenerator() {
    for await (const event of generator()) {
      let message = ''
      if (event.event) message += `event: ${event.event}\n`
      if (event.id) message += `id: ${event.id}\n`
      if (event.retry) message += `retry: ${event.retry}\n`
      message += `data: ${event.data}\n\n`
      yield encoder.encode(message)
    }
  }

  // Use ReadableStream.from() if available (Cloudflare Workers April 2024+)
  // TypeScript doesn't have the type yet, so we cast through any
  const readable = (ReadableStream as any).from(sseGenerator())

  return new Response(readable, {
    ...init,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...init?.headers,
    },
  })
}
