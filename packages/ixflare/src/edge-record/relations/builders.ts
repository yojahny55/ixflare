/**
 * @module edge-record/relations/builders
 * @description Relationship builder functions for defining model relations
 */

import type { SchemaDefinition, Model } from '@/edge-record/schema/types'
import type { RelationConfig } from './types'

/**
 * Define a hasMany relationship (one-to-many)
 *
 * A hasMany relationship indicates the parent model has multiple related records.
 * For example, a User hasMany Posts.
 *
 * @template T Schema definition of the related model
 * @param model Lazy function returning the related model (prevents circular dependencies)
 * @param foreignKey Name of the foreign key field in the related table
 * @param localKey Name of the local key field (defaults to 'id')
 * @returns Relationship configuration
 *
 * @example
 * ```typescript
 * const User = defineModel('users', { ... }, {
 *   relations: {
 *     posts: hasMany(() => Post, 'authorId')
 *   }
 * })
 *
 * // Usage
 * const user = await User.with('posts').find(1, db)
 * user.posts // Post[]
 * ```
 */
export function hasMany<T extends SchemaDefinition>(
  model: () => Model<T>,
  foreignKey: string,
  localKey: string = 'id'
): RelationConfig<T> {
  return {
    type: 'hasMany',
    relatedModel: model,
    foreignKey,
    localKey,
  }
}

/**
 * Define a hasOne relationship (one-to-one)
 *
 * A hasOne relationship indicates the parent model has exactly one related record.
 * For example, a User hasOne Profile.
 *
 * @template T Schema definition of the related model
 * @param model Lazy function returning the related model (prevents circular dependencies)
 * @param foreignKey Name of the foreign key field in the related table
 * @param localKey Name of the local key field (defaults to 'id')
 * @returns Relationship configuration
 *
 * @example
 * ```typescript
 * const User = defineModel('users', { ... }, {
 *   relations: {
 *     profile: hasOne(() => Profile, 'userId')
 *   }
 * })
 *
 * // Usage
 * const user = await User.with('profile').find(1, db)
 * user.profile // Profile | null
 * ```
 */
export function hasOne<T extends SchemaDefinition>(
  model: () => Model<T>,
  foreignKey: string,
  localKey: string = 'id'
): RelationConfig<T> {
  return {
    type: 'hasOne',
    relatedModel: model,
    foreignKey,
    localKey,
  }
}

/**
 * Define a belongsTo relationship (inverse of hasOne/hasMany)
 *
 * A belongsTo relationship indicates the model belongs to a parent record.
 * For example, a Post belongsTo User.
 *
 * @template T Schema definition of the related model
 * @param model Lazy function returning the related model (prevents circular dependencies)
 * @param foreignKey Name of the foreign key field in this table
 * @param ownerKey Name of the owner key field in the parent table (defaults to 'id')
 * @returns Relationship configuration
 *
 * @example
 * ```typescript
 * const Post = defineModel('posts', {
 *   id: field.id(),
 *   authorId: field.integer().references(User, 'id'),
 *   ...
 * }, {
 *   relations: {
 *     author: belongsTo(() => User, 'authorId')
 *   }
 * })
 *
 * // Usage
 * const post = await Post.with('author').find(1, db)
 * post.author // User
 * ```
 */
export function belongsTo<T extends SchemaDefinition>(
  model: () => Model<T>,
  foreignKey: string,
  ownerKey: string = 'id'
): RelationConfig<T> {
  return {
    type: 'belongsTo',
    relatedModel: model,
    foreignKey,
    localKey: ownerKey,
  }
}

/**
 * Define a manyToMany relationship through a pivot table
 *
 * A manyToMany relationship indicates the model has multiple related records
 * and vice versa, connected through an intermediate pivot table.
 * For example, Posts have many Tags, and Tags have many Posts.
 *
 * @template T Schema definition of the related model
 * @param model Lazy function returning the related model (prevents circular dependencies)
 * @param pivotTable Name of the pivot/junction table
 * @param foreignKey Foreign key in pivot table (defaults to `{thisTable}_id`)
 * @param relatedKey Related key in pivot table (defaults to `{relatedTable}_id`)
 * @returns Relationship configuration
 *
 * @example
 * ```typescript
 * const Post = defineModel('posts', { ... }, {
 *   relations: {
 *     tags: manyToMany(() => Tag, 'post_tags')
 *   }
 * })
 *
 * const Tag = defineModel('tags', { ... }, {
 *   relations: {
 *     posts: manyToMany(() => Post, 'post_tags')
 *   }
 * })
 *
 * // Usage
 * const post = await Post.with('tags').find(1, db)
 * post.tags // Tag[]
 * ```
 */
export function manyToMany<T extends SchemaDefinition>(
  model: () => Model<T>,
  pivotTable: string,
  foreignKey?: string,
  relatedKey?: string
): RelationConfig<T> {
  // Validate pivot table name format (should be snake_case with underscore)
  if (!pivotTable || !/^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)+$/.test(pivotTable)) {
    console.warn(
      `[EdgeRecord] Pivot table name "${pivotTable}" may not follow the recommended ` +
        `convention. Expected format: {table1}_{table2} in snake_case (e.g., "post_tags", "user_roles").`
    )
  }

  return {
    type: 'manyToMany',
    relatedModel: model,
    foreignKey: foreignKey || '', // Will be computed later if not provided
    pivotTable,
    pivotForeignKey: foreignKey,
    pivotRelatedKey: relatedKey,
  }
}
