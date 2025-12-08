/**
 * @module edge-record/relations
 * @description Exports for EdgeRecord relationship system
 */

export { hasMany, hasOne, belongsTo, manyToMany } from './builders'
export type { RelationConfig, RelationType, RelationsConfig } from './types'
export { EagerLoader, type ModelInstanceWithRelations } from './eager-loader'
