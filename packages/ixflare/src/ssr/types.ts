/**
 * @module ssr/types
 * @description SSR type definitions
 */

export interface RenderOptions {
  /** Enable streaming SSR */
  streaming?: boolean
  /** Data to inject for hydration (will be safely escaped) */
  bootstrapData?: unknown
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal
  /** Bootstrap scripts to include */
  bootstrapScripts?: string[]
  /** Error handler for rendering errors */
  onError?: (error: unknown) => void
  /** Document title for the HTML page */
  title?: string
  /** Additional meta tags to include in head */
  meta?: Record<string, string>
  /** Language attribute for html element (default: 'en') */
  lang?: string
}

export interface RenderResult {
  /** HTML string result (for renderToString) */
  html?: string
  /** ReadableStream result (for renderToStream) */
  stream?: ReadableStream
}

export interface PageProps<T = unknown> {
  /** Data from loader function */
  data: T
  /** Search params from URL */
  searchParams?: Record<string, string>
  /** Route params */
  params?: Record<string, string>
}

export interface LoaderContext {
  /** Request object */
  request: Request
  /** Route params */
  params: Record<string, string>
  /** Search params */
  searchParams: URLSearchParams
  /** Cloudflare context */
  env?: unknown
  /** Execution context */
  ctx?: ExecutionContext
}

export interface IslandConfig {
  /** Unique island identifier */
  id: string
  /** React component to hydrate */
  component: unknown
  /** Props for the component */
  props?: Record<string, unknown>
  /** Loading strategy */
  load?: 'idle' | 'visible' | 'immediate'
}
