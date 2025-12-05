import { defineConfig } from 'ixflare'

/**
 * Ixflare Configuration
 *
 * This file configures your Ixflare application. Environment variables are loaded
 * with the following precedence (highest to lowest):
 * 1. wrangler.toml [vars]
 * 2. .env.production (production only)
 * 3. .env.local (local overrides, gitignored)
 * 4. .env (defaults)
 */
export default defineConfig({
  // Application name (required)
  name: '{{projectName}}',

  // Database configuration (D1)
  database: {
    binding: 'DB', // D1 binding name from wrangler.toml
    warmup: true, // Enable connection warmup for faster cold starts
  },

  // Cache configuration (KV)
  cache: {
    binding: 'CACHE', // KV binding name from wrangler.toml
    defaultTtl: 3600, // Default TTL in seconds (1 hour)
  },

  // Security settings
  security: {
    csrf: true, // Enable CSRF protection
    headers: true, // Auto-inject security headers
  },

  // Lifecycle hooks (optional)
  // hooks: {
  //   'pre-build': () => console.log('Starting build...'),
  //   'post-build': ({ outputPath }) => console.log(`Built to ${outputPath}`),
  //   'pre-deploy': ({ environment }) => console.log(`Deploying to ${environment}`),
  //   'post-deploy': ({ url }) => console.log(`Deployed to ${url}`),
  // },

  // Custom CLI commands (optional)
  // commands: {
  //   'seed-db': {
  //     description: 'Seed the database with sample data',
  //     handler: async () => {
  //       console.log('Seeding database...')
  //     },
  //   },
  // },
})
