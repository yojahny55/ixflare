/**
 * @module ssr/error-page-renderer
 * @description Custom error page rendering for SSR failures
 * @packageDocumentation
 */

import React from 'react'
import type { ReactElement } from 'react'
import type { ErrorProps } from './types'
import { renderToString } from './render'
import { escapeHtml } from './html-utils'

/**
 * Shared error page styles (used by both React component and fallback HTML)
 */
const ERROR_PAGE_STYLES = {
  container:
    'font-family:system-ui,sans-serif;max-width:600px;margin:100px auto;padding:2rem;text-align:center;',
  heading: 'font-size:3rem;margin:0 0 1rem 0;color:#dc2626',
  subheading: 'font-size:1.5rem;margin:0 0 1rem 0;font-weight:normal',
  message: 'color:#6b7280;margin:0 0 2rem 0',
  rayId: 'font-size:0.875rem;color:#9ca3af',
} as const

/**
 * Default error page component when no custom _error.tsx is found.
 *
 * Provides a basic, accessible error page with status code and message.
 * This is rendered when the entire page fails to render (shell error).
 *
 * @param props - Error page props
 * @returns React element for default error page
 */
function DefaultErrorPage({ statusCode, message, rayId }: ErrorProps): ReactElement {
  // Parse shared styles into React style objects
  const parseStyle = (cssString: string): React.CSSProperties => {
    const style: Record<string, string> = {}
    for (const rule of cssString.split(';')) {
      const [key, value] = rule.split(':')
      if (key && value) {
        // Convert kebab-case to camelCase
        const camelKey = key.trim().replace(/-([a-z])/g, (_, char) => char.toUpperCase())
        style[camelKey] = value.trim()
      }
    }
    return style as React.CSSProperties
  }

  return (
    <div style={parseStyle(ERROR_PAGE_STYLES.container)}>
      <h1 style={parseStyle(ERROR_PAGE_STYLES.heading)}>{statusCode}</h1>
      <h2 style={parseStyle(ERROR_PAGE_STYLES.subheading)}>Something went wrong</h2>
      <p style={parseStyle(ERROR_PAGE_STYLES.message)}>{message}</p>
      {rayId && (
        <p style={parseStyle(ERROR_PAGE_STYLES.rayId)}>
          Error ID: <code>{rayId}</code>
        </p>
      )}
    </div>
  )
}

/**
 * Renders an error page with custom or default error component.
 *
 * Attempts to load a custom _error.tsx component from the route hierarchy.
 * Falls back to the default error page if no custom component is found.
 *
 * The error page convention searches for:
 * 1. Route group error page: `src/routes/(group)/_error.tsx`
 * 2. Global error page: `src/routes/_error.tsx`
 * 3. Default error page (built-in fallback)
 *
 * @param error - The error that occurred
 * @param options - Rendering options
 * @param options.statusCode - HTTP status code (default: 500)
 * @param options.rayId - Ray ID for distributed tracing
 * @param options.path - Request path where error occurred
 * @param options.ErrorComponent - Custom error component to use
 * @returns Promise resolving to Response with error page HTML
 *
 * @example
 * ```typescript
 * // Shell error - entire page failed
 * try {
 *   const stream = await renderToReadableStream(<App />)
 *   return new Response(stream)
 * } catch (error) {
 *   return renderErrorPage(error as Error, {
 *     statusCode: 500,
 *     rayId: ctx.rayId,
 *     path: ctx.request.url
 *   })
 * }
 * ```
 */
