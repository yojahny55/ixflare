/**
 * @module tests/edge-record/relations/eager-loader
 * @description Tests for EagerLoader class
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema'
import { hasMany, hasOne, belongsTo, manyToMany } from '@/edge-record/relations/builders'
import { EagerLoader } from '@/edge-record/relations/eager-loader'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import { createRelationMockD1Database } from './mock-d1-relations'

describe('EagerLoader', () => {
  let db: D1Database

  beforeEach(() => {
    db = createRelationMockD1Database()
  })

  describe('hasMany relationship', () => {
    it('should load hasMany relation', async () => {
      // Define models
      const Post = defineModel('posts', {
        id: field.id(),
        authorId: field.integer(),
        title: field.string(),
      })

      const User = defineModel(
        'users',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            posts: hasMany(() => Post, 'authorId'),
          },
        }
      )

      // Insert test data via mock
      await db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO posts (id, author_id, title) VALUES (?, ?, ?)')
        .bind(1, 1, 'Post 1')
        .run()
      await db
        .prepare('INSERT INTO posts (id, author_id, title) VALUES (?, ?, ?)')
        .bind(2, 1, 'Post 2')
        .run()

      // Create user instances
      const users = [new ModelInstance(User, { id: 1, name: 'Alice' })]

      // Load relations
      const loader = new EagerLoader(User, ['posts'])
      await loader.load(users, db)

      // Verify
      expect((users[0] as Record<string, unknown>).posts).toBeDefined()
      const posts = (users[0] as Record<string, unknown>).posts as ModelInstance<
        typeof Post.$schema
      >[]
      expect(Array.isArray(posts)).toBe(true)
      expect(posts.length).toBe(2)
      expect(posts[0].get('title')).toBe('Post 1')
      expect(posts[1].get('title')).toBe('Post 2')
    })

    it('should handle empty hasMany results', async () => {
      const Post = defineModel('posts_empty', {
        id: field.id(),
        authorId: field.integer(),
        title: field.string(),
      })

      const User = defineModel(
        'users_empty',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            posts: hasMany(() => Post, 'authorId'),
          },
        }
      )

      // User with no posts
      const users = [new ModelInstance(User, { id: 1, name: 'Alice' })]

      const loader = new EagerLoader(User, ['posts'])
      await loader.load(users, db)

      expect((users[0] as Record<string, unknown>).posts).toBeDefined()
      const posts = (users[0] as Record<string, unknown>).posts
      expect(Array.isArray(posts)).toBe(true)
      expect((posts as unknown[]).length).toBe(0)
    })
  })

  describe('hasOne relationship', () => {
    it('should load hasOne relation', async () => {
      const Profile = defineModel('profiles', {
        id: field.id(),
        userId: field.integer(),
        bio: field.text().nullable(),
      })

      const User = defineModel(
        'users_ho',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            profile: hasOne(() => Profile, 'userId'),
          },
        }
      )

      // Insert test data
      await db.prepare('INSERT INTO users_ho (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO profiles (id, user_id, bio) VALUES (?, ?, ?)')
        .bind(1, 1, 'Alice bio')
        .run()

      const users = [new ModelInstance(User, { id: 1, name: 'Alice' })]

      const loader = new EagerLoader(User, ['profile'])
      await loader.load(users, db)

      expect((users[0] as Record<string, unknown>).profile).toBeDefined()
      const profile = (users[0] as Record<string, unknown>).profile as ModelInstance<
        typeof Profile.$schema
      >
      expect(profile).not.toBeNull()
      expect(profile.get('bio')).toBe('Alice bio')
    })

    it('should handle null hasOne results', async () => {
      const Profile = defineModel('profiles_null', {
        id: field.id(),
        userId: field.integer(),
        bio: field.text().nullable(),
      })

      const User = defineModel(
        'users_ho_null',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            profile: hasOne(() => Profile, 'userId'),
          },
        }
      )

      const users = [new ModelInstance(User, { id: 99, name: 'Alice' })]

      const loader = new EagerLoader(User, ['profile'])
      await loader.load(users, db)

      expect((users[0] as Record<string, unknown>).profile).toBeNull()
    })
  })

  describe('belongsTo relationship', () => {
    it('should load belongsTo relation', async () => {
      const User = defineModel('users_bt', {
        id: field.id(),
        name: field.string(),
      })

      const Post = defineModel(
        'posts_bt',
        {
          id: field.id(),
          authorId: field.integer(),
          title: field.string(),
        },
        {
          relations: {
            author: belongsTo(() => User, 'authorId'),
          },
        }
      )

      // Insert test data
      await db.prepare('INSERT INTO users_bt (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO posts_bt (id, author_id, title) VALUES (?, ?, ?)')
        .bind(1, 1, 'Post 1')
        .run()

      const posts = [new ModelInstance(Post, { id: 1, authorId: 1, title: 'Post 1' })]

      const loader = new EagerLoader(Post, ['author'])
      await loader.load(posts, db)

      expect((posts[0] as Record<string, unknown>).author).toBeDefined()
      const author = (posts[0] as Record<string, unknown>).author as ModelInstance<
        typeof User.$schema
      >
      expect(author).not.toBeNull()
      expect(author.get('name')).toBe('Alice')
    })
  })

  describe('relation validation', () => {
    it('should throw error for undefined relation', async () => {
      const Post = defineModel('posts_valid', {
        id: field.id(),
        title: field.string(),
      })

      const User = defineModel(
        'users_invalid',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            posts: hasMany(() => Post, 'authorId'),
          },
        }
      )

      const users = [new ModelInstance(User, { id: 1, name: 'Alice' })]

      const loader = new EagerLoader(User, ['invalidRelation'])

      await expect(loader.load(users, db)).rejects.toThrow(/Relation "invalidRelation" not found/)
    })

    it('should enforce maximum nesting depth', () => {
      const User = defineModel('users_depth', {
        id: field.id(),
        name: field.string(),
      })

      // Attempt to create loader with excessive depth
      expect(() => new EagerLoader(User, ['a'], 4)).toThrow(/Maximum eager loading nesting depth/)
    })
  })

  describe('nested eager loading', () => {
    it('should parse nested relations correctly', () => {
      const User = defineModel('users_nested', {
        id: field.id(),
        name: field.string(),
      })

      const loader = new EagerLoader(User, ['posts', 'posts.author', 'profile'])
      // @ts-expect-error - accessing private method for testing
      const grouped = loader.groupRelations(['posts', 'posts.author', 'profile'])

      expect(grouped.topLevel).toContain('posts')
      expect(grouped.topLevel).toContain('profile')
      expect(grouped.topLevel.length).toBe(2)
      expect(grouped.nested.posts).toContain('author')
    })
  })
})
