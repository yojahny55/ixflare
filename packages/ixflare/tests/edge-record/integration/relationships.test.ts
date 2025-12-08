/**
 * @module tests/edge-record/integration/relationships
 * @description Integration tests for relationship queries via QueryBuilder
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema'
import { hasMany, hasOne, belongsTo, manyToMany } from '@/edge-record/relations/builders'
import { createRelationMockD1Database } from '../relations/mock-d1-relations'

describe('QueryBuilder Relationship Integration', () => {
  let db: D1Database

  beforeEach(() => {
    db = createRelationMockD1Database()
  })

  describe('.with() method', () => {
    it('should load hasMany relation via QueryBuilder', async () => {
      const Post = defineModel('posts_qb_hm', {
        id: field.id(),
        authorId: field.integer(),
        title: field.string(),
      })

      const User = defineModel(
        'users_qb_hm',
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

      // Insert test data
      await db.prepare('INSERT INTO users_qb_hm (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO posts_qb_hm (id, author_id, title) VALUES (?, ?, ?)')
        .bind(1, 1, 'Post 1')
        .run()
      await db
        .prepare('INSERT INTO posts_qb_hm (id, author_id, title) VALUES (?, ?, ?)')
        .bind(2, 1, 'Post 2')
        .run()

      // Query with relation loading
      const users = await User.with('posts').all(db)

      expect(users.length).toBe(1)
      const user = users[0]
      expect((user as Record<string, unknown>).posts).toBeDefined()
      const posts = (user as Record<string, unknown>).posts
      expect(Array.isArray(posts)).toBe(true)
      expect((posts as unknown[]).length).toBe(2)
    })

    it('should load hasOne relation via QueryBuilder', async () => {
      const Profile = defineModel('profiles_qb_ho', {
        id: field.id(),
        userId: field.integer(),
        bio: field.text().nullable(),
      })

      const User = defineModel(
        'users_qb_ho',
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

      await db.prepare('INSERT INTO users_qb_ho (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO profiles_qb_ho (id, user_id, bio) VALUES (?, ?, ?)')
        .bind(1, 1, 'Alice bio')
        .run()

      const users = await User.with('profile').all(db)

      expect(users.length).toBe(1)
      const user = users[0]
      const profile = (user as Record<string, unknown>).profile
      expect(profile).not.toBeNull()
    })

    it('should load multiple relations at once', async () => {
      const Post = defineModel('posts_qb_multi', {
        id: field.id(),
        authorId: field.integer(),
        title: field.string(),
      })

      const Profile = defineModel('profiles_qb_multi', {
        id: field.id(),
        userId: field.integer(),
        bio: field.text().nullable(),
      })

      const User = defineModel(
        'users_qb_multi',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            posts: hasMany(() => Post, 'authorId'),
            profile: hasOne(() => Profile, 'userId'),
          },
        }
      )

      await db.prepare('INSERT INTO users_qb_multi (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO posts_qb_multi (id, author_id, title) VALUES (?, ?, ?)')
        .bind(1, 1, 'Post 1')
        .run()
      await db
        .prepare('INSERT INTO profiles_qb_multi (id, user_id, bio) VALUES (?, ?, ?)')
        .bind(1, 1, 'Alice bio')
        .run()

      const users = await User.with('posts', 'profile').all(db)

      expect(users.length).toBe(1)
      const user = users[0]
      expect((user as Record<string, unknown>).posts).toBeDefined()
      expect((user as Record<string, unknown>).profile).toBeDefined()
    })

    it('should work with where() conditions', async () => {
      const Post = defineModel('posts_qb_where', {
        id: field.id(),
        authorId: field.integer(),
        title: field.string(),
      })

      const User = defineModel(
        'users_qb_where',
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

      await db.prepare('INSERT INTO users_qb_where (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db.prepare('INSERT INTO users_qb_where (id, name) VALUES (?, ?)').bind(2, 'Bob').run()
      await db
        .prepare('INSERT INTO posts_qb_where (id, author_id, title) VALUES (?, ?, ?)')
        .bind(1, 1, 'Post 1')
        .run()

      const users = await User.where({ name: 'Alice' }).with('posts').all(db)

      expect(users.length).toBe(1)
      expect(users[0].get('name')).toBe('Alice')
      expect((users[0] as Record<string, unknown>).posts).toBeDefined()
    })

    it('should work with first() method', async () => {
      const Profile = defineModel('profiles_qb_first', {
        id: field.id(),
        userId: field.integer(),
        bio: field.text().nullable(),
      })

      const User = defineModel(
        'users_qb_first',
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

      await db.prepare('INSERT INTO users_qb_first (id, name) VALUES (?, ?)').bind(1, 'Alice').run()
      await db
        .prepare('INSERT INTO profiles_qb_first (id, user_id, bio) VALUES (?, ?, ?)')
        .bind(1, 1, 'Alice bio')
        .run()

      const user = await User.with('profile').where({ name: 'Alice' }).first(db)

      expect(user).not.toBeNull()
      expect(user?.get('name')).toBe('Alice')
      expect((user as Record<string, unknown>).profile).toBeDefined()
    })
  })
})
