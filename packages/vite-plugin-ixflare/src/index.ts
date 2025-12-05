/**
 * @module vite-plugin-ixflare
 * @description Vite plugin for Ixflare framework - file-based routing
 * @node-only
 *
 * This plugin provides file-based routing for Ixflare applications.
 * For Workers runtime (D1, KV, R2), use @cloudflare/vite-plugin.
 *
 * Usage:
 * ```typescript
 * import { cloudflare } from '@cloudflare/vite-plugin'
 * import { ixflare } from 'vite-plugin-ixflare'
 *
 * export default defineConfig({
 *   plugins: [
 *     cloudflare(),  // Workers runtime (Cloudflare-maintained)
 *     ixflare(),     // File-based routing (Ixflare)
 *   ],
 * })
 * ```
 *
 * See: docs/architecture/adr-001-cloudflare-vite-plugin-integration.md
 */

import { ixflarePlugin } from './plugin'

// Main plugin export
export { ixflarePlugin }
export { ixflarePlugin as ixflare } // Alias for cleaner import
export default ixflarePlugin

// Type exports
export type { IxflarePluginOptions } from './types'
export type { Route, RouteManifest, RouteParam, HttpMethod } from './router-codegen'
export type { DevServerConfig, DevServer } from './dev-server'
export type { BuildConfig, BuildResult } from './build'

/**
 * @deprecated MiniflareConfig is no longer used. Workers runtime is handled by @cloudflare/vite-plugin.
 * Configure bindings in wrangler.toml instead.
 */
export type { MiniflareConfig } from './types'
