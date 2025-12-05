import { defineConfig } from 'ixflare'

/**
 * Ixflare Configuration - Minimal
 *
 * A minimal configuration for getting started quickly.
 * Add more options as your project grows.
 *
 * See https://ixflare.dev/docs/configuration for all options.
 */
export default defineConfig({
  // Application name (required)
  name: '{{projectName}}',

  // Uncomment to configure database, cache, or security:
  // database: { binding: 'DB' },
  // cache: { binding: 'CACHE', defaultTtl: 3600 },
  // security: { csrf: true, headers: true },
})
