/**
 * @module code-splitting.test
 * @description Unit tests for route-based code splitting configuration
 */

import { describe, it, expect } from 'vitest'
import { createRouteChunks, createRollupConfig } from '../src/code-splitting'

describe('createRouteChunks', () => {
  it('should assign route files to route-specific chunks', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Test basic route
    expect(manualChunks('/project/src/routes/index.tsx')).toBe('route-index')
    expect(manualChunks('/project/src/routes/about.tsx')).toBe('route-about')
    expect(manualChunks('/project/src/routes/contact.ts')).toBe('route-contact')
  })

  it('should handle nested route files', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Nested routes
    expect(manualChunks('/project/src/routes/blog/index.tsx')).toBe('route-blog-index')
    expect(manualChunks('/project/src/routes/blog/post.tsx')).toBe('route-blog-post')
    expect(manualChunks('/project/src/routes/admin/users/list.tsx')).toBe('route-admin-users-list')
  })

  it('should handle dynamic route segments', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Dynamic params
    expect(manualChunks('/project/src/routes/users/[id].tsx')).toBe('route-users-_id_')
    expect(manualChunks('/project/src/routes/blog/[slug].tsx')).toBe('route-blog-_slug_')
    expect(manualChunks('/project/src/routes/posts/[year]/[month].tsx')).toBe(
      'route-posts-_year_-_month_'
    )
  })

  it('should handle catch-all route segments', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Catch-all params
    expect(manualChunks('/project/src/routes/docs/[...slug].tsx')).toBe('route-docs-_slug_')
    expect(manualChunks('/project/src/routes/files/[...path].tsx')).toBe('route-files-_path_')
  })

  it('should assign React to react-vendor chunk', () => {
    const manualChunks = createRouteChunks('src/routes')

    // React vendor chunk
    expect(manualChunks('/project/node_modules/react/index.js')).toBe('react-vendor')
    expect(manualChunks('/project/node_modules/react-dom/client.js')).toBe('react-vendor')
    expect(manualChunks('/project/node_modules/react/jsx-runtime.js')).toBe('react-vendor')
  })

  it('should assign other node_modules to vendor chunk', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Other dependencies
    expect(manualChunks('/project/node_modules/zod/lib/index.mjs')).toBe('vendor')
    expect(manualChunks('/project/node_modules/fast-glob/out/index.js')).toBe('vendor')
    expect(manualChunks('/project/node_modules/@cloudflare/workers-types/index.d.ts')).toBe(
      'vendor'
    )
  })

  it('should return undefined for non-route/non-vendor files', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Framework code - should go to default chunk
    expect(manualChunks('/project/src/lib/utils.ts')).toBeUndefined()
    expect(manualChunks('/project/src/components/Button.tsx')).toBeUndefined()
    expect(manualChunks('/project/packages/ixflare/src/index.ts')).toBeUndefined()
  })

  it('should handle Windows-style paths', () => {
    const manualChunks = createRouteChunks('src\\routes')

    // Windows paths with backslashes
    expect(manualChunks('C:\\project\\src\\routes\\index.tsx')).toBe('route-index')
    expect(manualChunks('C:\\project\\src\\routes\\blog\\[slug].tsx')).toBe('route-blog-_slug_')
    expect(manualChunks('C:\\project\\node_modules\\react\\index.js')).toBe('react-vendor')
  })

  it('should handle empty route (index at root)', () => {
    const manualChunks = createRouteChunks('src/routes')

    // Root index should be 'route-index'
    expect(manualChunks('/project/src/routes/index.tsx')).toBe('route-index')
  })

  it('should handle custom routes directory', () => {
    const manualChunks = createRouteChunks('app/routes')

    // Custom directory
    expect(manualChunks('/project/app/routes/index.tsx')).toBe('route-index')
    expect(manualChunks('/project/app/routes/dashboard.tsx')).toBe('route-dashboard')

    // Should not match src/routes
    expect(manualChunks('/project/src/routes/index.tsx')).toBeUndefined()
  })
})

describe('createRollupConfig', () => {
  it('should return config with manualChunks when enabled', () => {
    const config = createRollupConfig({ routesDir: 'src/routes', enabled: true })

    expect(config.output).toBeDefined()
    expect(config.output.manualChunks).toBeDefined()
    expect(typeof config.output.manualChunks).toBe('function')
    expect(config.output.chunkFileNames).toBe('chunks/[name]-[hash].js')
    expect(config.output.entryFileNames).toBe('entries/[name]-[hash].js')
  })

  it('should return empty config when disabled', () => {
    const config = createRollupConfig({ enabled: false })

    expect(config).toEqual({})
  })

  it('should merge custom chunks with route chunks', () => {
    const customChunks = (id: string) => {
      if (id.includes('my-custom-lib')) {
        return 'custom-lib'
      }
      return undefined
    }

    const config = createRollupConfig({
      routesDir: 'src/routes',
      customChunks,
    })

    const manualChunks = config.output.manualChunks as (id: string) => string | undefined

    // Custom chunk takes priority
    expect(manualChunks('/project/node_modules/my-custom-lib/index.js')).toBe('custom-lib')

    // Route chunks still work
    expect(manualChunks('/project/src/routes/index.tsx')).toBe('route-index')

    // Vendor chunks still work (fallback)
    expect(manualChunks('/project/node_modules/zod/lib/index.js')).toBe('vendor')
  })

  it('should use default options when not specified', () => {
    const config = createRollupConfig()

    expect(config.output).toBeDefined()
    expect(config.output.manualChunks).toBeDefined()
  })
})
