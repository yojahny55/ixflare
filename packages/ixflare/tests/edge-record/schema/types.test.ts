/**
 * @module tests/edge-record/schema/types
 * @description Type-level tests for schema type inference
 *
 * These tests verify TypeScript type inference at compile-time.
 * They will fail during typecheck if type inference is incorrect.
 */

import { describe, it, expectTypeOf } from 'vitest'
import { defineModel, field, timestamps } from '@/edge-record/schema'
import type { InferSchema } from '@/edge-record/schema/types'

describe('Type Inference Tests', () => {
  it('should infer basic field types correctly', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
      age: field.integer(),
      active: field.boolean(),
      createdAt: field.datetime(),
    })

    type InferredUser = typeof User.$infer

    expectTypeOf<InferredUser['id']>().toEqualTypeOf<number>()
    expectTypeOf<InferredUser['email']>().toEqualTypeOf<string>()
    expectTypeOf<InferredUser['age']>().toEqualTypeOf<number>()
    expectTypeOf<InferredUser['active']>().toEqualTypeOf<boolean>()
    expectTypeOf<InferredUser['createdAt']>().toEqualTypeOf<Date>()
  })

  it('should infer nullable fields as T | null', () => {
    const Post = defineModel('posts', {
      id: field.id(),
      title: field.string(),
      bio: field.text().nullable(),
      publishedAt: field.datetime().nullable(),
    })

    type InferredPost = typeof Post.$infer

    expectTypeOf<InferredPost['bio']>().toEqualTypeOf<string | null>()
    expectTypeOf<InferredPost['publishedAt']>().toEqualTypeOf<Date | null>()
    expectTypeOf<InferredPost['title']>().toEqualTypeOf<string>() // Not nullable
  })

  it('should infer enum fields as union literal types', () => {
    const Article = defineModel('articles', {
      id: field.id(),
      status: field.enum(['draft', 'published', 'archived'] as const),
      role: field.enum(['user', 'admin'] as const),
    })

    type InferredArticle = typeof Article.$infer

    expectTypeOf<InferredArticle['status']>().toEqualTypeOf<'draft' | 'published' | 'archived'>()
    expectTypeOf<InferredArticle['role']>().toEqualTypeOf<'user' | 'admin'>()
  })

  it('should infer json field types with generics', () => {
    const Product = defineModel('products', {
      id: field.id(),
      metadata: field.json<{ tags: string[]; featured: boolean }>(),
      settings: field.json<Record<string, unknown>>(),
    })

    type InferredProduct = typeof Product.$infer

    expectTypeOf<InferredProduct['metadata']>().toEqualTypeOf<{
      tags: string[]
      featured: boolean
    }>()
    expectTypeOf<InferredProduct['settings']>().toEqualTypeOf<Record<string, unknown>>()
  })

  it('should infer timestamps helper fields correctly', () => {
    const Comment = defineModel('comments', {
      id: field.id(),
      text: field.string(),
      ...timestamps(),
    })

    type InferredComment = typeof Comment.$infer

    expectTypeOf<InferredComment['createdAt']>().toEqualTypeOf<Date>()
    expectTypeOf<InferredComment['updatedAt']>().toEqualTypeOf<Date>()
  })

  it('should infer decimal/real fields as number', () => {
    const Order = defineModel('orders', {
      id: field.id(),
      total: field.decimal({ precision: 10, scale: 2 }),
      tax: field.decimal({ precision: 10, scale: 2 }),
    })

    type InferredOrder = typeof Order.$infer

    expectTypeOf<InferredOrder['total']>().toEqualTypeOf<number>()
    expectTypeOf<InferredOrder['tax']>().toEqualTypeOf<number>()
  })

  it('should make all schema fields accessible', () => {
    const Todo = defineModel('todos', {
      id: field.id(),
      title: field.string(),
      completed: field.boolean(),
      dueDate: field.datetime().nullable(),
    })

    type InferredTodo = typeof Todo.$infer

    // All fields should be accessible
    expectTypeOf<InferredTodo>().toHaveProperty('id')
    expectTypeOf<InferredTodo>().toHaveProperty('title')
    expectTypeOf<InferredTodo>().toHaveProperty('completed')
    expectTypeOf<InferredTodo>().toHaveProperty('dueDate')
  })

  it('should infer complex nested schemas', () => {
    const User = defineModel('users', {
      id: field.id(),
      profile: field.json<{
        firstName: string
        lastName: string
        address: {
          street: string
          city: string
          country: string
        }
      }>(),
    })

    type InferredUser = typeof User.$infer

    expectTypeOf<InferredUser['profile']>().toMatchTypeOf<{
      firstName: string
      lastName: string
      address: {
        street: string
        city: string
        country: string
      }
    }>()
  })

  it('should not allow invalid field names at type level', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
      name: field.string(),
    })

    type InferredUser = typeof User.$infer

    // Valid field names should be accessible
    expectTypeOf<InferredUser['email']>().toBeString()

    // Invalid field names would cause compile error (tested by TypeScript itself)
    // @ts-expect-error - 'invalidField' does not exist on InferredUser
    expectTypeOf<InferredUser['invalidField']>().toBeNever()
  })

  it('should support field modifiers without affecting base type', () => {
    const Product = defineModel('products', {
      id: field.id(),
      name: field.string().min(3).max(100).unique(),
      price: field.decimal({ precision: 10, scale: 2 }).positive(),
      stock: field.integer().min(0).max(9999),
    })

    type InferredProduct = typeof Product.$infer

    // Modifiers don't change the base type
    expectTypeOf<InferredProduct['name']>().toEqualTypeOf<string>()
    expectTypeOf<InferredProduct['price']>().toEqualTypeOf<number>()
    expectTypeOf<InferredProduct['stock']>().toEqualTypeOf<number>()
  })

  it('should correctly infer with foreign key references', () => {
    const Author = defineModel('authors', {
      id: field.id(),
      name: field.string(),
    })

    const Book = defineModel('books', {
      id: field.id(),
      authorId: field.integer().references(Author),
      title: field.string(),
    })

    type InferredBook = typeof Book.$infer

    // Foreign key should still be inferred as integer
    expectTypeOf<InferredBook['authorId']>().toEqualTypeOf<number>()
  })
})

describe('InferSchema Type Helper', () => {
  it('should correctly infer schema from field definitions', () => {
    const schema = {
      id: field.id(),
      email: field.string(),
      age: field.integer(),
    }

    type Inferred = InferSchema<typeof schema>

    expectTypeOf<Inferred['id']>().toEqualTypeOf<number>()
    expectTypeOf<Inferred['email']>().toEqualTypeOf<string>()
    expectTypeOf<Inferred['age']>().toEqualTypeOf<number>()
  })

  it('should handle nullable fields in InferSchema', () => {
    const schema = {
      name: field.string(),
      bio: field.text().nullable(),
    }

    type Inferred = InferSchema<typeof schema>

    expectTypeOf<Inferred['name']>().toEqualTypeOf<string>()
    expectTypeOf<Inferred['bio']>().toEqualTypeOf<string | null>()
  })
})
