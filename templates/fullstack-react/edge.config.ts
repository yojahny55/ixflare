import { defineConfig } from 'ixflare'

/**
 * Ixflare Configuration
 *
 * This file configures your Ixflare application. Environment variables are loaded
 * with the following precedence (highest to lowest):
 * 1. wrangler.toml [vars]
 * 2. .dev.vars (development only - Cloudflare Workers local secrets)
 * 3. .env.production (production only)
 * 4. .env.local (local overrides, gitignored)
 * 5. .env (defaults)
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

  // Lifecycle hooks for build and deployment customization (optional)
  // hooks: {
  //   'pre-build': async () => {
  //     // Run before build starts
  //     // Example: Generate types, validate config, run code generation
  //     console.log('Starting build...')
  //   },
  //   'post-build': async ({ outputPath }) => {
  //     // Run after build completes
  //     // Example: Upload sourcemaps, generate build reports, optimize assets
  //     console.log(`Built to ${outputPath}`)
  //   },
  //   'pre-deploy': async ({ environment }) => {
  //     // Run before deployment starts
  //     // Example: Run migrations, backup data, notify team
  //     console.log(`Deploying to ${environment}`)
  //   },
  //   'post-deploy': async ({ url }) => {
  //     // Run after deployment completes
  //     // Example: Run smoke tests, notify Slack, invalidate CDN cache
  //     console.log(`Deployed to ${url}`)
  //   },
  // },

  // Custom CLI commands (optional)
  // commands: {
  //   'db:seed': {
  //     description: 'Seed the database with sample data',
  //     handler: async () => {
  //       console.log('Seeding database...')
  //       // Your seeding logic here
  //     },
  //   },
  //   'cache:clear': {
  //     description: 'Clear all KV cache entries',
  //     handler: async () => {
  //       console.log('Clearing cache...')
  //       // Your cache clearing logic here
  //     },
  //   },
  // },
})
