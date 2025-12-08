/**
 * @module tests/edge-record/schema/zod-generator
 * @description Tests for Zod schema generation
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { generateZodSchema, toZodField } from '@/edge-record/schema/zod-generator'
import { defineModel, field, timestamps } from '@/edge-record/schema'

describe('toZodField()', () => {
  it('should convert string field to z.string()', () => {
    const stringField = field.string()
    const zodSchema = toZodField(stringField)

    expect(zodSchema.parse('hello')).toBe('hello')
    expect(() => zodSchema.parse(123)).toThrow()
  })

  it('should convert string with min/max to z.string().min().max()', () => {
    const stringField = field.string().min(2).max(10)
    const zodSchema = toZodField(stringField)

    expect(zodSchema.parse('hello')).toBe('hello')
    expect(() => zodSchema.parse('a')).toThrow() // too short
    expect(() => zodSchema.parse('12345678901')).toThrow() // too long
  })

  it('should convert integer to z.number().int()', () => {
    const intField = field.integer()
    const zodSchema = toZodField(intField)

    expect(zodSchema.parse(42)).toBe(42)
    expect(() => zodSchema.parse(3.14)).toThrow() // not an integer
    expect(() => zodSchema.parse('42')).toThrow() // not a number
  })

  it('should convert integer with min/max constraints', () => {
    const intField = field.integer().min(0).max(100)
    const zodSchema = toZodField(intField)

    expect(zodSchema.parse(50)).toBe(50)
    expect(() => zodSchema.parse(-1)).toThrow() // below min
    expect(() => zodSchema.parse(101)).toThrow() // above max
  })

  it('should convert positive integer', () => {
    const intField = field.integer().positive()
    const zodSchema = toZodField(intField)

    expect(zodSchema.parse(5)).toBe(5)
    expect(() => zodSchema.parse(0)).toThrow() // not positive
    expect(() => zodSchema.parse(-5)).toThrow() // not positive
  })

  it('should convert decimal to z.number()', () => {
    const decimalField = field.decimal({ precision: 10, scale: 2 })
    const zodSchema = toZodField(decimalField)

    expect(zodSchema.parse(3.14)).toBe(3.14)
    expect(zodSchema.parse(42)).toBe(42)
    expect(() => zodSchema.parse('3.14')).toThrow()
  })

  it('should convert boolean to z.boolean()', () => {
    const boolField = field.boolean()
    const zodSchema = toZodField(boolField)

    expect(zodSchema.parse(true)).toBe(true)
    expect(zodSchema.parse(false)).toBe(false)
    expect(() => zodSchema.parse('true')).toThrow()
  })

  it('should convert datetime to z.date()', () => {
    const dateField = field.datetime()
    const zodSchema = toZodField(dateField)

    const now = new Date()
    expect(zodSchema.parse(now)).toEqual(now)
    expect(() => zodSchema.parse('2025-01-01')).toThrow()
  })

  it('should convert json to z.unknown() by default', () => {
    const jsonField = field.json()
    const zodSchema = toZodField(jsonField)

    expect(zodSchema.parse({ foo: 'bar' })).toEqual({ foo: 'bar' })
    expect(zodSchema.parse([1, 2, 3])).toEqual([1, 2, 3])
    expect(zodSchema.parse('string')).toBe('string')
  })

  it('should convert enum to z.enum()', () => {
    const enumField = field.enum(['user', 'admin', 'moderator'] as const)
    const zodSchema = toZodField(enumField)

    expect(zodSchema.parse('user')).toBe('user')
    expect(zodSchema.parse('admin')).toBe('admin')
    expect(() => zodSchema.parse('invalid')).toThrow()
  })

  it('should handle nullable fields with z.nullable()', () => {
    const nullableField = field.string().nullable()
    const zodSchema = toZodField(nullableField)

    expect(zodSchema.parse('hello')).toBe('hello')
    expect(zodSchema.parse(null)).toBeNull()
  })

  it('should handle default values', () => {
    const defaultField = field.string().default('guest')
    const zodSchema = toZodField(defaultField)

    // Zod default should work with .parse(undefined)
    expect(zodSchema.parse(undefined)).toBe('guest')
  })
})

describe('generateZodSchema()', () => {
  it('should generate Zod schema for simple model', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
      name: field.string(),
    })

    const zodSchema = generateZodSchema(User)

    const validData = { id: 1, email: 'test@example.com', name: 'John' }
    expect(zodSchema.parse(validData)).toEqual(validData)

    expect(() => zodSchema.parse({ id: 'not-a-number', email: 'test', name: 'John' })).toThrow()
  })

  it('should generate Zod schema with all field types', () => {
    const Post = defineModel('posts', {
      id: field.id(),
      title: field.string().min(5).max(100),
      content: field.text(),
      viewCount: field.integer().min(0),
      price: field.decimal({ precision: 10, scale: 2 }).positive(),
      published: field.boolean(),
      publishedAt: field.datetime().nullable(),
      metadata: field.json<{ tags: string[] }>(),
      status: field.enum(['draft', 'published', 'archived'] as const),
    })

    const zodSchema = generateZodSchema(Post)

    const validData = {
      id: 1,
      title: 'Hello World',
      content: 'This is a long content...',
      viewCount: 100,
      price: 9.99,
      published: true,
      publishedAt: new Date(),
      metadata: { tags: ['tech', 'javascript'] },
      status: 'published' as const,
    }

    expect(zodSchema.parse(validData)).toEqual(validData)
  })

  it('should validate field constraints', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string().min(5),
      age: field.integer().min(0).max(150),
    })

    const zodSchema = generateZodSchema(User)

    // Valid
    expect(() => zodSchema.parse({ id: 1, email: 'test@example.com', age: 25 })).not.toThrow()

    // Invalid email (too short)
    expect(() => zodSchema.parse({ id: 1, email: 'a', age: 25 })).toThrow()

    // Invalid age (out of range)
    expect(() => zodSchema.parse({ id: 1, email: 'test@example.com', age: 200 })).toThrow()
  })

  it('should work with timestamps', () => {
    const Post = defineModel('posts', {
      id: field.id(),
      title: field.string(),
      ...timestamps(),
    })

    const zodSchema = generateZodSchema(Post)

    const validData = {
      id: 1,
      title: 'Test Post',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(zodSchema.parse(validData)).toEqual(validData)
  })

  it('should be accessible via $zodSchema property', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
    })

    // Generate and attach
    const zodSchema = generateZodSchema(User)

    expect(zodSchema).toBeDefined()
    expect(zodSchema.parse({ id: 1, email: 'test@example.com' })).toBeDefined()
  })
})
