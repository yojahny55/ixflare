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

export function html(content: string, init?: ResponseInit): Response {
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
