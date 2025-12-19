/**
 * Tests for vite.config.ts generator
 */

import { describe, it, expect } from 'vitest'
import { generateViteConfig } from '../../../src/commands/eject/vite-generator'
import type { EdgeConfig } from '../../../src/commands/eject/types'

describe('generateViteConfig', () => {
  it('should generate minimal vite.config.ts', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain("import { defineConfig } from 'vite'")
    expect(viteConfig).toContain("import { cloudflare } from '@cloudflare/vite-plugin'")
    expect(viteConfig).toContain('export default defineConfig({')
    expect(viteConfig).toContain('plugins: [')
    expect(viteConfig).toContain('cloudflare({')
  })

  it('should include React plugin when enabled', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      vite: {
        react: true,
      },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain("import react from '@vitejs/plugin-react'")
    expect(viteConfig).toContain('react()')
  })

  it('should not include React plugin when disabled', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      vite: {
        react: false,
      },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).not.toContain("import react from '@vitejs/plugin-react'")
    expect(viteConfig).not.toContain('react()')
  })

  it('should generate build configuration', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      vite: {
        build: {
          outDir: 'dist',
          target: 'esnext',
          minify: true,
          sourcemap: true,
        },
      },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain("outDir: 'dist'")
    expect(viteConfig).toContain("target: 'esnext'")
    expect(viteConfig).toContain('minify: true')
    expect(viteConfig).toContain('sourcemap: true')
  })

  it('should use default build configuration when not provided', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain("outDir: 'dist'")
    expect(viteConfig).toContain("target: 'esnext'")
    expect(viteConfig).toContain('minify: true')
    expect(viteConfig).toContain('sourcemap: true')
  })

  it('should generate warning for non-ejectable hooks', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      hooks: {
        'pre-build': () => {},
        'post-build': () => {},
      },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain('WARNING: Lifecycle hooks from edge.config.ts cannot be ejected')
    expect(viteConfig).toContain('custom build scripts')
  })

  it('should generate warning for non-ejectable commands', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      commands: {
        test: { description: 'Test', handler: () => {} },
      },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain('WARNING: Custom commands from edge.config.ts cannot be ejected')
    expect(viteConfig).toContain('package.json scripts')
  })

  it('should generate warning for non-ejectable middleware', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      middleware: [{}],
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain('WARNING: Global middleware from edge.config.ts cannot be ejected')
    expect(viteConfig).toContain('application code')
  })

  it('should generate warning for non-ejectable security config', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      security: {
        csrf: true,
        headers: true,
      },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain(
      'WARNING: Security configuration (CSRF, headers) from edge.config.ts cannot be ejected'
    )
  })

  it('should include all warnings when multiple non-ejectable features exist', () => {
    const config: EdgeConfig = {
      name: 'my-app',
      compatibilityDate: '2025-01-01',
      bindings: {},
      hooks: { 'pre-build': () => {} },
      commands: { test: { description: 'Test', handler: () => {} } },
      middleware: [{}],
      security: { csrf: true },
    }

    const viteConfig = generateViteConfig(config)

    expect(viteConfig).toContain('WARNING: Lifecycle hooks')
    expect(viteConfig).toContain('WARNING: Custom commands')
    expect(viteConfig).toContain('WARNING: Global middleware')
    expect(viteConfig).toContain('WARNING: Security configuration')
  })
})
