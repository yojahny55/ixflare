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
  /** Document title for the HTML page (ignored if shell: false) */
  title?: string
  /** Additional meta tags to include in head (ignored if shell: false) */
  meta?: Record<string, string>
  /** Language attribute for html element (default: 'en', ignored if shell: false) */
  lang?: string
  /**
   * Additional attributes for the <html> element (ignored if shell: false).
   * Useful for Tailwind dark mode (class="dark"), dir="rtl", etc.
   * Values are HTML-escaped for security.
   * @example { class: 'dark', dir: 'rtl' }
   */
  htmlAttributes?: Record<string, string>
  /**
   * Additional attributes for the <body> element (ignored if shell: false).
   * Useful for theme classes, data attributes, etc.
   * Values are HTML-escaped for security.
   * @example { class: 'bg-white dark:bg-gray-900' }
   */
  bodyAttributes?: Record<string, string>
  /**
   * Whether to wrap output in HTML document shell (<!DOCTYPE html><html>...</html>).
   * - true (default): Full HTML document with DOCTYPE, head, body
   * - false: Raw component output only (for fragments, HTMX, or components with own shell)
   */
  shell?: boolean
  /** Callback when shell HTML is ready (before Suspense content) */
  onShellReady?: () => void
  /** Callback when all content (including Suspense) is ready */
  onAllReady?: () => void
  /** Chunk size for progressive streaming (bytes) */
  progressiveChunkSize?: number
  /** Timeout in ms after which render aborts and flushes fallbacks */
  timeoutMs?: number
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

/** Island loading strategy - when to hydrate on the client */
export type IslandLoadStrategy = 'idle' | 'visible' | 'immediate'

export interface IslandConfig {
  /** Unique island identifier */
  id: string
  /** React component to hydrate */
  component: unknown
  /** Props for the component */
  props?: Record<string, unknown>
  /** Loading strategy */
  load?: IslandLoadStrategy
}

/** HTML attributes for island marker element */
export interface IslandMarkerProps {
  /** Island identifier */
  'data-island': string
  /** Serialized props (JSON) */
  'data-props': string
  /** Loading strategy */
  'data-load'?: IslandLoadStrategy
}

/** Hydration manifest for client-side hydration */
export interface HydrationManifest {
  /** Map of island ID to hydration metadata */
  islands: Record<
    string,
    {
      /** Chunk file path for code-splitting */
      chunk: string
      /** Array of prop keys for this island */
      props: string[]
      /** HTML marker ID for DOM query */
      marker: string
    }
  >
}

/** Registry entry for discovered islands */
export interface IslandRegistryEntry {
  /** Island identifier */
  id: string
  /** Path to component file */
  componentPath: string
  /** Component props */
  props: Record<string, unknown>
  /** Loading strategy */
  load: IslandLoadStrategy
}
