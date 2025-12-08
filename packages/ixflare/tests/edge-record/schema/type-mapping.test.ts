/**
 * @module tests/edge-record/schema/type-mapping
 * @description Tests for D1/SQLite type mapping
 */

import { describe, it, expect } from 'vitest'
import { toSQLType, toSQLSchema } from '@/edge-record/schema/type-mapping'
import { defineModel, field, timestamps } from '@/edge-record/schema'

describe('toSQLType()', () => {
  it('should map id to INTEGER PRIMARY KEY AUTOINCREMENT', () => {
    const idField = field.id()
    const sqlType = toSQLType('id', idField)

    expect(sqlType).toBe('INTEGER PRIMARY KEY AUTOINCREMENT')
  })

  it('should map string to TEXT', () => {
    const stringField = field.string()
    const sqlType = toSQLType('name', stringField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should map text to TEXT', () => {
    const textField = field.text()
    const sqlType = toSQLType('bio', textField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should map integer to INTEGER', () => {
    const intField = field.integer()
    const sqlType = toSQLType('count', intField)

    expect(sqlType).toBe('INTEGER NOT NULL')
  })

  it('should map decimal to REAL', () => {
    const decimalField = field.decimal({ precision: 10, scale: 2 })
    const sqlType = toSQLType('price', decimalField)

    expect(sqlType).toBe('REAL NOT NULL')
  })

  it('should map boolean to INTEGER', () => {
    const boolField = field.boolean()
    const sqlType = toSQLType('active', boolField)

    expect(sqlType).toBe('INTEGER NOT NULL')
  })

  it('should map datetime to INTEGER', () => {
    const dateField = field.datetime()
    const sqlType = toSQLType('createdAt', dateField)

    expect(sqlType).toBe('INTEGER NOT NULL')
  })

  it('should map json to TEXT', () => {
    const jsonField = field.json<{ foo: string }>()
    const sqlType = toSQLType('metadata', jsonField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should map enum to TEXT', () => {
    const enumField = field.enum(['a', 'b', 'c'] as const)
    const sqlType = toSQLType('status', enumField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should add NULL for nullable fields', () => {
    const nullableField = field.string().nullable()
    const sqlType = toSQLType('optional', nullableField)

    expect(sqlType).toBe('TEXT')
  })

  it('should add UNIQUE constraint', () => {
    const uniqueField = field.string().unique()
    const sqlType = toSQLType('email', uniqueField)

    expect(sqlType).toContain('UNIQUE')
  })

  it('should add DEFAULT value for static defaults', () => {
    const defaultField = field.string().default('guest')
    const sqlType = toSQLType('role', defaultField)

    expect(sqlType).toContain("DEFAULT 'guest'")
  })
})

describe('toSQLSchema()', () => {
  it('should generate CREATE TABLE SQL for simple model', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string().unique(),
      name: field.string(),
    })

    const sql = toSQLSchema(User)

    expect(sql).toContain('CREATE TABLE users')
    expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT')
    expect(sql).toContain('email TEXT NOT NULL UNIQUE')
    expect(sql).toContain('name TEXT NOT NULL')
  })

  it('should generate CREATE TABLE SQL with timestamps', () => {
    const Post = defineModel('posts', {
      id: field.id(),
      title: field.string(),
      ...timestamps(),
    })

    const sql = toSQLSchema(Post)

    expect(sql).toContain('CREATE TABLE posts')
    expect(sql).toContain('createdAt INTEGER NOT NULL')
    expect(sql).toContain('updatedAt INTEGER NOT NULL')
  })

  it('should handle all field types', () => {
    const Test = defineModel('test_table', {
      id: field.id(),
      str: field.string(),
      txt: field.text(),
      int: field.integer(),
      dec: field.decimal({ precision: 10, scale: 2 }),
      bool: field.boolean(),
      date: field.datetime(),
      json: field.json<object>(),
      enm: field.enum(['a', 'b'] as const),
    })

    const sql = toSQLSchema(Test)

    expect(sql).toContain('str TEXT NOT NULL')
    expect(sql).toContain('txt TEXT NOT NULL')
    expect(sql).toContain('int INTEGER NOT NULL')
    expect(sql).toContain('dec REAL NOT NULL')
    expect(sql).toContain('bool INTEGER NOT NULL')
    expect(sql).toContain('date INTEGER NOT NULL')
    expect(sql).toContain('json TEXT NOT NULL')
    expect(sql).toContain('enm TEXT NOT NULL')
  })

  it('should handle nullable fields', () => {
    const User = defineModel('users', {
      id: field.id(),
      bio: field.text().nullable(),
    })

    const sql = toSQLSchema(User)

    expect(sql).toContain('bio TEXT')
    expect(sql).not.toContain('bio TEXT NOT NULL')
  })

  it('should format SQL with proper line breaks', () => {
    const User = defineModel('users', {
      id: field.id(),
      name: field.string(),
    })

    const sql = toSQLSchema(User)

    expect(sql).toContain('\n')
    expect(sql).toMatch(/CREATE TABLE users \([\s\S]+\)/)
  })
})
