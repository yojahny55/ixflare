/**
 * @module tests/edge-record/schema/type-mapping
 * @description Tests for D1/SQLite type mapping
 */

import { describe, it, expect } from 'vitest'
import {
  toSQLType,
  toSQLSchema,
  escapeIdentifier,
  escapeStringValue,
} from '@/edge-record/schema/type-mapping'
import { defineModel, field, timestamps } from '@/edge-record/schema'

describe('escapeIdentifier()', () => {
  it('should wrap identifier in double quotes', () => {
    expect(escapeIdentifier('users')).toBe('"users"')
  })

  it('should escape double quotes within identifier', () => {
    expect(escapeIdentifier('my"table')).toBe('"my""table"')
  })

  it('should handle SQL reserved words', () => {
    expect(escapeIdentifier('select')).toBe('"select"')
    expect(escapeIdentifier('from')).toBe('"from"')
  })
})

describe('escapeStringValue()', () => {
  it('should escape single quotes', () => {
    expect(escapeStringValue("O'Reilly")).toBe("O''Reilly")
  })

  it('should handle multiple single quotes', () => {
    expect(escapeStringValue("it's a 'test'")).toBe("it''s a ''test''")
  })

  it('should leave strings without quotes unchanged', () => {
    expect(escapeStringValue('hello')).toBe('hello')
  })
})

describe('toSQLType()', () => {
  it('should map id to INTEGER PRIMARY KEY AUTOINCREMENT', () => {
    const idField = field.id()
    const sqlType = toSQLType(idField)

    expect(sqlType).toBe('INTEGER PRIMARY KEY AUTOINCREMENT')
  })

  it('should map string to TEXT', () => {
    const stringField = field.string()
    const sqlType = toSQLType(stringField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should map text to TEXT', () => {
    const textField = field.text()
    const sqlType = toSQLType(textField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should map integer to INTEGER', () => {
    const intField = field.integer()
    const sqlType = toSQLType(intField)

    expect(sqlType).toBe('INTEGER NOT NULL')
  })

  it('should map decimal to REAL', () => {
    const decimalField = field.decimal({ precision: 10, scale: 2 })
    const sqlType = toSQLType(decimalField)

    expect(sqlType).toBe('REAL NOT NULL')
  })

  it('should map boolean to INTEGER', () => {
    const boolField = field.boolean()
    const sqlType = toSQLType(boolField)

    expect(sqlType).toBe('INTEGER NOT NULL')
  })

  it('should map datetime to INTEGER', () => {
    const dateField = field.datetime()
    const sqlType = toSQLType(dateField)

    expect(sqlType).toBe('INTEGER NOT NULL')
  })

  it('should map json to TEXT', () => {
    const jsonField = field.json<{ foo: string }>()
    const sqlType = toSQLType(jsonField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should map enum to TEXT', () => {
    const enumField = field.enum(['a', 'b', 'c'] as const)
    const sqlType = toSQLType(enumField)

    expect(sqlType).toBe('TEXT NOT NULL')
  })

  it('should add NULL for nullable fields', () => {
    const nullableField = field.string().nullable()
    const sqlType = toSQLType(nullableField)

    expect(sqlType).toBe('TEXT')
  })

  it('should add UNIQUE constraint', () => {
    const uniqueField = field.string().unique()
    const sqlType = toSQLType(uniqueField)

    expect(sqlType).toContain('UNIQUE')
  })

  it('should add DEFAULT value for static defaults', () => {
    const defaultField = field.string().default('guest')
    const sqlType = toSQLType(defaultField)

    expect(sqlType).toContain("DEFAULT 'guest'")
  })

  it('should escape single quotes in DEFAULT string values', () => {
    const defaultField = field.string().default("O'Reilly")
    const sqlType = toSQLType(defaultField)

    expect(sqlType).toContain("DEFAULT 'O''Reilly'")
  })

  it('should convert boolean default to INTEGER 0/1', () => {
    const trueField = field.boolean().default(true)
    const falseField = field.boolean().default(false)

    expect(toSQLType(trueField)).toContain('DEFAULT 1')
    expect(toSQLType(falseField)).toContain('DEFAULT 0')
  })
})

describe('toSQLSchema()', () => {
  it('should generate CREATE TABLE SQL for simple model', () => {
    const User = defineModel('users_sql_test_1', {
      id: field.id(),
      email: field.string().unique(),
      name: field.string(),
    })

    const sql = toSQLSchema(User)

    expect(sql).toContain('CREATE TABLE "users_sql_test_1"')
    expect(sql).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT')
    expect(sql).toContain('"email" TEXT NOT NULL UNIQUE')
    expect(sql).toContain('"name" TEXT NOT NULL')
  })

  it('should generate CREATE TABLE SQL with timestamps', () => {
    const Post = defineModel('posts_sql_test', {
      id: field.id(),
      title: field.string(),
      ...timestamps(),
    })

    const sql = toSQLSchema(Post)

    expect(sql).toContain('CREATE TABLE "posts_sql_test"')
    expect(sql).toContain('"createdAt" INTEGER NOT NULL')
    expect(sql).toContain('"updatedAt" INTEGER NOT NULL')
  })

  it('should handle all field types', () => {
    const Test = defineModel('test_table_sql', {
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

    expect(sql).toContain('"str" TEXT NOT NULL')
    expect(sql).toContain('"txt" TEXT NOT NULL')
    expect(sql).toContain('"int" INTEGER NOT NULL')
    expect(sql).toContain('"dec" REAL NOT NULL')
    expect(sql).toContain('"bool" INTEGER NOT NULL')
    expect(sql).toContain('"date" INTEGER NOT NULL')
    expect(sql).toContain('"json" TEXT NOT NULL')
    expect(sql).toContain('"enm" TEXT NOT NULL')
  })

  it('should handle nullable fields', () => {
    const User = defineModel('users_nullable_test', {
      id: field.id(),
      bio: field.text().nullable(),
    })

    const sql = toSQLSchema(User)

    expect(sql).toContain('"bio" TEXT')
    expect(sql).not.toContain('"bio" TEXT NOT NULL')
  })

  it('should format SQL with proper line breaks', () => {
    const User = defineModel('users_format_test', {
      id: field.id(),
      name: field.string(),
    })

    const sql = toSQLSchema(User)

    expect(sql).toContain('\n')
    expect(sql).toMatch(/CREATE TABLE "users_format_test" \([\s\S]+\)/)
  })

  it('should generate FOREIGN KEY constraints', () => {
    const Author = defineModel('authors_fk_test', {
      id: field.id(),
      name: field.string(),
    })

    const Book = defineModel('books_fk_test', {
      id: field.id(),
      authorId: field.integer().references(Author, 'id'),
      title: field.string(),
    })

    const sql = toSQLSchema(Book)

    expect(sql).toContain('FOREIGN KEY ("authorId") REFERENCES "authors_fk_test"("id")')
  })

  it('should escape SQL reserved words as table and column names', () => {
    const Select = defineModel('select', {
      id: field.id(),
      from: field.string(),
    })

    const sql = toSQLSchema(Select)

    expect(sql).toContain('CREATE TABLE "select"')
    expect(sql).toContain('"from" TEXT NOT NULL')
  })
})
