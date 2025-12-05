import { defineConfig } from 'ixflare'

/**
 * Ixflare Configuration - API Backend
 *
 * Optimized configuration for API-focused applications.
 * Environment variables are loaded with the following precedence:
 * 1. wrangler.toml [vars] (highest)
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
    defaultTtl: 300, // 5 minute TTL for API responses
  },

  // Security settings
  security: {
    csrf: false, // Disable CSRF for stateless API (use API keys/JWT instead)
    headers: true, // Auto-inject security headers
  },
})
