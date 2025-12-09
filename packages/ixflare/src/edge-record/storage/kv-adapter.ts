import type { Model, SchemaDefinition, InferSchema } from '../schema/types'
import { transformKeysToCamelCase, transformKeysToSnakeCase } from '../crud/case-transform'

export interface KVAdapterOptions {
  /** Expiration in seconds (minimum 60s per KV limits) */
  ttl?: number
}

/**
 * KV Storage Adapter for EdgeRecord
 *
 * Provides key-value storage using Cloudflare KV.
 * Best for:
 * - Simple key-value data with string primary keys
 * - High read volume, low write volume
 * - No complex queries or relations
 * - Auto-expiration via TTL
 *
 * Limits:
 * - 512 byte max key length
 * - 25MB max value size
 * - 1 write/sec per key
 * - 60s minimum TTL
 * - Eventual consistency
 */
export class KVAdapter<T extends SchemaDefinition> {
  constructor(
    private model: Model<T>,
    private kv: KVNamespace,
    private options?: KVAdapterOptions
  ) {
    // Validate TTL if provided
    if (options?.ttl && options.ttl < 60) {
      throw new Error(
        `KVAdapter: TTL must be at least 60 seconds (KV minimum). Got: ${options.ttl}s`
      )
    }
  }

  /**
   * Generate KV key for a record
   * Format: {tableName}:{id}
   */
  private getKey(id: string): string {
    return `${this.model.$tableName}:${id}`
  }

  /**
   * Get a record by ID
   * Returns null if not found
   */
  async get(id: string): Promise<InferSchema<T> | null> {
    const raw = await this.kv.get(this.getKey(id), 'json')
    if (!raw) return null
    return transformKeysToCamelCase(raw as Record<string, unknown>) as InferSchema<T>
  }

  /**
   * Store a record with optional TTL
   */
  async put(id: string, data: Partial<InferSchema<T>>): Promise<void> {
    const transformed = transformKeysToSnakeCase(data as Record<string, unknown>)
    await this.kv.put(
      this.getKey(id),
      JSON.stringify(transformed),
      this.options?.ttl ? { expirationTtl: this.options.ttl } : undefined
    )
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<void> {
    await this.kv.delete(this.getKey(id))
  }

  /**
   * List all keys with optional prefix filtering
   * Returns array of IDs (without table name prefix)
   */
  async list(prefix?: string): Promise<string[]> {
    const listPrefix = prefix
      ? `${this.model.$tableName}:${prefix}`
      : `${this.model.$tableName}:`
    const result = await this.kv.list({ prefix: listPrefix })
    return result.keys.map((k) => k.name.replace(`${this.model.$tableName}:`, ''))
  }
}
