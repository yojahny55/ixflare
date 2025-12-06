/**
 * @fileoverview Typed request helpers for route handlers
 * @worker-only
 */

import type { EdgeContext } from './context'

/**
 * Parse JSON request body with type safety
 *
 * @param request - The request to parse
 * @returns Parsed JSON body
 */
export async function parseJson<T = unknown>(request: Request): Promise<T> {
  return await request.json() as T
}

/**
 * Parse form data from request
 *
 * @param request - The request to parse
 * @returns FormData object
 */
export async function parseFormData(request: Request): Promise<FormData> {
  return await request.formData()
}

/**
 * Parse text body from request
 *
 * @param request - The request to parse
 * @returns Text content
 */
export async function parseText(request: Request): Promise<string> {
  return await request.text()
}

/**
 * Get a single query parameter value
 *
 * @param context - EdgeContext with query parameters
 * @param key - Parameter name
 * @returns Parameter value or null
 */
export function getQueryParam(
  context: EdgeContext,
  key: string
): string | null {
  return context.query.get(key)
}

/**
 * Get all values for a query parameter
 *
 * @param context - EdgeContext with query parameters
 * @param key - Parameter name
 * @returns Array of parameter values
 */
export function getQueryParams(
  context: EdgeContext,
  key: string
): string[] {
  return context.query.getAll(key)
}

/**
 * Get a route parameter value
 *
 * @param context - EdgeContext with route parameters
 * @param key - Parameter name
 * @returns Parameter value or undefined
 */
export function getParam(
  context: EdgeContext,
  key: string
): string | undefined {
  return context.params[key]
}
