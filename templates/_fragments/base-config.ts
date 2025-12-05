/**
 * Shared Configuration Fragments for Ixflare Templates
 *
 * This file contains reusable configuration objects that are shared across
 * all template types (fullstack-react, api-backend, minimal).
 *
 * Usage: Templates should import and spread these configurations, then
 * override specific values as needed for their use case.
 */

/**
 * Base edge.config.ts configuration
 * Contains common settings for all Ixflare applications
 */
export const baseEdgeConfig = {
  name: '{{projectName}}',
  database: {
    binding: 'DB',
    warmup: true,
  },
  cache: {
    binding: 'CACHE',
    defaultTtl: 3600,
  },
  security: {
    csrf: true,
    headers: true,
  },
}

/**
 * Development environment settings
 */
export const devConfig = {
  port: 8787,
  hmr: true,
  sourceMaps: true,
}

/**
 * Production environment settings
 */
export const prodConfig = {
  minify: true,
  sourceMaps: false,
  treeshake: true,
}

/**
 * Base Vite configuration options
 * Common settings for Vite across all templates
 */
export const baseViteConfig = {
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}

/**
 * Base Wrangler configuration
 * Common settings for Cloudflare Workers
 */
export const baseWranglerConfig = {
  compatibility_date: '2024-12-01',
  main: 'src/index.ts',
  minify: true,
}
