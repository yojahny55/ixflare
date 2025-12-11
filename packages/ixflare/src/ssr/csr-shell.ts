/**
 * @module ssr/csr-shell
 * @description CSR (Client-Side Rendering) static shell generation
 * @packageDocumentation
 */

import { escapeHtml, buildAttributes } from './html-utils'

/**
 * Options for generating CSR shell
 */
export interface CSRShellOptions {
  /** Document title */
  title?: string
  /** Language attribute for html element (default: 'en') */
  lang?: string
  /** Additional meta tags */
  meta?: Record<string, string>
  /** Path to client bundle script */
  scriptSrc: string
  /** Additional attributes for the <html> element */
  htmlAttributes?: Record<string, string>
  /** Additional attributes for the <body> element */
  bodyAttributes?: Record<string, string>
  /** Mount point ID for React root (default: 'root') */
  mountId?: string
  /** CSS stylesheet URLs to include (prevents FOUC) */
  stylesheets?: string[]
  /** Inline CSS styles to include in <style> tag (prevents FOUC) */
  inlineStyles?: string
}

/**
 * Generate minimal HTML shell for CSR (Client-Side Rendering)
 * Returns static HTML with mount point and client bundle script
 * No server-side React rendering occurs
 *
 * @param options CSR shell configuration
 * @returns Complete HTML document string
 * @example
 * ```typescript
 * const shell = generateCSRShell({
 *   title: 'Dashboard',
 *   scriptSrc: '/client.js',
 *   meta: { description: 'User dashboard' }
 * })
 * // Returns:
 * // <!DOCTYPE html>
 * // <html lang="en">
 * // <head>
 * //   <meta charset="utf-8"/>
 * //   <meta name="viewport" content="width=device-width, initial-scale=1"/>
 * //   <title>Dashboard</title>
 * //   <meta name="description" content="User dashboard"/>
 * // </head>
 * // <body>
 * //   <div id="root"></div>
 * //   <script type="module" src="/client.js"></script>
 * // </body>
 * // </html>
 * ```
 */
export function generateCSRShell(options: CSRShellOptions): string {
  const lang = options.lang ?? 'en'
  const mountId = options.mountId ?? 'root'
  const title = options.title ? `<title>${escapeHtml(options.title)}</title>` : ''
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1"/>'

  // Build meta tags
  let metaTags = ''
  if (options.meta) {
    for (const [name, content] of Object.entries(options.meta)) {
      metaTags += `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}"/>`
    }
  }

  // Build stylesheet links (prevents FOUC)
  let stylesheetLinks = ''
  if (options.stylesheets) {
    for (const href of options.stylesheets) {
      stylesheetLinks += `<link rel="stylesheet" href="${escapeHtml(href)}"/>`
    }
  }

  // Build inline styles (prevents FOUC)
  const inlineStyles = options.inlineStyles ? `<style>${options.inlineStyles}</style>` : ''

  // Build extensible html and body attributes
  const htmlAttrs = buildAttributes(options.htmlAttributes)
  const bodyAttrs = buildAttributes(options.bodyAttributes)

  // Escape scriptSrc for security
  const safeScriptSrc = escapeHtml(options.scriptSrc)

  return `<!DOCTYPE html>
<html lang="${lang}"${htmlAttrs}>
<head>
  <meta charset="utf-8"/>
  ${viewport}
  ${title}
  ${metaTags}
  ${stylesheetLinks}
  ${inlineStyles}
</head>
<body${bodyAttrs}>
  <div id="${escapeHtml(mountId)}"></div>
  <script type="module" src="${safeScriptSrc}"></script>
</body>
</html>`
}

/**
 * Create Response object with CSR shell
 * @param options CSR shell configuration
 * @returns Response with HTML shell
 * @example
 * ```typescript
 * export function GET() {
 *   return createCSRShellResponse({
 *     title: 'App',
 *     scriptSrc: '/dist/client.js'
 *   })
 * }
 * ```
 */
export function createCSRShellResponse(options: CSRShellOptions): Response {
  const html = generateCSRShell(options)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
