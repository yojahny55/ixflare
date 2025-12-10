/**
 * @module edge-record/consistency/types
 * @description Type definitions for multi-tier consistency management
 */

/**
 * Cache invalidation strategies
 *
 * - immediate: Invalidate cache immediately after write (default)
 * - lazy: Don't invalidate, let cache expire naturally via TTL
 * - none: No automatic invalidation (manual control)
 */
export type InvalidationStrategy = 'immediate' | 'lazy' | 'none'

/**
 * Consistency levels for model operations
 *
 * - eventual: KV-first writes, eventual consistency (fastest, ~5-20ms)
 * - balanced: D1-primary with optional KV cache (default, ~20-50ms)
 * - strong: DO-backed, strong consistency guarantees (~50-100ms)
 */
export type ConsistencyLevel = 'eventual' | 'balanced' | 'strong'

/**
 * Write-through caching mode
 *
 * When enabled, writes populate both D1 and KV simultaneously
 * instead of writing to D1 and letting cache populate on read miss
 */
export interface WriteThroughOptions {
  /** Enable write-through caching */
  enabled: boolean
  /** Handle partial failures (e.g., D1 success but KV failure) */
  rollbackOnPartialFailure?: boolean
}

/**
 * Consistency coordinator options for DO-based write coordination
 */
export interface CoordinatorOptions {
  /** Invalidate KV cache after write */
  invalidateKV?: boolean
  /** Sync to D1 after DO write */
  syncToD1?: boolean
  /** Broadcast to subscribers */
  broadcast?: boolean
}

/**
 * Extended cache options with invalidation strategy
 */
export interface ExtendedCacheOptions {
  /** Enable caching */
  enabled?: boolean
  /** Cache tier (typically 'kv') */
  tier?: 'kv'
  /** Source of truth tier */
  populateFrom?: 'd1'
  /** Cache TTL in seconds */
  ttl?: number
  /** Cache strategy preset */
  strategy?: 'read-heavy' | 'write-heavy' | 'balanced'
  /** KV namespace for caching */
  kv?: KVNamespace
  /** Cache invalidation strategy */
  invalidationStrategy?: InvalidationStrategy
  /** Write-through mode configuration */
  writeThrough?: boolean | WriteThroughOptions
}
