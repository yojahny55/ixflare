/**
 * @module tests/edge-record/crud/d1-adapter.test
 * @description Tests for D1Adapter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { D1Adapter } from '@/edge-record/crud/d1-adapter'
import { createMockD1Database } from './mock-d1'
import type { FieldConfig } from '@/edge-record/schema/field'

describe('D1Adapter', () => {
  let db: D1Database
  let adapter: D1Adapter

  beforeEach(() => {
    db = createMockD1Database()
    adapter = new D1Adapter(db)
  })

  describe('run', () => {
    it('should execute INSERT with parameterized query', async () => {
      const sql = 'INSERT INTO users (email, name) VALUES (?, ?)'
      const params = ['test@example.com', 'Test User']

      const result = await adapter.run(sql, params)

      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      expect(result.meta.last_row_id).toBeGreaterThan(0)
    })

    it('should execute UPDATE with parameterized query', async () => {
      // First insert
      await adapter.run('INSERT INTO users (email, name) VALUES (?, ?)', [
        'test@example.com',
        'Test',
      ])

      // Then update
      const result = await adapter.run('UPDATE users SET name = ? WHERE id = ?', ['Updated', 1])

      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
    })

    it('should execute DELETE with parameterized query', async () => {
      // First insert
      await adapter.run('INSERT INTO users (email, name) VALUES (?, ?)', [
        'test@example.com',
        'Test',
      ])

      // Then delete
      const result = await adapter.run('DELETE FROM users WHERE id = ?', [1])

      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
    })

    it('should handle queries with no parameters', async () => {
      const result = await adapter.run(
        'INSERT INTO users (email, name) VALUES ("test@example.com", "Test")'
      )

      expect(result.success).toBe(true)
    })
  })

  describe('all', () => {
    it('should return all rows from SELECT query', async () => {
      // Insert test data
      await adapter.run('INSERT INTO users (email, name) VALUES (?, ?)', [
        'user1@example.com',
        'User 1',
      ])
      await adapter.run('INSERT INTO users (email, name) VALUES (?, ?)', [
        'user2@example.com',
        'User 2',
      ])

      const results = await adapter.all<{ id: number; email: string; name: string }>(
        'SELECT * FROM users',
        []
      )

      expect(results).toHaveLength(2)
      expect(results[0]).toHaveProperty('email', 'user1@example.com')
      expect(results[1]).toHaveProperty('email', 'user2@example.com')
    })

    it('should return empty array when no rows match', async () => {
      const results = await adapter.all('SELECT * FROM users WHERE id = ?', [999])

      expect(results).toEqual([])
    })
  })

  describe('first', () => {
    it('should return first row from SELECT query', async () => {
      await adapter.run('INSERT INTO users (email, name) VALUES (?, ?)', [
        'test@example.com',
        'Test User',
      ])

      const result = await adapter.first<{ id: number; email: string; name: string }>(
        'SELECT * FROM users WHERE id = ?',
        [1]
      )

      expect(result).toBeDefined()
      expect(result).toHaveProperty('email', 'test@example.com')
    })

    it('should return null when no rows match', async () => {
      const result = await adapter.first('SELECT * FROM users WHERE id = ?', [999])

      expect(result).toBeNull()
    })
  })

  describe('batch', () => {
    it('should execute multiple statements in batch', async () => {
      const stmts = adapter.prepareBatch('INSERT INTO users (email, name) VALUES (?, ?)', [
        ['user1@example.com', 'User 1'],
        ['user2@example.com', 'User 2'],
        ['user3@example.com', 'User 3'],
      ])

      const results = await adapter.batch(stmts)

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.success)).toBe(true)
      expect(results.every((r) => r.meta.changes === 1)).toBe(true)
    })
  })

  describe('toD1Value', () => {
    it('should convert boolean to 0/1', () => {
      expect(adapter.toD1Value(true, 'boolean')).toBe(1)
      expect(adapter.toD1Value(false, 'boolean')).toBe(0)
    })

    it('should convert Date to Unix milliseconds', () => {
      const date = new Date('2025-12-08T10:30:00Z')
      const timestamp = adapter.toD1Value(date, 'datetime')

      expect(timestamp).toBe(date.getTime())
    })

    it('should keep timestamp as-is', () => {
      const timestamp = 1733311800000
      expect(adapter.toD1Value(timestamp, 'datetime')).toBe(timestamp)
    })

    it('should stringify JSON', () => {
      const obj = { foo: 'bar', baz: 123 }
      const result = adapter.toD1Value(obj, 'json')

      expect(result).toBe(JSON.stringify(obj))
    })

    it('should handle null values', () => {
      expect(adapter.toD1Value(null, 'string')).toBeNull()
      expect(adapter.toD1Value(undefined, 'string')).toBeNull()
    })

    it('should pass through other types unchanged', () => {
      expect(adapter.toD1Value('test', 'string')).toBe('test')
      expect(adapter.toD1Value(123, 'integer')).toBe(123)
      expect(adapter.toD1Value(45.67, 'decimal')).toBe(45.67)
    })
  })

  describe('fromD1Value', () => {
    it('should convert 0/1 to boolean', () => {
      const config: FieldConfig = { type: 'boolean', nullable: false }

      expect(adapter.fromD1Value(1, config)).toBe(true)
      expect(adapter.fromD1Value(0, config)).toBe(false)
    })

    it('should parse JSON strings', () => {
      const config: FieldConfig = { type: 'json', nullable: false }
      const jsonString = '{"foo":"bar","baz":123}'

      const result = adapter.fromD1Value(jsonString, config)

      expect(result).toEqual({ foo: 'bar', baz: 123 })
    })

    it('should keep Unix milliseconds as-is for datetime', () => {
      const config: FieldConfig = { type: 'datetime', nullable: false }
      const timestamp = 1733311800000

      expect(adapter.fromD1Value(timestamp, config)).toBe(timestamp)
    })

    it('should handle null values for nullable fields', () => {
      const config: FieldConfig = { type: 'string', nullable: true }

      expect(adapter.fromD1Value(null, config)).toBeNull()
      expect(adapter.fromD1Value(undefined, config)).toBeNull()
    })

    it('should return undefined for null on non-nullable fields', () => {
      const config: FieldConfig = { type: 'string', nullable: false }

      expect(adapter.fromD1Value(null, config)).toBeUndefined()
      expect(adapter.fromD1Value(undefined, config)).toBeUndefined()
    })

    it('should pass through other types unchanged', () => {
      const stringConfig: FieldConfig = { type: 'string', nullable: false }
      const intConfig: FieldConfig = { type: 'integer', nullable: false }
      const decimalConfig: FieldConfig = { type: 'decimal', nullable: false }

      expect(adapter.fromD1Value('test', stringConfig)).toBe('test')
      expect(adapter.fromD1Value(123, intConfig)).toBe(123)
      expect(adapter.fromD1Value(45.67, decimalConfig)).toBe(45.67)
    })
  })

  describe('prepareBatch', () => {
    it('should prepare multiple statements with different values', () => {
      const sql = 'INSERT INTO users (email, name) VALUES (?, ?)'
      const valuesList = [
        ['user1@example.com', 'User 1'],
        ['user2@example.com', 'User 2'],
        ['user3@example.com', 'User 3'],
      ]

      const stmts = adapter.prepareBatch(sql, valuesList)

      expect(stmts).toHaveLength(3)
      expect(stmts.every((stmt) => typeof stmt.bind === 'function')).toBe(true)
    })

    it('should handle empty valuesList', () => {
      const sql = 'INSERT INTO users (email, name) VALUES (?, ?)'
      const stmts = adapter.prepareBatch(sql, [])

      expect(stmts).toEqual([])
    })
  })
})
