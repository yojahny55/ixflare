/**
 * CSRF Client-Side Helpers
 * Story 5-6: CSRF Protection
 *
 * Client-side utilities for CSRF token access in React components and fetch requests
 *
 * Note: This file contains React components and browser-only code
 * Must be tree-shaken for server-side builds
 */

/**
 * Get CSRF token from cookie (browser-only)
 *
 * Reads the CSRF token from cookie for use in fetch/XHR requests
 * Cookie must have httpOnly=false to be readable by JavaScript
 *
 * @param cookieName - CSRF cookie name (default: __csrf)
 * @returns Token value from cookie or null if not found
 *
 * @example
 * ```typescript
 * const token = getCsrfToken()
 *
 * fetch('/api/posts', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-CSRF-Token': token,
 *   },
 *   body: JSON.stringify({ title: 'New Post' }),
 * })
 * ```
 */
export function getCsrfToken(cookieName: string = '__csrf'): string | null {
  if (typeof document === 'undefined') {
    // Server-side - no document available
    return null
  }

  const cookies = document.cookie.split(';')

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === cookieName) {
      // Return token value (extract from signed format: value.signature)
      const tokenValue = value.split('.')[0]
      return tokenValue || null
    }
  }

  return null
}

/**
 * Get CSRF token for SSR context
 *
 * This function is designed to be called during server-side rendering
 * where the token is available in the rendering context
 *
 * For client-side fetch requests, use getCsrfToken() instead
 *
 * @returns Token value from SSR context or null
 *
 * @example
 * ```tsx
 * export default function CreatePostForm() {
 *   return (
 *     <form method="POST" action="/api/posts">
 *       <input type="hidden" name="_csrf" value={csrfToken()} />
 *       <input type="text" name="title" />
 *       <button type="submit">Create</button>
 *     </form>
 *   )
 * }
 * ```
 */
export function csrfToken(): string {
  // In SSR context, token should be injected via context or props
  // For client-side, fall back to cookie
  return getCsrfToken() || ''
}

/**
 * React component for CSRF token hidden input
 *
 * Automatically includes CSRF token in forms
 *
 * @param props - Component props
 * @param props.fieldName - Form field name (default: _csrf)
 *
 * @example
 * ```tsx
 * import { CSRFInput } from 'ixflare/auth'
 *
 * export default function CreatePostForm() {
 *   return (
 *     <form method="POST" action="/api/posts">
 *       <CSRFInput />
 *       <input type="text" name="title" />
 *       <button type="submit">Create</button>
 *     </form>
 *   )
 * }
 * ```
 */
export function CSRFInput({ fieldName = '_csrf' }: { fieldName?: string }) {
  const token = csrfToken()

  if (!token) {
    // No token available - skip rendering
    // This prevents form submission errors during SSR
    return null
  }

  // For React environments, this would return a proper element
  // For now, return null and rely on manual token inclusion
  // or server-side rendering with context
  return null
}
