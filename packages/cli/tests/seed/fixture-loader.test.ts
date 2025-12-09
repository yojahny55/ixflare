import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import {
  loadFixture,
  getFixtureTables,
  getFixtureRecords,
  fixtureTableToModelName,
  validateFixture,
} from '../../src/seed/fixture-loader'

const TEST_DIR = join(__dirname, 'fixture-test-temp')
const FIXTURE_PATH = join(TEST_DIR, 'test-fixture.json')

describe('fixture-loader', () => {
  beforeEach(() => {
    // Create test directory
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    // Clean up
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('loadFixture()', () => {
    it('should load valid JSON fixture', () => {
      const fixtureData = {
        users: [{ id: 1, name: 'Test User' }],
        posts: [{ id: 1, title: 'Test Post' }],
      }

      writeFileSync(FIXTURE_PATH, JSON.stringify(fixtureData))

      const result = loadFixture(FIXTURE_PATH)
      expect(result).toEqual(fixtureData)
    })

    it('should handle fixture with _meta', () => {
      const fixtureData = {
        _meta: { version: '1.0' },
        users: [{ id: 1, name: 'Test' }],
      }

      writeFileSync(FIXTURE_PATH, JSON.stringify(fixtureData))

      const result = loadFixture(FIXTURE_PATH)
      expect(result).toEqual(fixtureData)
      expect(result._meta).toEqual({ version: '1.0' })
    })

    it('should throw on invalid JSON', () => {
      writeFileSync(FIXTURE_PATH, 'invalid json{')

      expect(() => loadFixture(FIXTURE_PATH)).toThrow('Failed to load fixture')
    })

    it('should throw on non-object JSON', () => {
      writeFileSync(FIXTURE_PATH, JSON.stringify([]))

      expect(() => loadFixture(FIXTURE_PATH)).toThrow('Fixture must be a JSON object')
    })

    it('should throw on non-existent file', () => {
      expect(() => loadFixture('/non/existent/path.json')).toThrow('Failed to load fixture')
    })
  })

  describe('getFixtureTables()', () => {
    it('should return all table names except _meta', () => {
      const fixture = {
        _meta: { version: '1.0' },
        users: [{ id: 1 }],
        posts: [{ id: 1 }],
        comments: [{ id: 1 }],
      }

      const tables = getFixtureTables(fixture)
      expect(tables).toEqual(['users', 'posts', 'comments'])
    })

    it('should return empty array for fixture with only _meta', () => {
      const fixture = {
        _meta: { version: '1.0' },
      }

      const tables = getFixtureTables(fixture)
      expect(tables).toEqual([])
    })

    it('should filter out non-array values', () => {
      const fixture = {
        users: [{ id: 1 }],
        config: { setting: 'value' },
        posts: [{ id: 1 }],
      }

      const tables = getFixtureTables(fixture)
      expect(tables).toEqual(['users', 'posts'])
    })
  })

  describe('getFixtureRecords()', () => {
    it('should return records for specified table', () => {
      const fixture = {
        users: [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' },
        ],
        posts: [{ id: 1, title: 'Post 1' }],
      }

      const records = getFixtureRecords(fixture, 'users')
      expect(records).toEqual([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ])
    })

    it('should throw if table is not an array', () => {
      const fixture = {
        users: { id: 1, name: 'User' }, // Object instead of array
      }

      expect(() => getFixtureRecords(fixture, 'users')).toThrow(
        'Fixture table "users" must be an array'
      )
    })

    it('should return empty array for empty table', () => {
      const fixture = {
        users: [],
      }

      const records = getFixtureRecords(fixture, 'users')
      expect(records).toEqual([])
    })
  })

  describe('fixtureTableToModelName()', () => {
    it('should convert camelCase table name to PascalCase singular', () => {
      expect(fixtureTableToModelName('users')).toBe('User')
      expect(fixtureTableToModelName('posts')).toBe('Post')
      expect(fixtureTableToModelName('comments')).toBe('Comment')
    })

    it('should handle camelCase with multiple words', () => {
      expect(fixtureTableToModelName('blogPosts')).toBe('BlogPost')
      expect(fixtureTableToModelName('userProfiles')).toBe('UserProfile')
    })

    it('should handle snake_case', () => {
      expect(fixtureTableToModelName('blog_posts')).toBe('BlogPost')
      expect(fixtureTableToModelName('user_profiles')).toBe('UserProfile')
    })

    it('should not remove trailing "s" from words ending in "ss"', () => {
      expect(fixtureTableToModelName('addresses')).toBe('Addresse')
    })

    it('should handle already singular names', () => {
      expect(fixtureTableToModelName('user')).toBe('User')
      expect(fixtureTableToModelName('blogPost')).toBe('BlogPost')
    })
  })

  describe('validateFixture()', () => {
    it('should pass for valid fixture', () => {
      const fixture = {
        _meta: { version: '1.0' },
        users: [{ id: 1, name: 'User' }],
        posts: [{ id: 1, title: 'Post' }],
      }

      expect(() => validateFixture(fixture)).not.toThrow()
    })

    it('should throw if fixture is not an object', () => {
      expect(() => validateFixture([] as never)).toThrow('Fixture must be a JSON object')
      expect(() => validateFixture(null as never)).toThrow('Fixture must be a JSON object')
    })

    it('should throw if table is not an array', () => {
      const fixture = {
        users: { id: 1 },
      }

      expect(() => validateFixture(fixture)).toThrow('Fixture table "users" must be an array')
    })

    it('should throw if record is not an object', () => {
      const fixture = {
        users: ['invalid'],
      }

      expect(() => validateFixture(fixture)).toThrow('All records in "users" must be objects')
    })

    it('should allow _meta to not be an array', () => {
      const fixture = {
        _meta: { version: '1.0' },
        users: [{ id: 1 }],
      }

      expect(() => validateFixture(fixture)).not.toThrow()
    })
  })
})
