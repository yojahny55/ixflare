import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import {
  getSeedsDir,
  seedsDirExists,
  discoverSeedFiles,
  filterSeedsByEnvironment,
  resolveSeedOrder,
} from '../../src/seed/discovery'
import type { SeedFileInfo } from '../../src/seed/discovery'

const TEST_DIR = join(__dirname, 'discovery-test-temp')
const SEEDS_DIR = join(TEST_DIR, 'seeds')

describe('discovery', () => {
  beforeEach(() => {
    // Clean up before each test
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(SEEDS_DIR, { recursive: true })
  })

  afterEach(() => {
    // Clean up after each test
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('getSeedsDir()', () => {
    it('should return seeds directory path', () => {
      const result = getSeedsDir(TEST_DIR)
      expect(result).toBe(SEEDS_DIR)
    })

    it('should use process.cwd() by default', () => {
      const result = getSeedsDir()
      expect(result).toBe(join(process.cwd(), 'seeds'))
    })
  })

  describe('seedsDirExists()', () => {
    it('should return true if seeds directory exists', () => {
      expect(seedsDirExists(TEST_DIR)).toBe(true)
    })

    it('should return false if seeds directory does not exist', () => {
      rmSync(SEEDS_DIR, { recursive: true })
      expect(seedsDirExists(TEST_DIR)).toBe(false)
    })
  })

  describe('discoverSeedFiles()', () => {
    it('should discover TypeScript seed files', () => {
      writeFileSync(join(SEEDS_DIR, 'users.ts'), '')
      writeFileSync(join(SEEDS_DIR, 'posts.ts'), '')

      const seeds = discoverSeedFiles(TEST_DIR)

      expect(seeds).toHaveLength(2)
      expect(seeds[0].name).toBe('posts')
      expect(seeds[1].name).toBe('users')
    })

    it('should discover JavaScript seed files', () => {
      writeFileSync(join(SEEDS_DIR, 'users.js'), '')

      const seeds = discoverSeedFiles(TEST_DIR)

      expect(seeds).toHaveLength(1)
      expect(seeds[0].name).toBe('users')
    })

    it('should exclude index files', () => {
      writeFileSync(join(SEEDS_DIR, 'index.ts'), '')
      writeFileSync(join(SEEDS_DIR, 'users.ts'), '')

      const seeds = discoverSeedFiles(TEST_DIR)

      expect(seeds).toHaveLength(1)
      expect(seeds[0].name).toBe('users')
    })

    it('should return seeds in alphabetical order', () => {
      writeFileSync(join(SEEDS_DIR, 'z-last.ts'), '')
      writeFileSync(join(SEEDS_DIR, 'a-first.ts'), '')
      writeFileSync(join(SEEDS_DIR, 'm-middle.ts'), '')

      const seeds = discoverSeedFiles(TEST_DIR)

      expect(seeds.map((s) => s.name)).toEqual(['a-first', 'm-middle', 'z-last'])
    })

    it('should return empty array if seeds directory does not exist', () => {
      rmSync(SEEDS_DIR, { recursive: true })

      const seeds = discoverSeedFiles(TEST_DIR)

      expect(seeds).toEqual([])
    })

    it('should include absolute paths', () => {
      writeFileSync(join(SEEDS_DIR, 'users.ts'), '')

      const seeds = discoverSeedFiles(TEST_DIR)

      expect(seeds[0].path).toBe(join(SEEDS_DIR, 'users.ts'))
    })
  })

  describe('filterSeedsByEnvironment()', () => {
    const mockSeeds: SeedFileInfo[] = [
      { path: '/seeds/users.ts', name: 'users' },
      { path: '/seeds/products.ts', name: 'products' },
      { path: '/seeds/test-data.ts', name: 'test-data' },
    ]

    it('should return all seeds for development when no config', () => {
      const filtered = filterSeedsByEnvironment(mockSeeds, 'development', null)
      expect(filtered).toHaveLength(3)
    })

    it('should return all seeds for test when no config', () => {
      const filtered = filterSeedsByEnvironment(mockSeeds, 'test', null)
      expect(filtered).toHaveLength(3)
    })

    it('should return no seeds for production when no config', () => {
      const filtered = filterSeedsByEnvironment(mockSeeds, 'production', null)
      expect(filtered).toHaveLength(0)
    })

    it('should filter by config when provided', () => {
      const config = {
        development: ['users', 'products'],
        test: ['test-data'],
        production: [],
      }

      const devFiltered = filterSeedsByEnvironment(mockSeeds, 'development', config)
      expect(devFiltered.map((s) => s.name)).toEqual(['users', 'products'])

      const testFiltered = filterSeedsByEnvironment(mockSeeds, 'test', config)
      expect(testFiltered.map((s) => s.name)).toEqual(['test-data'])
    })

    it('should match seeds with ./ prefix', () => {
      const config = {
        development: ['./users.ts', './products.ts'],
        test: [],
        production: [],
      }

      const filtered = filterSeedsByEnvironment(mockSeeds, 'development', config)
      expect(filtered.map((s) => s.name)).toEqual(['users', 'products'])
    })

    it('should match seeds with seeds/ prefix', () => {
      const config = {
        development: ['./seeds/users.ts'],
        test: [],
        production: [],
      }

      const filtered = filterSeedsByEnvironment(mockSeeds, 'development', config)
      expect(filtered.map((s) => s.name)).toEqual(['users'])
    })
  })

  describe('resolveSeedOrder()', () => {
    it('should maintain order for seeds without dependencies', () => {
      const seeds: SeedFileInfo[] = [
        { path: '/a.ts', name: 'a' },
        { path: '/b.ts', name: 'b' },
        { path: '/c.ts', name: 'c' },
      ]

      const ordered = resolveSeedOrder(seeds)
      expect(ordered.map((s) => s.name)).toEqual(['a', 'b', 'c'])
    })

    it('should resolve dependencies correctly', () => {
      const seeds: SeedFileInfo[] = [
        { path: '/posts.ts', name: 'posts', dependencies: ['users'] },
        { path: '/users.ts', name: 'users' },
      ]

      const ordered = resolveSeedOrder(seeds)
      expect(ordered.map((s) => s.name)).toEqual(['users', 'posts'])
    })

    it('should handle multiple dependency levels', () => {
      const seeds: SeedFileInfo[] = [
        { path: '/comments.ts', name: 'comments', dependencies: ['posts'] },
        { path: '/posts.ts', name: 'posts', dependencies: ['users'] },
        { path: '/users.ts', name: 'users' },
      ]

      const ordered = resolveSeedOrder(seeds)
      expect(ordered.map((s) => s.name)).toEqual(['users', 'posts', 'comments'])
    })

    it('should handle multiple dependencies', () => {
      const seeds: SeedFileInfo[] = [
        { path: '/post-tags.ts', name: 'post-tags', dependencies: ['posts', 'tags'] },
        { path: '/posts.ts', name: 'posts', dependencies: ['users'] },
        { path: '/tags.ts', name: 'tags' },
        { path: '/users.ts', name: 'users' },
      ]

      const ordered = resolveSeedOrder(seeds)
      const names = ordered.map((s) => s.name)

      // Users and tags should come before posts
      expect(names.indexOf('users')).toBeLessThan(names.indexOf('posts'))
      expect(names.indexOf('tags')).toBeLessThan(names.indexOf('post-tags'))
      expect(names.indexOf('posts')).toBeLessThan(names.indexOf('post-tags'))
    })

    it('should throw on missing dependency', () => {
      const seeds: SeedFileInfo[] = [
        { path: '/posts.ts', name: 'posts', dependencies: ['users'] },
        // users seed is missing
      ]

      expect(() => resolveSeedOrder(seeds)).toThrow('Seed dependency not found: users')
    })
  })
})
