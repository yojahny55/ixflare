/**
 * @module tests/edge-record/relations/builders
 * @description Tests for relationship builder functions
 */

import { describe, it, expect } from 'vitest'
import { defineModel } from '@/edge-record/schema/define-model'
import { field } from '@/edge-record/schema'
import { hasMany, hasOne, belongsTo, manyToMany } from '@/edge-record/relations/builders'

describe('hasMany()', () => {
  it('should create hasMany relation config', () => {
    const Post = defineModel('posts_hm_test', {
      id: field.id(),
      title: field.string(),
    })

    const relation = hasMany(() => Post, 'authorId')

    expect(relation.type).toBe('hasMany')
    expect(relation.foreignKey).toBe('authorId')
    expect(relation.localKey).toBe('id')
    expect(typeof relation.relatedModel).toBe('function')
    expect(relation.relatedModel()).toBe(Post)
  })

  it('should allow custom localKey', () => {
    const Post = defineModel('posts_hm_test2', {
      id: field.id(),
      title: field.string(),
    })

    const relation = hasMany(() => Post, 'userId', 'customId')

    expect(relation.localKey).toBe('customId')
    expect(relation.foreignKey).toBe('userId')
  })
})

describe('hasOne()', () => {
  it('should create hasOne relation config', () => {
    const Profile = defineModel('profiles_ho_test', {
      id: field.id(),
      bio: field.text().nullable(),
    })

    const relation = hasOne(() => Profile, 'userId')

    expect(relation.type).toBe('hasOne')
    expect(relation.foreignKey).toBe('userId')
    expect(relation.localKey).toBe('id')
    expect(typeof relation.relatedModel).toBe('function')
    expect(relation.relatedModel()).toBe(Profile)
  })

  it('should allow custom localKey', () => {
    const Profile = defineModel('profiles_ho_test2', {
      id: field.id(),
      bio: field.text().nullable(),
    })

    const relation = hasOne(() => Profile, 'ownerId', 'customId')

    expect(relation.localKey).toBe('customId')
    expect(relation.foreignKey).toBe('ownerId')
  })
})

describe('belongsTo()', () => {
  it('should create belongsTo relation config', () => {
    const User = defineModel('users_bt_test', {
      id: field.id(),
      name: field.string(),
    })

    const relation = belongsTo(() => User, 'authorId')

    expect(relation.type).toBe('belongsTo')
    expect(relation.foreignKey).toBe('authorId')
    expect(relation.localKey).toBe('id')
    expect(typeof relation.relatedModel).toBe('function')
    expect(relation.relatedModel()).toBe(User)
  })

  it('should allow custom ownerKey', () => {
    const User = defineModel('users_bt_test2', {
      id: field.id(),
      name: field.string(),
    })

    const relation = belongsTo(() => User, 'userId', 'customOwnerId')

    expect(relation.localKey).toBe('customOwnerId')
    expect(relation.foreignKey).toBe('userId')
  })
})

describe('manyToMany()', () => {
  it('should create manyToMany relation config', () => {
    const Tag = defineModel('tags_m2m_test', {
      id: field.id(),
      name: field.string(),
    })

    const relation = manyToMany(() => Tag, 'post_tags')

    expect(relation.type).toBe('manyToMany')
    expect(relation.pivotTable).toBe('post_tags')
    expect(typeof relation.relatedModel).toBe('function')
    expect(relation.relatedModel()).toBe(Tag)
  })

  it('should allow custom pivot keys', () => {
    const Tag = defineModel('tags_m2m_test2', {
      id: field.id(),
      name: field.string(),
    })

    const relation = manyToMany(() => Tag, 'post_tags', 'post_id', 'tag_id')

    expect(relation.pivotTable).toBe('post_tags')
    expect(relation.pivotForeignKey).toBe('post_id')
    expect(relation.pivotRelatedKey).toBe('tag_id')
  })
})

describe('defineModel() with relations', () => {
  it('should store relations config on model', () => {
    const Profile = defineModel('profiles_rel_test', {
      id: field.id(),
      bio: field.text().nullable(),
    })

    const Post = defineModel('posts_rel_test', {
      id: field.id(),
      title: field.string(),
    })

    const User = defineModel(
      'users_rel_test',
      {
        id: field.id(),
        email: field.string(),
      },
      {
        relations: {
          posts: hasMany(() => Post, 'authorId'),
          profile: hasOne(() => Profile, 'userId'),
        },
      }
    )

    expect(User.$relations).toBeDefined()
    expect(User.$relations).toHaveProperty('posts')
    expect(User.$relations).toHaveProperty('profile')
    expect(User.$relations?.posts.type).toBe('hasMany')
    expect(User.$relations?.profile.type).toBe('hasOne')
  })

  it('should support all relation types in one model', () => {
    const User = defineModel('users_mixed_test', {
      id: field.id(),
      name: field.string(),
    })

    const Post = defineModel('posts_mixed_test', {
      id: field.id(),
      title: field.string(),
    })

    const Profile = defineModel('profiles_mixed_test', {
      id: field.id(),
      bio: field.text().nullable(),
    })

    const Tag = defineModel('tags_mixed_test', {
      id: field.id(),
      name: field.string(),
    })

    const Article = defineModel(
      'articles_mixed_test',
      {
        id: field.id(),
        title: field.string(),
        authorId: field.integer(),
      },
      {
        relations: {
          author: belongsTo(() => User, 'authorId'),
          comments: hasMany(() => Post, 'articleId'),
          profile: hasOne(() => Profile, 'articleId'),
          tags: manyToMany(() => Tag, 'article_tags'),
        },
      }
    )

    expect(Article.$relations?.author.type).toBe('belongsTo')
    expect(Article.$relations?.comments.type).toBe('hasMany')
    expect(Article.$relations?.profile.type).toBe('hasOne')
    expect(Article.$relations?.tags.type).toBe('manyToMany')
  })

  it('should work with lazy model references to avoid circular dependencies', () => {
    // Define Post first without User reference
    const Post = defineModel('posts_circular_test', {
      id: field.id(),
      authorId: field.integer(),
      title: field.string(),
    })

    // Define User with lazy reference to Post (which already exists)
    const User = defineModel(
      'users_circular_test',
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

    // Now update Post with lazy reference to User
    const PostWithUser = defineModel(
      'posts_circular_test2',
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

    // Both should work
    expect(User.$relations?.posts.relatedModel()).toBe(Post)
    expect(PostWithUser.$relations?.author.relatedModel()).toBe(User)
  })
})
