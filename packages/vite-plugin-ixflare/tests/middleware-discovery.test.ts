import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverMiddleware, extractMiddlewareChain, type MiddlewareNode } from '../src/middleware-discovery'

describe('middleware-discovery', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = join(tmpdir(), `middleware-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('discoverMiddleware', () => {
    it('should discover root middleware file', async () => {
      // Create _middleware.ts at root
      await writeFile(
        join(tempDir, '_middleware.ts'),
        'export const middleware = []'
      )

      const middlewares = await discoverMiddleware(tempDir)

      expect(middlewares).toHaveLength(1)
      expect(middlewares[0].file).toBe('_middleware.ts')
      expect(middlewares[0].parentDir).toBe('')
      expect(middlewares[0].depth).toBe(0)
      expect(middlewares[0].isArray).toBe(true)
    })

    it('should discover nested middleware files', async () => {
      // Create directory structure
      await mkdir(join(tempDir, 'api'), { recursive: true })
      await mkdir(join(tempDir, 'api', 'admin'), { recursive: true })

      // Create middleware files
      await writeFile(join(tempDir, '_middleware.ts'), 'export const middleware = []')
      await writeFile(join(tempDir, 'api', '_middleware.ts'), 'export const middleware = []')
      await writeFile(join(tempDir, 'api', 'admin', '_middleware.ts'), 'export const middleware = []')

      const middlewares = await discoverMiddleware(tempDir)

      expect(middlewares).toHaveLength(3)

      // Should be sorted by depth
      expect(middlewares[0].depth).toBe(0)
      expect(middlewares[1].depth).toBe(1)
      expect(middlewares[2].depth).toBe(2)

      expect(middlewares[0].file).toBe('_middleware.ts')
      expect(middlewares[1].file).toBe('api/_middleware.ts')
      expect(middlewares[2].file).toBe('api/admin/_middleware.ts')
    })

    it('should detect single middleware export', async () => {
      await writeFile(
        join(tempDir, '_middleware.ts'),
        'export const middleware = createMiddleware(async (ctx, next) => next())'
      )

      const middlewares = await discoverMiddleware(tempDir)

      expect(middlewares[0].isArray).toBe(false)
    })

    it('should detect array middleware export', async () => {
      await writeFile(
        join(tempDir, '_middleware.ts'),
        'export const middleware: Middleware[] = [auth, logging]'
      )

      const middlewares = await discoverMiddleware(tempDir)

      expect(middlewares[0].isArray).toBe(true)
    })

    it('should handle empty routes directory', async () => {
      const middlewares = await discoverMiddleware(tempDir)
      expect(middlewares).toHaveLength(0)
    })

    it('should support all valid extensions', async () => {
      await writeFile(join(tempDir, '_middleware.ts'), 'export const middleware = []')
      await mkdir(join(tempDir, 'api'))
      await writeFile(join(tempDir, 'api', '_middleware.tsx'), 'export const middleware = []')
      await mkdir(join(tempDir, 'blog'))
      await writeFile(join(tempDir, 'blog', '_middleware.js'), 'export const middleware = []')
      await mkdir(join(tempDir, 'admin'))
      await writeFile(join(tempDir, 'admin', '_middleware.jsx'), 'export const middleware = []')

      const middlewares = await discoverMiddleware(tempDir)

      expect(middlewares).toHaveLength(4)
      expect(middlewares.map(m => m.file).sort()).toEqual([
        '_middleware.ts',
        'admin/_middleware.jsx',
        'api/_middleware.tsx',
        'blog/_middleware.js',
      ])
    })
  })

  describe('extractMiddlewareChain', () => {
    let middlewares: MiddlewareNode[]

    beforeEach(async () => {
      // Create directory structure
      await mkdir(join(tempDir, 'api'), { recursive: true })
      await mkdir(join(tempDir, 'api', 'admin'), { recursive: true })
      await mkdir(join(tempDir, 'blog'), { recursive: true })

      // Create middleware files
      await writeFile(join(tempDir, '_middleware.ts'), 'export const middleware = []')
      await writeFile(join(tempDir, 'api', '_middleware.ts'), 'export const middleware = []')
      await writeFile(join(tempDir, 'api', 'admin', '_middleware.ts'), 'export const middleware = []')
      await writeFile(join(tempDir, 'blog', '_middleware.ts'), 'export const middleware = []')

      middlewares = await discoverMiddleware(tempDir)
    })

    it('should extract root middleware for root route', () => {
      const chain = extractMiddlewareChain('index.ts', middlewares)

      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe('_middleware.ts')
    })

    it('should extract middleware chain for nested route', () => {
      const chain = extractMiddlewareChain('api/admin/users.ts', middlewares)

      expect(chain).toHaveLength(3)
      expect(chain[0]).toBe('_middleware.ts') // Root
      expect(chain[1]).toBe('api/_middleware.ts') // /api
      expect(chain[2]).toBe('api/admin/_middleware.ts') // /api/admin
    })

    it('should extract partial chain for intermediate route', () => {
      const chain = extractMiddlewareChain('api/users.ts', middlewares)

      expect(chain).toHaveLength(2)
      expect(chain[0]).toBe('_middleware.ts') // Root
      expect(chain[1]).toBe('api/_middleware.ts') // /api
    })

    it('should not include unrelated middleware', () => {
      const chain = extractMiddlewareChain('api/users.ts', middlewares)

      // Should not include blog/_middleware.ts or api/admin/_middleware.ts
      expect(chain).not.toContain('blog/_middleware.ts')
      expect(chain).not.toContain('api/admin/_middleware.ts')
    })

    it('should return empty chain for route without middleware', () => {
      const chain = extractMiddlewareChain('about/team.ts', middlewares)

      // Should only get root middleware
      expect(chain).toHaveLength(1)
      expect(chain[0]).toBe('_middleware.ts')
    })

    it('should handle Windows-style paths', () => {
      const chain = extractMiddlewareChain('api\\admin\\users.ts', middlewares)

      expect(chain).toHaveLength(3)
      expect(chain[0]).toBe('_middleware.ts')
      expect(chain[1]).toBe('api/_middleware.ts')
      expect(chain[2]).toBe('api/admin/_middleware.ts')
    })
  })
})
