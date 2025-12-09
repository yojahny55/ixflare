/**
 * @module edge-record/relations/eager-loader
 * @description Eager loading engine for model relationships
 */

import type { SchemaDefinition, InferSchema, Model } from '@/edge-record/schema/types'
import type { RelationConfig } from './types'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'
import { toSnakeCase, toCamelCase } from '@/edge-record/crud/case-transform'
import { ModelInstance } from '@/edge-record/crud/model-instance'

/**
 * D1 parameter limit - maximum bound parameters per query
 */
const D1_PARAM_LIMIT = 100

/**
 * Maximum nesting depth for eager loading (prevents circular dependency issues)
 */
const MAX_NESTING_DEPTH = 3

/**
 * Common irregular plural to singular mappings for pivot key computation
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  teeth: 'tooth',
  feet: 'foot',
  mice: 'mouse',
  geese: 'goose',
  data: 'datum',
  media: 'medium',
  analyses: 'analysis',
  criteria: 'criterion',
  phenomena: 'phenomenon',
}

/**
 * Words ending in 's' that are NOT plurals (should not be singularized)
 * These are common table names that would be incorrectly transformed
 */
const UNCOUNTABLE_OR_SINGULAR_S: Set<string> = new Set([
  'status',
  'news',
  'series',
  'species',
  'address',
  'business',
  'process',
  'progress',
  'access',
  'success',
  'mattress',
  'express',
  'canvas',
  'analysis',
  'basis',
  'crisis',
  'thesis',
  'synopsis',
  'diagnosis',
  'atlas',
  'bus',
  'gas',
  'lens',
  'alias',
  'campus',
  'corpus',
  'focus',
  'radius',
  'status',
  'virus',
  'bonus',
  'cactus',
  'census',
  'citrus',
  'exodus',
  'nexus',
  'surplus',
])

/**
 * Singularize a table name for pivot key computation
 * Handles common English pluralization rules
 *
 * @param tableName The plural table name (e.g., 'users', 'categories', 'people')
 * @returns The singular form (e.g., 'user', 'category', 'person')
 */
function singularize(tableName: string): string {
  const lower = tableName.toLowerCase()

  // Check irregular plurals first
  if (IRREGULAR_PLURALS[lower]) {
    return IRREGULAR_PLURALS[lower]
  }

  // Check if this is an uncountable noun or already singular (ends in 's' but not plural)
  if (UNCOUNTABLE_OR_SINGULAR_S.has(lower)) {
    return lower
  }

  // Common English plural rules (in order of specificity)
  // -ies → -y (categories → category)
  if (lower.endsWith('ies')) {
    return lower.slice(0, -3) + 'y'
  }

  // -es for words ending in s, x, z, ch, sh (boxes → box, watches → watch)
  if (lower.endsWith('xes') || lower.endsWith('zes')) {
    return lower.slice(0, -2)
  }
  if (lower.endsWith('ches') || lower.endsWith('shes') || lower.endsWith('sses')) {
    return lower.slice(0, -2)
  }

  // -ves → -f (wolves → wolf, leaves → leaf)
  if (lower.endsWith('ves')) {
    return lower.slice(0, -3) + 'f'
  }

  // Simple -s (users → user) - but not words ending in 'ss', 'us', 'is', 'os'
  // These are often Latin/Greek singulars or already singular
  if (
    lower.endsWith('s') &&
    !lower.endsWith('ss') &&
    !lower.endsWith('us') &&
    !lower.endsWith('is') &&
    !lower.endsWith('os')
  ) {
    return lower.slice(0, -1)
  }

  // No change (might already be singular or uncountable)
  return lower
}

/**
 * Type for model instance with dynamic related data
 */
export type ModelInstanceWithRelations<T extends SchemaDefinition> = ModelInstance<T> & {
  [relationName: string]: unknown
}

/**
 * EagerLoader handles loading related data for model relationships
 * Implements N+1 query prevention through batched IN queries
 *
 * @template T Schema definition of the parent model
 */
export class EagerLoader<T extends SchemaDefinition> {
  private model: Model<T>
  private relations: string[]
  private depth: number

  /**
   * @param model The parent model
   * @param relations Array of relation names to load (supports dot notation for nesting)
   * @param depth Current nesting depth (internal, defaults to 0)
   */
  constructor(model: Model<T>, relations: string[], depth: number = 0) {
    this.model = model
    this.relations = relations
    this.depth = depth

    if (depth > MAX_NESTING_DEPTH) {
      throw new Error(
        `Maximum eager loading nesting depth of ${MAX_NESTING_DEPTH} exceeded. ` +
          `This may indicate a circular dependency in your relations.`
      )
    }
  }

