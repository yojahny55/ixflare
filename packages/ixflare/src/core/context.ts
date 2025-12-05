/**
 * @module core/context
 * @description Request context for route handlers
 */

export interface Context<E = unknown> {
  request: Request
  env: E
  params: Record<string, string>
  url: URL
  method: string
  headers: Headers
}

export function createContext<E = unknown>(
  request: Request,
  env: E,
  params: Record<string, string> = {}
): Context<E> {
  const url = new URL(request.url)

  return {
    request,
    env,
    params,
    url,
    method: request.method,
    headers: request.headers,
  }
}
