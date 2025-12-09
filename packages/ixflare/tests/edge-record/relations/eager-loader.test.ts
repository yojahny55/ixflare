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

  describe('manyToMany relationship', () => {
    it('should load manyToMany relation through pivot table', async () => {
      const Tag = defineModel('tags_m2m', {
        id: field.id(),
        name: field.string(),
      })

      const Post = defineModel(
        'posts_m2m',
        {
          id: field.id(),
          title: field.string(),
        },
        {
          relations: {
            tags: manyToMany(() => Tag, 'post_tags', 'post_id', 'tag_id'),
          },
        }
      )

      // Insert test data
      await db.prepare('INSERT INTO posts_m2m (id, title) VALUES (?, ?)').bind(1, 'Post 1').run()
      await db.prepare('INSERT INTO tags_m2m (id, name) VALUES (?, ?)').bind(1, 'TypeScript').run()
      await db.prepare('INSERT INTO tags_m2m (id, name) VALUES (?, ?)').bind(2, 'JavaScript').run()
      await db.prepare('INSERT INTO tags_m2m (id, name) VALUES (?, ?)').bind(3, 'Rust').run()

      // Insert pivot table entries
      await db.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(1, 1).run()
      await db.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(1, 2).run()

      const posts = [new ModelInstance(Post, { id: 1, title: 'Post 1' })]

      const loader = new EagerLoader(Post, ['tags'])
      await loader.load(posts, db)

      expect((posts[0] as Record<string, unknown>).tags).toBeDefined()
      const tags = (posts[0] as Record<string, unknown>).tags as ModelInstance<typeof Tag.$schema>[]
      expect(Array.isArray(tags)).toBe(true)
      expect(tags.length).toBe(2)
      expect(tags.map((t) => t.get('name')).sort()).toEqual(['JavaScript', 'TypeScript'])
    })

    it('should handle empty manyToMany results', async () => {
      const Tag = defineModel('tags_m2m_empty', {
        id: field.id(),
        name: field.string(),
      })

      const Post = defineModel(
        'posts_m2m_empty',
        {
          id: field.id(),
          title: field.string(),
        },
        {
          relations: {
            tags: manyToMany(() => Tag, 'post_tags_empty', 'post_id', 'tag_id'),
          },
        }
      )

      // Post with no tags
      const posts = [new ModelInstance(Post, { id: 1, title: 'Post 1' })]

      const loader = new EagerLoader(Post, ['tags'])
      await loader.load(posts, db)

      expect((posts[0] as Record<string, unknown>).tags).toBeDefined()
      const tags = (posts[0] as Record<string, unknown>).tags
      expect(Array.isArray(tags)).toBe(true)
      expect((tags as unknown[]).length).toBe(0)
    })

    it('should load manyToMany with multiple parent records', async () => {
      const Tag = defineModel('tags_m2m_multi', {
        id: field.id(),
        name: field.string(),
      })

      const Post = defineModel(
        'posts_m2m_multi',
        {
          id: field.id(),
          title: field.string(),
        },
        {
          relations: {
            tags: manyToMany(() => Tag, 'post_tags_multi', 'post_id', 'tag_id'),
          },
        }
      )

      // Insert test data
      await db
        .prepare('INSERT INTO posts_m2m_multi (id, title) VALUES (?, ?)')
        .bind(1, 'Post 1')
        .run()
      await db
        .prepare('INSERT INTO posts_m2m_multi (id, title) VALUES (?, ?)')
        .bind(2, 'Post 2')
        .run()
      await db.prepare('INSERT INTO tags_m2m_multi (id, name) VALUES (?, ?)').bind(1, 'Tag A').run()
      await db.prepare('INSERT INTO tags_m2m_multi (id, name) VALUES (?, ?)').bind(2, 'Tag B').run()

      // Post 1 has Tag A, Post 2 has Tag A and Tag B
      await db
        .prepare('INSERT INTO post_tags_multi (post_id, tag_id) VALUES (?, ?)')
        .bind(1, 1)
        .run()
      await db
        .prepare('INSERT INTO post_tags_multi (post_id, tag_id) VALUES (?, ?)')
        .bind(2, 1)
        .run()
      await db
        .prepare('INSERT INTO post_tags_multi (post_id, tag_id) VALUES (?, ?)')
        .bind(2, 2)
        .run()

      const posts = [
        new ModelInstance(Post, { id: 1, title: 'Post 1' }),
        new ModelInstance(Post, { id: 2, title: 'Post 2' }),
      ]

      const loader = new EagerLoader(Post, ['tags'])
      await loader.load(posts, db)

      const post1Tags = (posts[0] as Record<string, unknown>).tags as ModelInstance<
        typeof Tag.$schema
      >[]
      const post2Tags = (posts[1] as Record<string, unknown>).tags as ModelInstance<
        typeof Tag.$schema
      >[]

      expect(post1Tags.length).toBe(1)
      expect(post1Tags[0].get('name')).toBe('Tag A')

      expect(post2Tags.length).toBe(2)
      expect(post2Tags.map((t) => t.get('name')).sort()).toEqual(['Tag A', 'Tag B'])
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

    it('should load nested relations from database', async () => {
      // Define models with nested relationships
      const User = defineModel('users_nested_load', {
        id: field.id(),
        name: field.string(),
      })

      const Post = defineModel(
        'posts_nested_load',
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

      const Comment = defineModel(
        'comments_nested_load',
        {
          id: field.id(),
          postId: field.integer(),
          content: field.string(),
        },
        {
          relations: {
            post: belongsTo(() => Post, 'postId'),
          },
        }
      )

      // Insert test data
      await db
        .prepare('INSERT INTO users_nested_load (id, name) VALUES (?, ?)')
        .bind(1, 'Alice')
        .run()
      await db
        .prepare('INSERT INTO posts_nested_load (id, author_id, title) VALUES (?, ?, ?)')
        .bind(1, 1, 'Post 1')
        .run()
      await db
        .prepare('INSERT INTO comments_nested_load (id, post_id, content) VALUES (?, ?, ?)')
        .bind(1, 1, 'Great post!')
        .run()

      const comments = [new ModelInstance(Comment, { id: 1, postId: 1, content: 'Great post!' })]

      // Load comment -> post -> author (nested)
      const loader = new EagerLoader(Comment, ['post', 'post.author'])
      await loader.load(comments, db)

      // Verify post is loaded
      const post = (comments[0] as Record<string, unknown>).post as ModelInstance<
        typeof Post.$schema
      >
      expect(post).not.toBeNull()
      expect(post.get('title')).toBe('Post 1')

      // Verify nested author is loaded
      const author = (post as Record<string, unknown>).author as ModelInstance<typeof User.$schema>
      expect(author).not.toBeNull()
      expect(author.get('name')).toBe('Alice')
    })
  })

  describe('pivot key computation', () => {
    it('should correctly singularize table names for pivot keys', async () => {
      // Test with a table name ending in -ies (categories -> category)
      // The model table name is 'categories' which should singularize to 'category'
      const Item = defineModel('items', {
        id: field.id(),
        name: field.string(),
      })

      const Category = defineModel(
        'categories',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            // Use default pivot key computation - should use category_id and item_id
            items: manyToMany(() => Item, 'category_items'),
          },
        }
      )

      // Insert test data
      await db
        .prepare('INSERT INTO categories (id, name) VALUES (?, ?)')
        .bind(1, 'Electronics')
        .run()
      await db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').bind(1, 'Phone').run()
      // Pivot table uses properly singularized keys: category_id (not categorie_id) and item_id
      await db
        .prepare('INSERT INTO category_items (category_id, item_id) VALUES (?, ?)')
        .bind(1, 1)
        .run()

      const categories = [new ModelInstance(Category, { id: 1, name: 'Electronics' })]

      const loader = new EagerLoader(Category, ['items'])
      await loader.load(categories, db)

      const items = (categories[0] as Record<string, unknown>).items as ModelInstance<
        typeof Item.$schema
      >[]
      expect(Array.isArray(items)).toBe(true)
      expect(items.length).toBe(1)
      expect(items[0].get('name')).toBe('Phone')
    })
  })

  describe('security', () => {
    it('should use parameterized queries for all relation loading', async () => {
      // This test verifies that queries use prepare().bind() pattern
      // by checking that special characters in data don't cause SQL injection
      const Profile = defineModel('profiles_sec', {
        id: field.id(),
        userId: field.integer(),
        bio: field.text().nullable(),
      })

      const User = defineModel(
        'users_sec',
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

      // Insert data with SQL injection attempt in the name
      await db
        .prepare('INSERT INTO users_sec (id, name) VALUES (?, ?)')
        .bind(1, "Robert'); DROP TABLE users;--")
        .run()
      await db
        .prepare('INSERT INTO profiles_sec (id, user_id, bio) VALUES (?, ?, ?)')
        .bind(1, 1, "Bio with special chars: '; DELETE FROM profiles;")
        .run()

      const users = [new ModelInstance(User, { id: 1, name: "Robert'); DROP TABLE users;--" })]

      const loader = new EagerLoader(User, ['profile'])
      // Should not throw - parameterized queries prevent injection
      await loader.load(users, db)

      const profile = (users[0] as Record<string, unknown>).profile as ModelInstance<
        typeof Profile.$schema
      >
      expect(profile).not.toBeNull()
      expect(profile.get('bio')).toBe("Bio with special chars: '; DELETE FROM profiles;")
    })

    it('should validate relation names against model relations', async () => {
      const User = defineModel(
        'users_rel_valid',
        {
          id: field.id(),
          name: field.string(),
        },
        {
          relations: {
            posts: hasMany(() => User, 'authorId'), // Self-reference for simplicity
          },
        }
      )

      const users = [new ModelInstance(User, { id: 1, name: 'Alice' })]

      // Attempt to load non-existent relation (potential injection vector)
      const loader = new EagerLoader(User, ['posts; DROP TABLE users'])

      await expect(loader.load(users, db)).rejects.toThrow(/Relation.*not found/)
    })
  })
})