  /**
   * Load eager relations for a collection of records
   * Mutates records to add related data as properties
   *
   * @param records Array of model instances
   * @param db D1 database connection
   */
  async load(records: ModelInstanceWithRelations<T>[], db: D1Database): Promise<void> {
    if (records.length === 0) return
    if (!this.model.$relations) return

    // Group relations by top-level vs nested
    const relationGroups = this.groupRelations(this.relations)

    // Load each top-level relation
    for (const relationName of relationGroups.topLevel) {
      const relationConfig = this.model.$relations[relationName]
      if (!relationConfig) {
        throw new Error(
          `Relation "${relationName}" not found on model ${this.model.$tableName}. ` +
            `Available relations: ${Object.keys(this.model.$relations).join(', ')}`
        )
      }

      await this.loadRelation(records, relationName, relationConfig, db)
    }

    // Load nested relations recursively
    for (const [parentRelation, nestedRelations] of Object.entries(relationGroups.nested)) {
      // Get all related records from parent relation
      const allRelatedRecords: ModelInstanceWithRelations<SchemaDefinition>[] = []

      for (const record of records) {
        const relatedData = (record as Record<string, unknown>)[parentRelation]
        if (Array.isArray(relatedData)) {
          allRelatedRecords.push(...(relatedData as ModelInstanceWithRelations<SchemaDefinition>[]))
        } else if (relatedData) {
          allRelatedRecords.push(relatedData as ModelInstanceWithRelations<SchemaDefinition>)
        }
      }

      if (allRelatedRecords.length > 0) {
        const parentConfig = this.model.$relations[parentRelation]
        const relatedModel = parentConfig.relatedModel()

        // Create loader for nested relations
        const nestedLoader = new EagerLoader(
          relatedModel,
          nestedRelations as string[],
          this.depth + 1
        )
        await nestedLoader.load(allRelatedRecords, db)
      }
    }
  }

  /**
   * Group relations into top-level and nested
   * @param relations Array of relation strings (e.g., ['posts', 'profile', 'posts.author'])
   * @returns Grouped relations
   */
  private groupRelations(relations: string[]): {
    topLevel: string[]
    nested: Record<string, string[]>
  } {
    const topLevel = new Set<string>()
    const nested: Record<string, string[]> = {}

    for (const relation of relations) {
      if (relation.includes('.')) {
        const [parent, ...rest] = relation.split('.')
        topLevel.add(parent)
        if (!nested[parent]) nested[parent] = []
        nested[parent].push(rest.join('.'))
      } else {
        topLevel.add(relation)
      }
    }

    return { topLevel: Array.from(topLevel), nested }
  }

  /**
   * Load a single relation for all records
   */
  private async loadRelation(
    records: ModelInstanceWithRelations<T>[],
    relationName: string,
    config: RelationConfig,
    db: D1Database
  ): Promise<void> {
    switch (config.type) {
      case 'hasMany':
        await this.loadHasMany(records, relationName, config, db)
        break
      case 'hasOne':
        await this.loadHasOne(records, relationName, config, db)
        break
      case 'belongsTo':
        await this.loadBelongsTo(records, relationName, config, db)
        break
      case 'manyToMany':
        await this.loadManyToMany(records, relationName, config, db)
        break
    }
  }

  /**
   * Load hasMany relationship (one-to-many)
   * Parent has multiple related records
   */
  private async loadHasMany(
    records: ModelInstanceWithRelations<T>[],
    relationName: string,
    config: RelationConfig,
    db: D1Database
  ): Promise<void> {
    const relatedModel = config.relatedModel()
    const localKey = config.localKey || 'id'
    const foreignKey = config.foreignKey

    // Collect all local key values
    const localValues = records
      .map((r) => r.get(localKey as keyof InferSchema<T>))
      .filter((v) => v != null)

    if (localValues.length === 0) {
      // No valid keys, set empty arrays
      for (const record of records) {
        ;(record as Record<string, unknown>)[relationName] = []
      }
      return
    }

    // Load related records in batches (D1 limit)
    const relatedRecords = await this.batchLoadByForeignKey(
      relatedModel,
      foreignKey,
      localValues,
      db
    )

    // Group by foreign key value
    const grouped = new Map<unknown, ModelInstance<SchemaDefinition>[]>()
    for (const related of relatedRecords) {
      const fkValue = related.get(toCamelCase(foreignKey) as keyof InferSchema<SchemaDefinition>)
      if (!grouped.has(fkValue)) grouped.set(fkValue, [])
      grouped.get(fkValue)!.push(related)
    }

    // Attach to parent records
    for (const record of records) {
      const localValue = record.get(localKey as keyof InferSchema<T>)
      ;(record as Record<string, unknown>)[relationName] = grouped.get(localValue) || []
    }
  }

