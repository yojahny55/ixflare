/**
 * @module tests/edge-record/schema/foreign-key
 * @description Tests for foreign key support
 */

import { describe, it, expect } from 'vitest'
import { defineModel, field } from '@/edge-record/schema'

describe('Foreign Key Support', () => {
  it('should create foreign key field with references()', () => {
    const User = defineModel('users', {
      id: field.id(),
      name: field.string(),
    })

    const Post = defineModel('posts', {
      id: field.id(),
      userId: field.integer().references(User, 'id'),
      title: field.string(),
    })

    expect(Post.$schema.userId.config.references).toBeDefined()
    expect(Post.$schema.userId.config.references?.model).toBe(User)
    expect(Post.$schema.userId.config.references?.column).toBe('id')
  })

  it('should default to "id" column when not specified', () => {
    const User = defineModel('users', {
      id: field.id(),
      name: field.string(),
    })

    const Post = defineModel('posts', {
      id: field.id(),
      userId: field.integer().references(User),
      title: field.string(),
    })

    expect(Post.$schema.userId.config.references?.column).toBe('id')
  })

  it('should store foreign key metadata for relationship building', () => {
    const Category = defineModel('categories', {
      id: field.id(),
      name: field.string(),
    })

    const Product = defineModel('products', {
      id: field.id(),
      categoryId: field.integer().references(Category, 'id'),
      name: field.string(),
    })

    const fkConfig = Product.$schema.categoryId.config.references

    expect(fkConfig).toMatchObject({
      model: Category,
      column: 'id',
    })
  })

  it('should work with nullable foreign keys', () => {
    const Author = defineModel('authors', {
      id: field.id(),
      name: field.string(),
    })

    const Book = defineModel('books', {
      id: field.id(),
      authorId: field.integer().nullable().references(Author),
      title: field.string(),
    })

    expect(Book.$schema.authorId.config.nullable).toBe(true)
    expect(Book.$schema.authorId.config.references).toBeDefined()
  })

  it('should chain modifiers with references()', () => {
    const Team = defineModel('teams', {
      id: field.id(),
      name: field.string(),
    })

    const Member = defineModel('members', {
      id: field.id(),
      teamId: field.integer().references(Team).min(1),
      name: field.string(),
    })

    expect(Member.$schema.teamId.config.references?.model).toBe(Team)
    expect(Member.$schema.teamId.config.min).toBe(1)
  })
})
