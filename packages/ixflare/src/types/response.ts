/**
 * @fileoverview Typed response helpers for route handlers
 * @worker-only
 */

/**
 * Response initialization options with common defaults
 */
export interface ResponseInit {
  status?: number
  statusText?: string
  headers?: HeadersInit
}

/**
 * Create a JSON response with proper Content-Type
 *
 * @param data - Data to serialize as JSON
 * @param init - Response options
 * @returns Response with JSON body
 */
export function json<T = unknown>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}

/**
 * Create a text response
 *
 * @param text - Text content
 * @param init - Response options
 * @returns Response with text body
 */
export function text(text: string, init?: ResponseInit): Response {
  return new Response(text, {
    ...init,
    headers: {
      'Content-Type': 'text/plain',
      ...init?.headers,
    },
  })
}

/**
 * Create an HTML response
 *
 * @param html - HTML content
 * @param init - Response options
 * @returns Response with HTML body
 */
export function html(html: string, init?: ResponseInit): Response {
  return new Response(html, {
    ...init,
    headers: {
      'Content-Type': 'text/html',
      ...init?.headers,
    },
  })
}

/**
 * Create a redirect response
 *
 * @param url - URL to redirect to
 * @param status - HTTP status code (301, 302, 303, 307, 308)
 * @returns Redirect response
 */
export function redirect(url: string, status: number = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: url,
    },
  })
}

/**
 * Create a not found (404) response
 *
 * @param message - Optional error message
 * @returns 404 response
 */
export function notFound(message: string = 'Not Found'): Response {
  return json({ error: { code: 'NOT_FOUND', message } }, { status: 404 })
}

/**
 * Create a bad request (400) response
 *
 * @param message - Error message
 * @returns 400 response
 */
export function badRequest(message: string): Response {
  return json({ error: { code: 'BAD_REQUEST', message } }, { status: 400 })
}

/**
 * Create an unauthorized (401) response
 *
 * @param message - Optional error message
 * @returns 401 response
 */
export function unauthorized(message: string = 'Unauthorized'): Response {
  return json({ error: { code: 'UNAUTHORIZED', message } }, { status: 401 })
}

/**
 * Create a forbidden (403) response
 *
 * @param message - Optional error message
 * @returns 403 response
 */
export function forbidden(message: string = 'Forbidden'): Response {
  return json({ error: { code: 'FORBIDDEN', message } }, { status: 403 })
}

/**
 * Create an internal server error (500) response
 *
 * @param message - Optional error message
 * @returns 500 response
 */
export function serverError(message: string = 'Internal Server Error'): Response {
  return json({ error: { code: 'INTERNAL_ERROR', message } }, { status: 500 })
}
