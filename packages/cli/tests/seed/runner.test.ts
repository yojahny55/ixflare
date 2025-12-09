import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import {
  executeSeedFile,
  executeSeedFiles,
  formatSeedResults,
} from '../../src/seed/runner'
import type { SeedFileInfo } from '../../src/seed/discovery'
import type { SeedResult } from 'ixflare'

const TEST_DIR = join(__dirname, 'runner-test-temp')
const SEEDS_DIR = join(TEST_DIR, 'seeds')

describe('runner', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(SEEDS_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    vi.resetModules()
  })

  describe('executeSeedFile()', () => {
    it('should execute a valid seed file', async () => {
      const seedContent = `
        export default Object.assign(async () => {}, { __isSeed: true })
      `
      writeFileSync(join(SEEDS_DIR, 'test-seed.ts'), seedContent)

      const seedFile: SeedFileInfo = {
        path: join(SEEDS_DIR, 'test-seed.ts'),
        name: 'test-seed',
      }

      const result = await executeSeedFile(seedFile, 'development')

      expect(result.name).toBe('test-seed')
      expect(result.error).toBeUndefined()
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should return error for missing default export', async () => {
      const seedContent = `
        export const notDefault = () => {}
      `
      writeFileSync(join(SEEDS_DIR, 'no-default.ts'), seedContent)

      const seedFile: SeedFileInfo = {
        path: join(SEEDS_DIR, 'no-default.ts'),
        name: 'no-default',
      }

      const result = await executeSeedFile(seedFile, 'development')

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('No default export found')
    })

    it('should return error for non-seed function', async () => {
      const seedContent = `
        export default async () => {}
      `
      writeFileSync(join(SEEDS_DIR, 'not-seed.ts'), seedContent)

      const seedFile: SeedFileInfo = {
        path: join(SEEDS_DIR, 'not-seed.ts'),
        name: 'not-seed',
      }

      const result = await executeSeedFile(seedFile, 'development')

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('must export a function wrapped with seed()')
    })

    it('should respect environment restrictions', async () => {
      const seedContent = `
        const fn = async () => {}
        fn.__isSeed = true
        fn.environment = 'production'
        export default fn
      `
      writeFileSync(join(SEEDS_DIR, 'prod-only.ts'), seedContent)

      const seedFile: SeedFileInfo = {
        path: join(SEEDS_DIR, 'prod-only.ts'),
        name: 'prod-only',
      }

      const result = await executeSeedFile(seedFile, 'development')

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('not allowed in development environment')
    })

    it('should allow seed when environment matches', async () => {
      const seedContent = `
        const fn = async () => {}
        fn.__isSeed = true
        fn.environment = ['development', 'test']
        export default fn
      `
      writeFileSync(join(SEEDS_DIR, 'dev-test.ts'), seedContent)

      const seedFile: SeedFileInfo = {
        path: join(SEEDS_DIR, 'dev-test.ts'),
        name: 'dev-test',
      }

      const result = await executeSeedFile(seedFile, 'development')

      expect(result.error).toBeUndefined()
    })

    it('should capture seed execution errors', async () => {
      const seedContent = `
        const fn = async () => { throw new Error('Seed failed!') }
        fn.__isSeed = true
        export default fn
      `
      writeFileSync(join(SEEDS_DIR, 'failing.ts'), seedContent)

      const seedFile: SeedFileInfo = {
        path: join(SEEDS_DIR, 'failing.ts'),
        name: 'failing',
      }

      const result = await executeSeedFile(seedFile, 'development')

      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Seed failed!')
    })
  })

  describe('executeSeedFiles()', () => {
    it('should execute multiple seeds in order', async () => {
      const executionOrder: string[] = []

      const seed1Content = `
        const fn = async () => { global.testOrder = global.testOrder || []; global.testOrder.push('seed1') }
        fn.__isSeed = true
        export default fn
      `
      const seed2Content = `
        const fn = async () => { global.testOrder = global.testOrder || []; global.testOrder.push('seed2') }
        fn.__isSeed = true
        export default fn
      `
      writeFileSync(join(SEEDS_DIR, 'seed1.ts'), seed1Content)
      writeFileSync(join(SEEDS_DIR, 'seed2.ts'), seed2Content)

      const seedFiles: SeedFileInfo[] = [
        { path: join(SEEDS_DIR, 'seed1.ts'), name: 'seed1' },
        { path: join(SEEDS_DIR, 'seed2.ts'), name: 'seed2' },
      ]

      // Clear global state
      ;(global as Record<string, unknown>).testOrder = []

      const results = await executeSeedFiles(seedFiles, 'development')

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('seed1')
      expect(results[1].name).toBe('seed2')
      expect((global as Record<string, unknown>).testOrder).toEqual(['seed1', 'seed2'])

      // Cleanup
      delete (global as Record<string, unknown>).testOrder
    })

    it('should stop on first error', async () => {
      // Use unique filenames to avoid module caching between tests
      const uniqueId = Date.now()
      const seed1Content = `
        const fn = async () => { throw new Error('First seed error ${uniqueId}') }
        fn.__isSeed = true
        export default fn
      `
      const seed2Content = `
        const fn = async () => { global.seed2Ran = true }
        fn.__isSeed = true
        export default fn
      `
      writeFileSync(join(SEEDS_DIR, `error-seed-${uniqueId}.ts`), seed1Content)
      writeFileSync(join(SEEDS_DIR, `after-error-${uniqueId}.ts`), seed2Content)

      const seedFiles: SeedFileInfo[] = [
        { path: join(SEEDS_DIR, `error-seed-${uniqueId}.ts`), name: `error-seed-${uniqueId}` },
        { path: join(SEEDS_DIR, `after-error-${uniqueId}.ts`), name: `after-error-${uniqueId}` },
      ]

      ;(global as Record<string, unknown>).seed2Ran = false

      await expect(executeSeedFiles(seedFiles, 'development')).rejects.toThrow(
        `First seed error ${uniqueId}`
      )
      expect((global as Record<string, unknown>).seed2Ran).toBe(false)

      delete (global as Record<string, unknown>).seed2Ran
    })

    it('should call progress callback', async () => {
      const seedContent = `
        const fn = async () => {}
        fn.__isSeed = true
        export default fn
      `
      writeFileSync(join(SEEDS_DIR, 'progress.ts'), seedContent)

      const seedFiles: SeedFileInfo[] = [
        { path: join(SEEDS_DIR, 'progress.ts'), name: 'progress' },
      ]

      const progressCalls: Array<{ current: number; total: number; name: string }> = []

      await executeSeedFiles(seedFiles, 'development', (current, total, name) => {
        progressCalls.push({ current, total, name })
      })

      expect(progressCalls).toHaveLength(1)
      expect(progressCalls[0]).toEqual({ current: 1, total: 1, name: 'progress' })
    })

    it('should return empty array for empty seed list', async () => {
      const results = await executeSeedFiles([], 'development')
      expect(results).toEqual([])
    })
  })

  describe('formatSeedResults()', () => {
    it('should format results with created counts', () => {
      const results: SeedResult[] = [
        { name: 'users', created: { users: 10 }, duration: 100 },
        { name: 'posts', created: { posts: 25 }, duration: 200 },
      ]

      const output = formatSeedResults(results)

      expect(output).toContain('users')
      expect(output).toContain('created 10 records')
      expect(output).toContain('posts')
      expect(output).toContain('created 25 records')
    })

    it('should format results with skipped counts', () => {
      const results: SeedResult[] = [
        { name: 'users', created: { users: 5 }, skipped: { users: 3 }, duration: 100 },
      ]

      const output = formatSeedResults(results)

      expect(output).toContain('created 5 records')
      expect(output).toContain('skipped 3')
    })

    it('should handle empty results', () => {
      const results: SeedResult[] = []
      const output = formatSeedResults(results)
      expect(output).toBe('')
    })

    it('should handle results with no created records', () => {
      const results: SeedResult[] = [{ name: 'empty', created: {}, duration: 50 }]

      const output = formatSeedResults(results)

      expect(output).toContain('empty')
      expect(output).not.toContain('created')
    })

    it('should aggregate multiple table counts', () => {
      const results: SeedResult[] = [
        { name: 'mixed', created: { users: 5, posts: 10, comments: 15 }, duration: 100 },
      ]

      const output = formatSeedResults(results)

      expect(output).toContain('created 30 records')
    })
  })
})
