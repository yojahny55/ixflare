/**
 * @module edge-record/seed
 * @description Seed execution context for tracking results and providing idempotent helpers
 */

import type { SeedResult } from './types'

/**
 * Global seed context for the current seed execution
 * This allows seeds to report created/skipped records
 */
let currentSeedContext: SeedContext | null = null

/**
 * Seed execution context that tracks created and skipped records
 */
export class SeedContext {
  private _name: string
  private _created: Record<string, number> = {}
  private _skipped: Record<string, number> = {}
  private _startTime: number

  constructor(name: string) {
    this._name = name
    this._startTime = Date.now()
  }

  /**
   * Record that a record was created
   * @param table Table/model name
   * @param count Number of records created (default: 1)
   */
  recordCreated(table: string, count = 1): void {
    this._created[table] = (this._created[table] || 0) + count
  }

  /**
   * Record that a record was skipped (already exists)
   * @param table Table/model name
   * @param count Number of records skipped (default: 1)
   */
  recordSkipped(table: string, count = 1): void {
    this._skipped[table] = (this._skipped[table] || 0) + count
  }

  /**
   * Get the seed result with timing and counts
   */
  getResult(): SeedResult {
    return {
      name: this._name,
      created: { ...this._created },
      skipped: { ...this._skipped },
      duration: Date.now() - this._startTime,
    }
  }
}

/**
 * Get the current seed context (if running inside a seed)
 * @returns Current SeedContext or null if not in a seed
 */
export function getSeedContext(): SeedContext | null {
  return currentSeedContext
}

/**
 * Set the current seed context (called by runner)
 * @param context The seed context or null to clear
 */
export function setSeedContext(context: SeedContext | null): void {
  currentSeedContext = context
}

/**
 * Track a created record in the current seed context
 * Safe to call even when not in a seed context
 * @param table Table/model name
 * @param count Number of records created (default: 1)
 */
export function trackCreated(table: string, count = 1): void {
  currentSeedContext?.recordCreated(table, count)
}

/**
 * Track a skipped record in the current seed context
 * Safe to call even when not in a seed context
 * @param table Table/model name
 * @param count Number of records skipped (default: 1)
 */
export function trackSkipped(table: string, count = 1): void {
  currentSeedContext?.recordSkipped(table, count)
}

/**
 * Helper for idempotent seeding - creates record or skips if exists
 * Wraps upsert operations and tracks the result
 *
 * @example
 * ```typescript
 * import { seed, idempotentCreate } from 'ixflare'
 * import { User } from '@/models'
 *
 * export default seed(async () => {
 *   // Uses upsert internally, tracks created vs skipped
 *   await idempotentCreate(User, { email: 'admin@example.com' }, {
 *     name: 'Admin User',
 *     role: 'admin',
 *   })
 * })
 * ```
 *
 * @param Model The model class with upsert method
 * @param uniqueFields Fields that identify the record (for conflict detection)
 * @param data Additional data to set if creating
 * @returns The created or existing record
 */
export async function idempotentCreate<T>(
  Model: {
    upsert: (data: Record<string, unknown>) => Promise<{ created: boolean; record: T }>
  },
  uniqueFields: Record<string, unknown>,
  data?: Record<string, unknown>
): Promise<T> {
  const modelName = (Model as { name?: string }).name || 'unknown'
  const result = await Model.upsert({ ...uniqueFields, ...data })

  if (result.created) {
    trackCreated(modelName)
  } else {
    trackSkipped(modelName)
  }

  return result.record
}
