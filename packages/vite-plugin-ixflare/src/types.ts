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
  /** Components directory for island discovery (default: 'src/components') */
  componentsDir?: string
  /** Enable HMR for route manifest and islands (default: true) */
  hmr?: boolean
  /**
   * Enable automatic route-based code splitting.
   *
   * - `'auto'` (default): Enabled only if frontend routes (*.tsx files) exist in routesDir
   * - `true`: Always enable code splitting
   * - `false`: Disable code splitting
   *
   * For API-only apps without frontend routes, this defaults to disabled.
   * This keeps bundle size minimal when only using API features.
   */
  codeSplitting?: boolean | 'auto'
  /**
   * Enable verbose logging for debugging.
   *
   * When enabled, logs detailed information about:
   * - Server-only code removal (which exports were stripped)
   * - .server file boundary enforcement
   * - Code splitting decisions
   *
   * @default false
   */
  verbose?: boolean
}
