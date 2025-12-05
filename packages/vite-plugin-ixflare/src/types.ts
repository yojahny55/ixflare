/**
 * @module types
 * @description Plugin type definitions
 */

export interface IxflarePluginOptions {
  /** Routes directory */
  routesDir?: string
  /** Enable SSR */
  ssr?: boolean
  /** Enable HMR */
  hmr?: boolean
}
