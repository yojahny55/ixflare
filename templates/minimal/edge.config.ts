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

  // Lifecycle hooks for build and deployment customization:
  // hooks: {
  //   'pre-build': async () => {
  //     // Run before build starts (e.g., code generation, validation)
  //     console.log('Starting build...')
  //   },
  //   'post-build': async ({ outputPath }) => {
  //     // Run after build completes (e.g., upload sourcemaps, generate reports)
  //     console.log(`Build output: ${outputPath}`)
  //   },
  //   'pre-deploy': async ({ environment }) => {
  //     // Run before deployment (e.g., run migrations, backup data)
  //     console.log(`Deploying to ${environment}...`)
  //   },
  //   'post-deploy': async ({ url }) => {
  //     // Run after deployment (e.g., notify team, run smoke tests)
  //     console.log(`Deployed to ${url}`)
  //   },
  // },

  // Custom CLI commands:
  // commands: {
  //   'db:seed': {
  //     description: 'Seed the database with test data',
  //     handler: async () => {
  //       console.log('Seeding database...')
  //       // Your seeding logic here
  //     },
  //   },
  // },
})
