/**
 * @module edge-record/relations/types
 * @description Type definitions for model relationships
 */

import type { SchemaDefinition, Model } from '@/edge-record/schema/types'

/**
 * Relationship type discriminator
 */
export type RelationType = 'hasMany' | 'hasOne' | 'belongsTo' | 'manyToMany'

/**
 * Configuration for a single relationship
 *
 * @template T The schema definition of the related model
 */
export interface RelationConfig<T extends SchemaDefinition = SchemaDefinition> {
  /** The type of relationship */
  type: RelationType
  /** Lazy function that returns the related model (prevents circular dependency issues) */
  relatedModel: () => Model<T>
  /** Foreign key field name */
  foreignKey: string
  /** Local key field name (defaults to 'id') */
  localKey?: string
  /** Pivot table name (for manyToMany only) */
  pivotTable?: string
  /** Foreign key in pivot table (for manyToMany only) */
  pivotForeignKey?: string
  /** Related key in pivot table (for manyToMany only) */
  pivotRelatedKey?: string
}

/**
 * Collection of named relationships for a model
 *
 * @example
 * ```typescript
 * const User = defineModel('users', { ... }, {
 *   relations: {
 *     posts: hasMany(() => Post, 'authorId'),
 *     profile: hasOne(() => Profile, 'userId')
 *   }
 * })
 * ```
 */
export type RelationsConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [relationName: string]: RelationConfig<any>
}
