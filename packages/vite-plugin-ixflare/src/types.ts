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
  /** Enable SSR (default: false) */
  ssr?: boolean
  /** Enable HMR for route manifest (default: true) */
  hmr?: boolean
}

/**
 * @deprecated MiniflareConfig is no longer used. Workers runtime is handled by @cloudflare/vite-plugin.
 * See docs/architecture/adr-001-cloudflare-vite-plugin-integration.md
 */
export interface MiniflareConfig {
  /** @deprecated Use wrangler.toml d1_databases binding */
  d1Databases?: string[]
  /** @deprecated Use wrangler.toml kv_namespaces binding */
  kvNamespaces?: string[]
  /** @deprecated Use wrangler.toml r2_buckets binding */
  r2Buckets?: string[]
  /** @deprecated Use wrangler.toml durable_objects binding */
  durableObjects?: Record<string, string>
}
