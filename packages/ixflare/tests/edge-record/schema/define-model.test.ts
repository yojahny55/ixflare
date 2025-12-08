/**
 * @module tests/edge-record/schema/define-model
 * @description Tests for defineModel function
 */

import { describe, it, expect } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field, timestamps } from '@/edge-record/schema'

describe('defineModel()', () => {
  it('should create a model with table name', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
    })

    expect(User.$tableName).toBe('users')
  })

  it('should store schema definition', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
    })

    expect(User.$schema).toHaveProperty('id')
    expect(User.$schema).toHaveProperty('email')
  })

  it('should work with timestamp helper', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
      ...timestamps(),
    })

    expect(User.$schema).toHaveProperty('createdAt')
    expect(User.$schema).toHaveProperty('updatedAt')
  })

  it('should work with all field types', () => {
    const Post = defineModel('posts', {
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

  it('should register model internally', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
    })

    // Model should be registered (implementation will provide access later)
    expect(User.$tableName).toBeDefined()
    expect(User.$schema).toBeDefined()
  })

  it('should have $infer type property', () => {
    const User = defineModel('users', {
      id: field.id(),
      email: field.string(),
    })

    // $infer should exist (type-level only, no runtime value)
    expect(User).toHaveProperty('$infer')
  })

  it('should support optional options parameter', () => {
    const User = defineModel(
      'users',
      {
        id: field.id(),
        email: field.string(),
      },
      {
        // Options like timestamps: false, custom table prefix, etc.
        // Will be implemented as needed
      }
    )

    expect(User.$tableName).toBe('users')
  })

  it('should handle complex nested schemas', () => {
    const User = defineModel('users', {
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