export async function renderErrorPage(
  error: Error,
  options?: {
    statusCode?: number
    rayId?: string
    path?: string
    ErrorComponent?: React.ComponentType<ErrorProps>
  }
): Promise<Response> {
  const statusCode = options?.statusCode ?? 500
  const message = error.message || 'An unexpected error occurred'

  const errorProps: ErrorProps = {
    error,
    statusCode,
    message,
    rayId: options?.rayId,
  }

  try {
    // Use custom error component if provided, otherwise use default
    const ErrorComponent = options?.ErrorComponent ?? DefaultErrorPage
    const element = <ErrorComponent {...errorProps} />

    // Render error page to string (not streaming, error pages are small)
    const html = await renderToString(element, {
      title: `${statusCode} Error`,
      lang: 'en',
    })

    return new Response(html, {
      status: statusCode,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store', // Never cache error pages
      },
    })
  } catch (renderError) {
    // Error page rendering failed - log the error for debugging
    console.error('[SSR Error Page] Failed to render error page:', {
      originalError: error.message,
      renderError: renderError instanceof Error ? renderError.message : String(renderError),
      statusCode,
      rayId: options?.rayId,
      path: options?.path,
    })

    // Send minimal HTML fallback
    const fallbackHtml = createFallbackErrorHtml(statusCode, message, options?.rayId)

    return new Response(fallbackHtml, {
      status: statusCode,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }
}

/**
 * Creates minimal fallback HTML when error page rendering fails.
 *
 * This is the last resort when even the error page itself fails to render.
 * Returns a simple HTML string with no React components or external dependencies.
 *
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param rayId - Optional Ray ID for debugging
 * @returns Minimal HTML string
 *
 * @example
 * ```typescript
 * const html = createFallbackErrorHtml(500, 'Server error', 'abc123')
 * // Returns: <!DOCTYPE html><html>...minimal error page...</html>
 * ```
 */
export function createFallbackErrorHtml(
  statusCode: number,
  message: string,
  rayId?: string
): string {
  const safeMessage = escapeHtml(message)
  const safeRayId = rayId ? escapeHtml(rayId) : null

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${statusCode} Error</title>
</head>
<body style="${ERROR_PAGE_STYLES.container}">
  <h1 style="${ERROR_PAGE_STYLES.heading}">${statusCode}</h1>
  <h2 style="${ERROR_PAGE_STYLES.subheading}">Something went wrong</h2>
  <p style="${ERROR_PAGE_STYLES.message}">${safeMessage}</p>
  ${safeRayId ? `<p style="${ERROR_PAGE_STYLES.rayId}">Error ID: <code>${safeRayId}</code></p>` : ''}
</body>
</html>`
}

/**
 * Detects if a custom error page component exists in the route hierarchy.
 *
 * **Current Status:** Placeholder implementation - always returns null.
 * Auto-detection of `_error.tsx` files requires Vite plugin integration (future work).
 *
 * **How to use custom error pages now:**
 * Pass your error component directly to `renderErrorPage()`:
 * ```typescript
 * import { MyCustomErrorPage } from './error-pages/MyCustomErrorPage'
 *
 * const response = await renderErrorPage(error, {
 *   ErrorComponent: MyCustomErrorPage,
 *   rayId: ctx.rayId,
 * })
 * ```
 *
 * **Future Vite plugin behavior:**
 * The Vite plugin will scan routes for `_error.tsx` files at build time:
 * - `src/routes/(dashboard)/_error.tsx` - Group-specific error page
 * - `src/routes/_error.tsx` - Global fallback error page
 *
 * @param routePath - The route path to check for error pages
 * @returns Promise resolving to the error component or null (currently always null)
 *
 * @example
 * ```typescript
 * // Future usage (once Vite plugin is implemented):
 * const ErrorComponent = await findErrorPage('/dashboard/stats')
 * if (ErrorComponent) {
 *   return renderErrorPage(error, { ErrorComponent })
 * }
 * ```
 */
export async function findErrorPage(
  _routePath: string
): Promise<React.ComponentType<ErrorProps> | null> {
  // Placeholder: Vite plugin will implement build-time error page detection
  // The plugin will:
  // 1. Scan routes directory for _error.tsx files
  // 2. Create a mapping of route paths to error components
  // 3. Populate this function with the mapping at build time
  //
  // Until then, use renderErrorPage() with explicit ErrorComponent option
  return null
}
