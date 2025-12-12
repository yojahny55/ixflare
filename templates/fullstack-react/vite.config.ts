import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { ixflare } from 'vite-plugin-ixflare'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite Configuration for Ixflare Fullstack React Application
 *
 * Plugin Composition (ADR-001):
 * - @cloudflare/vite-plugin: Workers runtime (D1, KV, R2, workerd)
 * - vite-plugin-ixflare: File-based routing
 * - @vitejs/plugin-react: React JSX/TSX support
 * - @tailwindcss/vite: Tailwind CSS v4.1 (CSS-first configuration)
 *
 * Bindings are configured in wrangler.toml
 */
export default defineConfig({
  plugins: [
    // Cloudflare Workers runtime simulation (D1, KV, R2, Durable Objects)
    // Reads bindings from wrangler.toml automatically
    cloudflare(),

    // React JSX/TSX support with Fast Refresh
    react(),

    // Tailwind CSS v4.1 (CSS-first configuration via @theme directive)
    tailwindcss(),

    // Ixflare file-based routing
    // Discovers routes from src/routes/
    ixflare({
      routesDir: 'src/routes',
    }),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
