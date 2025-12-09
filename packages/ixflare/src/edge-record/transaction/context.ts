/**
 * @module edge-record/transaction/context
 * @description TransactionContext implementation that buffers operations for batch execution
 */

import type { SchemaDefinition, Model } from '@/edge-record/schema/types'
import type { CreateInput } from '@/edge-record/crud/crud-operations'
import { ModelInstance } from '@/edge-record/crud/model-instance'
import type {
  TransactionContext,
  TransactionUpdateInput,
  ModifiedRecord,
  UpdateOperators,
} from './types'
import { ValidationError } from '@/edge-record/crud/errors'
import { toSnakeCase } from '@/edge-record/crud/case-transform'
import { escapeIdentifier } from '@/edge-record/schema/type-mapping'
import type { FieldBuilder } from '@/edge-record/schema/field'

/**
 * Built-in timestamp field names that are added automatically
 */
const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt'])

/**
 * Helper to get field type from schema
 * Returns 'datetime' for timestamp fields, extracts type from FieldBuilder, or defaults to 'string'
 */
function getFieldType(schemaEntry: unknown, fieldName?: string): string {
  // Handle timestamp fields that are added dynamically
  if (fieldName && TIMESTAMP_FIELDS.has(fieldName)) {
    return 'datetime'
  }

  if (typeof schemaEntry === 'object' && schemaEntry !== null && 'config' in schemaEntry) {
    return (schemaEntry as FieldBuilder).config.type
  }
  return 'string'
}

/**
 * Convert JavaScript value to D1-compatible value
 */
function toD1Value(value: unknown, fieldType: string): unknown {
  if (value === null || value === undefined) {
    return null
  }

  switch (fieldType) {
    case 'boolean':
      return value ? 1 : 0
    case 'datetime':
      if (value instanceof Date) {
        return value.getTime()
      }
      return value
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value)
    default:
      return value
  }
}

/**
 * Check if value is an update operator
 */
function isUpdateOperator(value: unknown): value is UpdateOperators {
  return (
    typeof value === 'object' && value !== null && ('increment' in value || 'decrement' in value)
  )
}

/**
 * Validate operator value
 */
function validateOperatorValue(operator: 'increment' | 'decrement', value: unknown): number {
  if (typeof value !== 'number' || value < 0) {
    throw new ValidationError(
      'INVALID_OPERATOR',
      `${operator} value must be a positive number, got: ${value}`
    )
  }
  return value
}

/**
 * TransactionContextImpl buffers operations and executes them via db.batch()
 */
export class TransactionContextImpl implements TransactionContext {
  private statements: D1PreparedStatement[] = []
  private modifiedRecords: ModifiedRecord[] = []
  private pendingInstances: Map<Model<SchemaDefinition>, ModelInstance<SchemaDefinition>[]> =
    new Map()
  public readonly _savepointDepth: number
  public readonly _parent?: TransactionContext

  constructor(
    private db: D1Database,
    options?: { parent?: TransactionContext }
  ) {
    this._parent = options?.parent
    this._savepointDepth = this._parent ? (this._parent._savepointDepth ?? 0) + 1 : 0
  }

  /**
   * Get the buffered statements
   * @internal
   */
  getStatements(): D1PreparedStatement[] {
    return this.statements
  }

  /**
   * Get the modified records for cache invalidation
   * @internal
   */
  getModifiedRecords(): ModifiedRecord[] {
    return this.modifiedRecords
  }

  /**
   * Add a statement to the transaction buffer
   * @internal
   */
  addStatement(stmt: D1PreparedStatement): void {
    this.statements.push(stmt)
  }

  /**
   * Create a new record in the transaction
   */
  async create<T extends SchemaDefinition>(
    model: Model<T>,
    data: CreateInput<T>
  ): Promise<ModelInstance<T>> {
    const tableName = escapeIdentifier(model.$tableName)
    const now = Date.now()

    // Prepare data with timestamps
    const fullData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    }

    // Transform to snake_case and build INSERT
    const columns: string[] = []
    const placeholders: string[] = []
    const values: unknown[] = []

    for (const [key, value] of Object.entries(fullData)) {
      const snakeKey = toSnakeCase(key)
      const fieldType = getFieldType(model.$schema[key as keyof T], key)

      columns.push(escapeIdentifier(snakeKey))
      placeholders.push('?')
      values.push(toD1Value(value, fieldType))
    }

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`
    const stmt = this.db.prepare(sql).bind(...values)
    this.addStatement(stmt)

    // Create a placeholder instance (ID will be assigned after batch)
    const instance = new ModelInstance(model, fullData as Partial<any>, false)

    // Store for later ID assignment
    if (!this.pendingInstances.has(model)) {
      this.pendingInstances.set(model, [])
    }
    this.pendingInstances.get(model)!.push(instance)

    // Track for cache invalidation (will use assigned ID after commit)
    this.modifiedRecords.push({
      model: model as Model<SchemaDefinition>,
      id: 0, // Placeholder, will be updated after batch
      operation: 'create',
    })

    return instance as ModelInstance<T>
  }

  /**
   * Update a record by ID in the transaction
   */
  async update<T extends SchemaDefinition>(
    model: Model<T>,
    id: string | number,
    data: TransactionUpdateInput<T>
  ): Promise<void> {
    const tableName = escapeIdentifier(model.$tableName)
    const setClauses: string[] = []
    const values: unknown[] = []

    // Add updatedAt timestamp
    const fullData = {
      ...data,
      updatedAt: Date.now(),
    }

    for (const [key, value] of Object.entries(fullData)) {
      const snakeKey = toSnakeCase(key)
      const escapedKey = escapeIdentifier(snakeKey)

      // Check if value is an operator
      if (isUpdateOperator(value)) {
        if ('increment' in value) {
          const amount = validateOperatorValue('increment', value.increment)
          setClauses.push(`${escapedKey} = ${escapedKey} + ?`)
          values.push(amount)
        } else if ('decrement' in value) {
          const amount = validateOperatorValue('decrement', value.decrement)
          setClauses.push(`${escapedKey} = ${escapedKey} - ?`)
          values.push(amount)
        }
      } else {
        // Regular update
        const fieldType = getFieldType(model.$schema[key as keyof T], key)
        setClauses.push(`${escapedKey} = ?`)
        values.push(toD1Value(value, fieldType))
      }
    }

    values.push(id)

    const sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`
    const stmt = this.db.prepare(sql).bind(...values)
    this.addStatement(stmt)

    // Track for cache invalidation
    this.modifiedRecords.push({
      model: model as Model<SchemaDefinition>,
      id,
      operation: 'update',
    })
  }

  /**
   * Delete a record by ID in the transaction
   */
  async delete<T extends SchemaDefinition>(model: Model<T>, id: string | number): Promise<void> {
    const tableName = escapeIdentifier(model.$tableName)
    const sql = `DELETE FROM ${tableName} WHERE id = ?`
    const stmt = this.db.prepare(sql).bind(id)
    this.addStatement(stmt)

    // Track for cache invalidation
    this.modifiedRecords.push({
      model: model as Model<SchemaDefinition>,
      id,
      operation: 'delete',
    })
  }

  /**
   * Get pending instances for ID assignment after batch execution
   * @internal
   */
  getPendingInstances(): Map<Model<SchemaDefinition>, ModelInstance<SchemaDefinition>[]> {
    return this.pendingInstances
  }
}