  /**
   * Load hasOne relationship (one-to-one)
   * Parent has exactly one related record
   */
  private async loadHasOne(
    records: ModelInstanceWithRelations<T>[],
    relationName: string,
    config: RelationConfig,
    db: D1Database
  ): Promise<void> {
    const relatedModel = config.relatedModel()
    const localKey = config.localKey || 'id'
    const foreignKey = config.foreignKey

    // Collect all local key values
    const localValues = records
      .map((r) => r.get(localKey as keyof InferSchema<T>))
      .filter((v) => v != null)

    if (localValues.length === 0) {
      // No valid keys, set all to null
      for (const record of records) {
        ;(record as Record<string, unknown>)[relationName] = null
      }
      return
    }

    // Load related records in batches
    const relatedRecords = await this.batchLoadByForeignKey(
      relatedModel,
      foreignKey,
      localValues,
      db
    )

    // Map by foreign key value (take first match for hasOne)
    const mapped = new Map<unknown, ModelInstance<SchemaDefinition>>()
    for (const related of relatedRecords) {
      const fkValue = related.get(toCamelCase(foreignKey) as keyof InferSchema<SchemaDefinition>)
      if (!mapped.has(fkValue)) {
        mapped.set(fkValue, related)
      }
    }

    // Attach to parent records
    for (const record of records) {
      const localValue = record.get(localKey as keyof InferSchema<T>)
      ;(record as Record<string, unknown>)[relationName] = mapped.get(localValue) || null
    }
  }

  /**
   * Load belongsTo relationship (inverse)
   * Child belongs to one parent
   */
  private async loadBelongsTo(
    records: ModelInstanceWithRelations<T>[],
    relationName: string,
    config: RelationConfig,
    db: D1Database
  ): Promise<void> {
    const relatedModel = config.relatedModel()
    const foreignKey = config.foreignKey
    const ownerKey = config.localKey || 'id'

    // Collect all foreign key values
    const foreignValues = records
      .map((r) => r.get(toCamelCase(foreignKey) as keyof InferSchema<T>))
      .filter((v) => v != null)

    if (foreignValues.length === 0) {
      // No valid keys, set all to null
      for (const record of records) {
        ;(record as Record<string, unknown>)[relationName] = null
      }
      return
    }

    // Load related records by owner key
    const relatedRecords = await this.batchLoadByOwnerKey(relatedModel, ownerKey, foreignValues, db)

    // Map by owner key
    const mapped = new Map<unknown, ModelInstance<SchemaDefinition>>()
    for (const related of relatedRecords) {
      const ownerValue = related.get(toCamelCase(ownerKey) as keyof InferSchema<SchemaDefinition>)
      mapped.set(ownerValue, related)
    }

    // Attach to parent records
    for (const record of records) {
      const foreignValue = record.get(toCamelCase(foreignKey) as keyof InferSchema<T>)
      ;(record as Record<string, unknown>)[relationName] = mapped.get(foreignValue) || null
    }
  }

