/**
 * @module edge-record/types
 * @description EdgeRecord type definitions
 */

export interface ModelDefinition {
  tableName: string
  schema: ModelSchema
}

export interface ModelSchema {
  [field: string]: FieldDefinition
}

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'json'
  required?: boolean
  default?: unknown
  primaryKey?: boolean
  unique?: boolean
  references?: {
    table: string
    column: string
  }
}

export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}
