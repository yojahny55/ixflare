/**
 * @module ssr/types
 * @description SSR type definitions
 */

export interface RenderOptions {
  /** Enable streaming SSR */
  streaming?: boolean
  /** Data to inject for hydration */
  bootstrapData?: unknown
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
