import { defineConfig } from 'ixflare'

/**
 * Ixflare Configuration - API Backend
 *
 * Optimized configuration for API-focused applications.
 * Environment variables are loaded with the following precedence:
 * 1. wrangler.toml [vars] (highest)
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
    defaultTtl: 300, // 5 minute TTL for API responses
  },

  // Security settings
  security: {
    csrf: false, // Disable CSRF for stateless API (use API keys/JWT instead)
    headers: true, // Auto-inject security headers
  },

  // Lifecycle hooks for build and deployment (optional)
  // hooks: {
  //   'pre-build': async () => {
  //     // Run before build starts
  //     // Example: Generate OpenAPI spec, validate schemas, run code generation
  //     console.log('Starting API build...')
  //   },
  //   'post-build': async ({ outputPath }) => {
  //     // Run after build completes
  //     // Example: Generate API docs, upload sourcemaps, analyze bundle size
  //     console.log(`API built to ${outputPath}`)
  //   },
  //   'pre-deploy': async ({ environment }) => {
  //     // Run before deployment starts
  //     // Example: Run database migrations, warm up cache, backup data
  //     console.log(`Deploying API to ${environment}`)
  //   },
  //   'post-deploy': async ({ url }) => {
  //     // Run after deployment completes
  //     // Example: Run smoke tests, update API documentation, notify monitoring
  //     console.log(`API deployed to ${url}`)
  //   },
  // },

  // Custom CLI commands for API operations (optional)
  // commands: {
  //   'db:seed': {
  //     description: 'Seed database with sample API data',
  //     handler: async () => {
  //       console.log('Seeding API database...')
  //       // Your seeding logic here
  //     },
  //   },
  //   'api:test': {
  //     description: 'Run API integration tests',
  //     handler: async () => {
  //       console.log('Running API tests...')
  //       // Your testing logic here
  //     },
  //   },
  //   'cache:warm': {
  //     description: 'Warm up API cache with common requests',
  //     handler: async () => {
  //       console.log('Warming cache...')
  //       // Your cache warming logic here
  //     },
  //   },
  // },
})
