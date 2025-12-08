/**
 * @module tests/edge-record/integration/schema
 * @description Integration tests for full schema definition flow
 */

import { describe, it, expect } from 'vitest'
import { defineModel, field, timestamps, toSQLSchema, generateZodSchema } from '@/edge-record'

describe('Schema Integration Tests', () => {
  it('should create a complete model with all features', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string().unique().min(5).max(255),
      name: field.string().min(2).max(100),
      role: field.enum(['user', 'admin', 'moderator'] as const).default('user'),
      bio: field.text().nullable(),
      age: field.integer().min(0).max(150).nullable(),
      isActive: field.boolean(),
      emailVerifiedAt: field.datetime().nullable(),
      metadata: field.json<{ preferences: Record<string, unknown> }>(),
      ...timestamps(),
    })

    // Should have table name
    expect(User.$tableName).toBe('users')

    // Should have all fields in schema
    expect(User.$schema).toHaveProperty('id')
    expect(User.$schema).toHaveProperty('email')
    expect(User.$schema).toHaveProperty('name')
    expect(User.$schema).toHaveProperty('role')
    expect(User.$schema).toHaveProperty('bio')
    expect(User.$schema).toHaveProperty('age')
    expect(User.$schema).toHaveProperty('isActive')
    expect(User.$schema).toHaveProperty('emailVerifiedAt')
    expect(User.$schema).toHaveProperty('metadata')
    expect(User.$schema).toHaveProperty('createdAt')
    expect(User.$schema).toHaveProperty('updatedAt')
  })

  it('should generate SQL schema from model', () => {
    const Product = defineModel('products', {
      id: field.id(),
      name: field.string(),
      price: field.decimal({ precision: 10, scale: 2 }),
      inStock: field.boolean(),
    })

    const sql = toSQLSchema(Product)

    expect(sql).toContain('CREATE TABLE products')
    expect(sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT')
    expect(sql).toContain('name TEXT NOT NULL')
    expect(sql).toContain('price REAL NOT NULL')
    expect(sql).toContain('inStock INTEGER NOT NULL')
  })

  it('should generate Zod schema from model', () => {
    const Post = defineModel('posts', {
      id: field.id(),
      title: field.string().min(5),
      content: field.text(),
      published: field.boolean(),
    })

    const zodSchema = generateZodSchema(Post)

    // Valid data should pass
    const validData = {
      id: 1,
      title: 'Hello World',
      content: 'This is content',
      published: true,
    }
    expect(zodSchema.parse(validData)).toEqual(validData)

    // Invalid data should fail
    expect(() =>
      zodSchema.parse({
        id: 1,
        title: 'Hi', // too short
        content: 'This is content',
        published: true,
      })
    ).toThrow()
  })

  it('should handle relationships with foreign keys', () => {
    const Author = defineModel('authors', {
      id: field.id(),
      name: field.string(),
    })

    const Book = defineModel('books', {
      id: field.id(),
      authorId: field.integer().references(Author),
      title: field.string(),
      isbn: field.string().unique(),
      publishedAt: field.datetime().nullable(),
    })

    expect(Book.$schema.authorId.config.references).toBeDefined()
    expect(Book.$schema.authorId.config.references?.model).toBe(Author)
    expect(Book.$schema.authorId.config.references?.column).toBe('id')
  })

  it('should work with timestamps helper', () => {
    const Comment = defineModel('comments', {
      id: field.id(),
      text: field.string(),
      ...timestamps(),
    })

    const sql = toSQLSchema(Comment)

    expect(sql).toContain('createdAt INTEGER NOT NULL')
    expect(sql).toContain('updatedAt INTEGER NOT NULL')
  })

  it('should support complete workflow: define -> SQL -> Zod', () => {
    const Article = defineModel('articles', {
      id: field.id(),
      title: field.string().min(10).max(200),
      slug: field.string().unique(),
      status: field.enum(['draft', 'published', 'archived'] as const),
      viewCount: field.integer().min(0),
      ...timestamps(),
    })

    // Generate SQL
    const sql = toSQLSchema(Article)
    expect(sql).toContain('CREATE TABLE articles')
    expect(sql).toContain('title TEXT NOT NULL')
    expect(sql).toContain('slug TEXT NOT NULL UNIQUE')

    // Generate Zod schema
    const zodSchema = generateZodSchema(Article)
    const validArticle = {
      id: 1,
      title: 'Complete Guide to EdgeRecord',
      slug: 'edgerecord-guide',
      status: 'published' as const,
      viewCount: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(zodSchema.parse(validArticle)).toEqual(validArticle)
  })

  it('should export from ixflare/orm subpath', async () => {
    // This verifies the orm.ts entry point works
    const ormModule = await import('@/orm')

    expect(ormModule.defineModel).toBeDefined()
    expect(ormModule.field).toBeDefined()
    expect(ormModule.timestamps).toBeDefined()
    expect(ormModule.toSQLSchema).toBeDefined()
    expect(ormModule.generateZodSchema).toBeDefined()
  })
})
