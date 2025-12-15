/**
 * CSRF Client-Side Helpers
 * Story 5-6: CSRF Protection
 *
 * Client-side utilities for CSRF token access in React components and fetch requests
 *
 * Note: This file contains React components and browser-only code
 * Must be tree-shaken for server-side builds
 */

import React from 'react'
import type { ReactElement } from 'react'

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
 * Props for creating a CSRF hidden input element
 *
 * Use these props to create a hidden input in your preferred way:
 * - Spread into JSX: <input {...getCSRFInputProps()} />
 * - Use with React.createElement
 * - Render as HTML string in SSR
 *
 * @example
 * ```tsx
 * import { getCSRFInputProps } from 'ixflare/auth'
 *
 * // Option 1: Spread into JSX
 * <input {...getCSRFInputProps()} />
 *
 * // Option 2: With custom field name
 * <input {...getCSRFInputProps('csrf_token')} />
 * ```
 */
export interface CSRFInputProps {
  type: 'hidden'
  name: string
  value: string
}

/**
 * Get props for a CSRF hidden input element
 *
 * Returns an object with type, name, and value that can be spread
 * into a JSX input element or used with React.createElement
 *
 * @param fieldName - Form field name (default: _csrf)
 * @returns Props object for hidden input, or null if no token available
 *
 * @example
 * ```tsx
 * import { getCSRFInputProps } from 'ixflare/auth'
 *
 * export default function CreatePostForm() {
 *   const csrfProps = getCSRFInputProps()
 *   return (
 *     <form method="POST" action="/api/posts">
 *       {csrfProps && <input {...csrfProps} />}
 *       <input type="text" name="title" />
 *       <button type="submit">Create</button>
 *     </form>
 *   )
 * }
 * ```
 */
export function getCSRFInputProps(fieldName: string = '_csrf'): CSRFInputProps | null {
  const token = csrfToken()

  if (!token) {
    // No token available - return null for conditional rendering
    return null
  }

  return {
    type: 'hidden',
    name: fieldName,
    value: token,
  }
}

/**
 * React component for CSRF token hidden input
 *
 * Automatically includes CSRF token in forms as a hidden input.
 * Returns null if no token is available (safe for SSR).
 *
 * @param props - Component props
 * @param props.fieldName - Form field name (default: _csrf)
 * @returns Hidden input React element or null
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
export function CSRFInput({ fieldName = '_csrf' }: { fieldName?: string }): ReactElement | null {
  const props = getCSRFInputProps(fieldName)
  if (!props) return null
  return <input {...props} />
}
