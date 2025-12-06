/**
 * @module types
 * @description Plugin type definitions
 *
 * Note: Workers runtime configuration (D1, KV, R2) is handled by @cloudflare/vite-plugin.
 * This plugin focuses solely on file-based routing. See ADR-001.
 */

export interface IxflarePluginOptions {
  /** Routes directory (default: 'src/routes') */
  routesDir?: string
  /** Enable HMR for route manifest (default: true) */
  hmr?: boolean
}