  /**
   * Load manyToMany relationship through pivot table
   * Records are related through an intermediate table
   */
  private async loadManyToMany(
    records: ModelInstanceWithRelations<T>[],
    relationName: string,
    config: RelationConfig,
    db: D1Database
  ): Promise<void> {
    const relatedModel = config.relatedModel()
    const pivotTable = config.pivotTable!

    // Compute pivot keys if not provided using proper singularization
    const pivotForeignKey =
      config.pivotForeignKey || `${toSnakeCase(singularize(this.model.$tableName))}_id`
    const pivotRelatedKey =
      config.pivotRelatedKey || `${toSnakeCase(singularize(relatedModel.$tableName))}_id`

    // Collect all parent IDs
    const parentIds = records
      .map((r) => r.get('id' as keyof InferSchema<T>))
      .filter((v) => v != null)

    if (parentIds.length === 0) {
      for (const record of records) {
        ;(record as Record<string, unknown>)[relationName] = []
      }
      return
    }

    // Step 1: Load pivot table entries
    const pivotEntries = await this.batchLoadPivotEntries(
      pivotTable,
      pivotForeignKey,
      parentIds,
      db
    )

    // Group pivot entries by parent ID
    const pivotByParent = new Map<unknown, unknown[]>()
    for (const entry of pivotEntries) {
      const parentId = entry[toCamelCase(pivotForeignKey)]
      const relatedId = entry[toCamelCase(pivotRelatedKey)]
      if (!pivotByParent.has(parentId)) pivotByParent.set(parentId, [])
      pivotByParent.get(parentId)!.push(relatedId)
    }

    // Step 2: Load all related records by ID
    const allRelatedIds = Array.from(
      new Set(pivotEntries.map((e) => e[toCamelCase(pivotRelatedKey)]))
    )

    if (allRelatedIds.length === 0) {
      for (const record of records) {
        ;(record as Record<string, unknown>)[relationName] = []
      }
      return
    }

    const relatedRecords = await this.batchLoadByOwnerKey(relatedModel, 'id', allRelatedIds, db)

    // Map related records by ID
    const relatedById = new Map<unknown, ModelInstance<SchemaDefinition>>()
    for (const related of relatedRecords) {
      const id = related.get('id' as keyof InferSchema<SchemaDefinition>)
      relatedById.set(id, related)
    }

    // Attach to parent records
    for (const record of records) {
      const parentId = record.get('id' as keyof InferSchema<T>)
      const relatedIds = pivotByParent.get(parentId) || []
      const relatedInstances = relatedIds.map((id) => relatedById.get(id)).filter((r) => r != null)
      ;(record as Record<string, unknown>)[relationName] = relatedInstances
    }
  }

  /**
   * Batch load records by foreign key
   * Handles D1 parameter limit by chunking
   */
  private async batchLoadByForeignKey(
    model: Model<SchemaDefinition>,
    foreignKey: string,
    values: unknown[],
    db: D1Database
  ): Promise<ModelInstance<SchemaDefinition>[]> {
    const results: ModelInstance<SchemaDefinition>[] = []
    const chunks = this.chunk(values, D1_PARAM_LIMIT)

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(', ')
      const sql = `SELECT * FROM ${escapeIdentifier(model.$tableName)} WHERE ${escapeIdentifier(toSnakeCase(foreignKey))} IN (${placeholders})`
      const stmt = db.prepare(sql).bind(...chunk)
      const result = await stmt.all()

      for (const row of result.results) {
        results.push(new ModelInstance(model, row as Record<string, unknown>))
      }
    }

    return results
  }

  /**
   * Batch load records by owner key (typically 'id')
   */
  private async batchLoadByOwnerKey(
    model: Model<SchemaDefinition>,
    ownerKey: string,
    values: unknown[],
    db: D1Database
  ): Promise<ModelInstance<SchemaDefinition>[]> {
    const results: ModelInstance<SchemaDefinition>[] = []
    const chunks = this.chunk(values, D1_PARAM_LIMIT)

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(', ')
      const sql = `SELECT * FROM ${escapeIdentifier(model.$tableName)} WHERE ${escapeIdentifier(toSnakeCase(ownerKey))} IN (${placeholders})`
      const stmt = db.prepare(sql).bind(...chunk)
      const result = await stmt.all()

      for (const row of result.results) {
        results.push(new ModelInstance(model, row as Record<string, unknown>))
      }
    }

    return results
  }

  /**
   * Batch load pivot table entries
   */
  private async batchLoadPivotEntries(
    pivotTable: string,
    foreignKey: string,
    values: unknown[],
    db: D1Database
  ): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = []
    const chunks = this.chunk(values, D1_PARAM_LIMIT)

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(', ')
      const sql = `SELECT * FROM ${escapeIdentifier(pivotTable)} WHERE ${escapeIdentifier(foreignKey)} IN (${placeholders})`
      const stmt = db.prepare(sql).bind(...chunk)
      const result = await stmt.all()

      for (const row of result.results) {
        // Transform snake_case to camelCase
        const transformed: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
          transformed[toCamelCase(key)] = value
        }
        results.push(transformed)
      }
    }

    return results
  }

  /**
   * Chunk array into smaller arrays
   * @param array Array to chunk
   * @param size Max chunk size
   */
  private chunk<U>(array: U[], size: number): U[][] {
    const chunks: U[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
