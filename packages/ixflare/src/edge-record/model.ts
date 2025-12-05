/**
 * @module edge-record/model
 * @description Base model class for EdgeRecord
 */

import type { ModelDefinition } from './types'

export class Model {
  static tableName: string
  static schema: Record<string, unknown>

  id?: number
  createdAt?: number
  updatedAt?: number

  static async find<T extends Model>(this: new () => T, id: number): Promise<T | null> {
    // Placeholder - will be implemented in Epic 3
    console.log(`Finding ${this.name} with id ${id}`)
    return null
  }

  static async create<T extends Model>(this: new () => T, data: Partial<T>): Promise<T> {
    // Placeholder - will be implemented in Epic 3
    const instance = new this()
    Object.assign(instance, data, { createdAt: Date.now(), updatedAt: Date.now() })
    return instance
  }

  async save(): Promise<this> {
    // Placeholder - will be implemented in Epic 3
    this.updatedAt = Date.now()
    return this
  }

  async delete(): Promise<boolean> {
    // Placeholder - will be implemented in Epic 3
    return true
  }
}

export function defineModel(definition: ModelDefinition): typeof Model {
  class DefinedModel extends Model {
    static override tableName = definition.tableName
    static override schema = definition.schema
  }
  return DefinedModel
}
