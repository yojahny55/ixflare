import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateRouteTypes, generateModelTypes } from '../../src/commands/generate-types'

describe('generate:types integration', () => {
  let testDir: string

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ixflare-test-'))
  })

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
  })

  describe('generateRouteTypes', () => {
    it('should generate route types for routes with dynamic parameters', async () => {
      // Setup: Create test routes directory structure
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      // Create test route files
      await mkdir(join(routesDir, 'users'), { recursive: true })
      await writeFile(join(routesDir, 'users', '[userId].tsx'), 'export function GET() {}', 'utf-8')

      await mkdir(join(routesDir, 'users', '[userId]', 'posts'), { recursive: true })
      await writeFile(
        join(routesDir, 'users', '[userId]', 'posts', '[postId].tsx'),
        'export function GET() {}',
        'utf-8'
      )

      // Act: Generate types
      const outputPath = await generateRouteTypes(testDir)

      // Assert: Check generated file exists and contains correct types
      const content = await readFile(outputPath, 'utf-8')

      expect(content).toContain('Route type definitions')
      expect(content).toContain("declare module '@/routes/users/[userId]'")
      expect(content).toContain('export interface Params')
      expect(content).toContain('userId: string')
      expect(content).toContain("declare module '@/routes/users/[userId]/posts/[postId]'")
      expect(content).toContain('postId: string')
    })

    it('should generate types for optional parameters', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await mkdir(join(routesDir, 'docs'), { recursive: true })
      await writeFile(join(routesDir, 'docs', '[[optional]].tsx'), 'export function GET() {}', 'utf-8')

      const outputPath = await generateRouteTypes(testDir)
      const content = await readFile(outputPath, 'utf-8')

      expect(content).toContain("declare module '@/routes/docs/[[optional]]'")
      expect(content).toContain('optional?: string')
    })

    it('should generate types for catch-all parameters', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await mkdir(join(routesDir, 'docs'), { recursive: true })
      await writeFile(join(routesDir, 'docs', '[...slug].tsx'), 'export function GET() {}', 'utf-8')

      const outputPath = await generateRouteTypes(testDir)
      const content = await readFile(outputPath, 'utf-8')

      expect(content).toContain("declare module '@/routes/docs/[...slug]'")
      expect(content).toContain('slug: string[]')
    })

    it('should generate types for optional catch-all parameters', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await mkdir(join(routesDir, 'docs'), { recursive: true })
      await writeFile(join(routesDir, 'docs', '[[...slug]].tsx'), 'export function GET() {}', 'utf-8')

      const outputPath = await generateRouteTypes(testDir)
      const content = await readFile(outputPath, 'utf-8')

      expect(content).toContain("declare module '@/routes/docs/[[...slug]]'")
      expect(content).toContain('slug?: string[]')
    })

    it('should not generate types for static routes', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await writeFile(join(routesDir, 'index.tsx'), 'export function GET() {}', 'utf-8')
      await writeFile(join(routesDir, 'about.tsx'), 'export function GET() {}', 'utf-8')

      const outputPath = await generateRouteTypes(testDir)
      const content = await readFile(outputPath, 'utf-8')

      // Should contain header but no module declarations
      expect(content).toContain('Route type definitions')
      expect(content).not.toContain('declare module')
    })

    it('should exclude test files and private files', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await writeFile(join(routesDir, '[userId].test.tsx'), 'export function GET() {}', 'utf-8')
      await writeFile(join(routesDir, '_private.tsx'), 'export function GET() {}', 'utf-8')
      await writeFile(join(routesDir, '[validId].tsx'), 'export function GET() {}', 'utf-8')

      const outputPath = await generateRouteTypes(testDir)
      const content = await readFile(outputPath, 'utf-8')

      expect(content).not.toContain('[userId].test.tsx')
      expect(content).not.toContain('_private')
      expect(content).toContain('[validId]')
    })

    it('should support custom output directory', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await writeFile(join(routesDir, '[userId].tsx'), 'export function GET() {}', 'utf-8')

      const customOutput = 'custom/output'
      const outputPath = await generateRouteTypes(testDir, customOutput)

      expect(outputPath).toBe(join(testDir, customOutput, 'routes.d.ts'))

      const content = await readFile(outputPath, 'utf-8')
      expect(content).toContain('userId: string')
    })

    it('should throw error if routes directory does not exist', async () => {
      await expect(generateRouteTypes(testDir)).rejects.toThrow(
        'Routes directory not found'
      )
    })

    it('should throw error if no route files found', async () => {
      const routesDir = join(testDir, 'src', 'routes')
      await mkdir(routesDir, { recursive: true })

      await expect(generateRouteTypes(testDir)).rejects.toThrow(
        'No route files found'
      )
    })
  })

  describe('generateModelTypes', () => {
    it('should create model types file', async () => {
      const outputPath = await generateModelTypes(testDir)

      expect(outputPath).toBe(join(testDir, 'src', 'types', 'models.d.ts'))

      const content = await readFile(outputPath, 'utf-8')
      expect(content).toContain('Model type definitions')
    })

    it('should support custom output directory', async () => {
      const customOutput = 'custom/output'
      const outputPath = await generateModelTypes(testDir, customOutput)

      expect(outputPath).toBe(join(testDir, customOutput, 'models.d.ts'))

      const content = await readFile(outputPath, 'utf-8')
      expect(content).toContain('Model type definitions')
    })
  })
})
