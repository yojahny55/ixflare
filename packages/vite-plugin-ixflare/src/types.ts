/**
 * @module types
 * @description Plugin type definitions
 */

import type { MiniflareConfig } from './dev-server'

export interface IxflarePluginOptions {
  /** Routes directory (default: 'src/routes') */
  routesDir?: string
  /** Enable SSR (default: false) */
  ssr?: boolean
  /** Enable HMR (default: true) */
  hmr?: boolean
  /** Miniflare configuration for local development */
  miniflare?: MiniflareConfig
}

export type { MiniflareConfig } from './dev-server'
