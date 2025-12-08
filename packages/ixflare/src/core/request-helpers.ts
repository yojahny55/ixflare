/**
 * @module core/request-helpers
 * @description Request and Response cloning utilities for header modification
 *
 * The Web API Request and Response objects have immutable headers after construction.
 * These helpers provide convenient ways to create new instances with modified headers.
 *
 * @example
 * ```typescript
 * import { cloneRequest, withRequestHeaders } from 'ixflare'
 *
 * // Clone request with mutable headers
 * const newRequest = cloneRequest(ctx.request)
 * newRequest.headers.set('X-Custom', 'value')
 *
 * // Or use helper to add multiple headers
 * const newRequest = withRequestHeaders(ctx.request, {
 *   'X-Custom': 'value',
 *   'X-Another': 'header'
 * })
 * ```
 */

/**
 * Clone a request with mutable headers
 *
 * Creates a new Request instance with the same properties as the original,
 * but with mutable headers. Required because Request headers are immutable
 * after construction (per Web API spec).
 *
 * @param request - The request to clone
 * @param init - Optional RequestInit to override properties
 * @returns A new Request with mutable headers
 *
 * @example
 * ```typescript
 * const cloned = cloneRequest(request)
 * cloned.headers.set('X-Custom', 'value')
 *
 * // Override specific properties
 * const modified = cloneRequest(request, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' }
 * })
 * ```
 */
export function cloneRequest(request: Request, init?: RequestInit): Request {
  return new Request(request.url, {
    method: request.method,
    headers: new Headers(request.headers),
    body: request.body,
    // @ts-expect-error - duplex is required for body but not in TypeScript types yet
    duplex: 'half',
    ...init,
  })
}

/**
 * Clone a response with mutable headers
 *
 * Creates a new Response instance with the same body and properties,
 * but with mutable headers. Required because Response.clone() returns
 * a response with immutable headers (per WHATWG Fetch spec).
 *
 * @param response - The response to clone
 * @param init - Optional ResponseInit to override properties
 * @returns A new Response with mutable headers
 *
 * @example
 * ```typescript
 * const cloned = cloneResponse(response)
 * cloned.headers.set('X-Custom', 'value')
 *
 * // Override specific properties
 * const modified = cloneResponse(response, {
 *   status: 200,
 *   headers: { 'Content-Type': 'application/json' }
 * })
 * ```
 */
export function cloneResponse(response: Response, init?: ResponseInit): Response {
  return new Response(response.body, {
    status: init?.status ?? response.status,
    statusText: init?.statusText ?? response.statusText,
    headers: new Headers(init?.headers ?? response.headers),
  })
}

/**
 * Add or set headers on a request (creates new request)
 *
 * Convenience function to create a new Request with additional headers.
 * Existing headers are preserved unless overridden.
 *
 * @param request - The original request
 * @param headers - Headers to add or override
 * @returns A new Request with modified headers
 *
 * @example
 * ```typescript
 * const newRequest = withRequestHeaders(request, {
 *   'X-Request-ID': '12345',
 *   'X-Custom-Header': 'value'
 * })
 * ```
 */
export function withRequestHeaders(
  request: Request,
  headers: Record<string, string>
): Request {
  const newHeaders = new Headers(request.headers)
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value)
  }
  return new Request(request.url, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    // @ts-expect-error - duplex is required for body but not in TypeScript types yet
    duplex: 'half',
  })
}

/**
 * Add or set headers on a response (creates new response)
 *
 * Convenience function to create a new Response with additional headers.
 * Existing headers are preserved unless overridden.
 *
 * @param response - The original response
 * @param headers - Headers to add or override
 * @returns A new Response with modified headers
 *
 * @example
 * ```typescript
 * const newResponse = withResponseHeaders(response, {
 *   'X-Response-Time': '45ms',
 *   'X-Request-ID': '12345'
 * })
 * ```
 */
export function withResponseHeaders(
  response: Response,
  headers: Record<string, string>
): Response {
  const newHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}
