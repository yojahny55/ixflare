/**
 * @module tests/edge-record/schema/define-model
 * @description Tests for defineModel function
 */

import { describe, it, expect } from 'vitest'
import { defineModel, getModel, clearModelRegistry } from '@/edge-record/schema/define-model'
import { field, timestamps } from '@/edge-record/schema'

describe('defineModel()', () => {
  it('should create a model with table name', () => {
    const User = defineModel('users_dm_test_1', {
      id: field.id(),
      email: field.string(),
    })

    expect(User.$tableName).toBe('users_dm_test_1')
  })

  it('should store schema definition', () => {
    const User = defineModel('users_dm_test_2', {
      id: field.id(),
      email: field.string(),
    })

    expect(User.$schema).toHaveProperty('id')
    expect(User.$schema).toHaveProperty('email')
  })

  it('should work with timestamp helper', () => {
    const User = defineModel('users_dm_test_3', {
      id: field.id(),
      email: field.string(),
      ...timestamps(),
    })

    expect(User.$schema).toHaveProperty('createdAt')
    expect(User.$schema).toHaveProperty('updatedAt')
  })

  it('should work with all field types', () => {
    const Post = defineModel('posts_dm_test', {
      id: field.id(),
      title: field.string(),
      content: field.text(),
      viewCount: field.integer(),
      price: field.decimal({ precision: 10, scale: 2 }),
      published: field.boolean(),
      publishedAt: field.datetime().nullable(),
      metadata: field.json<{ tags: string[] }>(),
      status: field.enum(['draft', 'published', 'archived'] as const),
    })

    expect(Post.$schema).toHaveProperty('id')
    expect(Post.$schema).toHaveProperty('title')
    expect(Post.$schema).toHaveProperty('content')
    expect(Post.$schema).toHaveProperty('viewCount')
    expect(Post.$schema).toHaveProperty('price')
    expect(Post.$schema).toHaveProperty('published')
    expect(Post.$schema).toHaveProperty('publishedAt')
    expect(Post.$schema).toHaveProperty('metadata')
    expect(Post.$schema).toHaveProperty('status')
  })

  it('should register model internally and be retrievable', () => {
    clearModelRegistry()
    const User = defineModel('users_registry_test', {
      id: field.id(),
      email: field.string(),
    })

    const retrieved = getModel('users_registry_test')
    expect(retrieved).toBeDefined()
    expect(retrieved?.$tableName).toBe('users_registry_test')
  })

  it('should have $infer type property', () => {
    const User = defineModel('users_infer_test', {
      id: field.id(),
      email: field.string(),
    })

    // $infer should exist (returns symbol at runtime to indicate type-only usage)
    expect(User).toHaveProperty('$infer')
    expect(typeof User.$infer).toBe('symbol')
  })

  it('should have $zodSchema property for runtime validation', () => {
    const User = defineModel('users_zod_test', {
      id: field.id(),
      email: field.string().min(5),
      name: field.string(),
    })

    expect(User.$zodSchema).toBeDefined()

    // Valid data should pass
    const validResult = User.$zodSchema.safeParse({
      id: 1,
      email: 'test@example.com',
      name: 'John',
    })
    expect(validResult.success).toBe(true)

    // Invalid data should fail
    const invalidResult = User.$zodSchema.safeParse({
      id: 1,
      email: 'a', // too short
      name: 'John',
    })
    expect(invalidResult.success).toBe(false)
  })

  it('should support optional options parameter', () => {
    const User = defineModel(
      'users_options_test',
      {
        id: field.id(),
        email: field.string(),
      },
      {
        // Options like timestamps: false, custom table prefix, etc.
        // Will be implemented as needed
      }
    )

    expect(User.$tableName).toBe('users_options_test')
  })

  it('should handle complex nested schemas', () => {
    const User = defineModel('users_nested_test', {
      id: field.id(),
      profile: field.json<{
        firstName: string
        lastName: string
        age: number
      }>(),
    })

    expect(User.$schema.profile.config.type).toBe('json')
  })
})
