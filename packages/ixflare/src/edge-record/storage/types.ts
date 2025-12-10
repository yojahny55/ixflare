import type {
  ConsistencyLevel as ConsistencyLevelType,
  InvalidationStrategy,
} from '@/edge-record/consistency/types'

export type StorageTier = 'kv' | 'd1' | 'do'

/**
 * @deprecated Use ConsistencyLevel from '@/edge-record/consistency/types' instead
 */
export type ConsistencyLevel = ConsistencyLevelType

/**
 * Storage binding type - the actual Cloudflare binding passed at runtime
 *
 * Maps storage tiers to their corresponding Cloudflare binding types:
 * - 'd1' → D1Database
 * - 'kv' → KVNamespace
 * - 'do' → DurableObjectStorage (from DurableObjectState.storage)
 */
export type StorageBinding = D1Database | KVNamespace | DurableObjectStorage

/**
 * Type guard to check if binding is D1Database
 */
export function isD1Database(binding: StorageBinding): binding is D1Database {
  return 'prepare' in binding && 'batch' in binding
}

/**
 * Type guard to check if binding is KVNamespace
 */
export function isKVNamespace(binding: StorageBinding): binding is KVNamespace {
  return 'get' in binding && 'put' in binding && 'list' in binding && !('prepare' in binding)
}

/**
 * Type guard to check if binding is DurableObjectStorage
 */
export function isDurableObjectStorage(binding: StorageBinding): binding is DurableObjectStorage {
  return 'transaction' in binding && 'deleteAll' in binding && !('prepare' in binding)
}

export interface StorageOptions {
  /** Explicit storage tier selection (overrides auto-detection) */
  storage?: StorageTier
  /** TTL in seconds for KV storage (auto-expire) */
  ttl?: number
  /** Consistency level - 'strong' triggers DO selection */
  consistency?: ConsistencyLevelType
}

export interface CacheOptions {
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
  /** KV namespace for caching (used for cache invalidation in transactions) */
  kv?: KVNamespace
  /** Cache invalidation strategy (default: 'immediate') */
  invalidationStrategy?: InvalidationStrategy
  /** Write-through caching (populate cache immediately on writes) */
  writeThrough?: boolean
}

export interface ExtendedModelOptions extends StorageOptions {
  cache?: CacheOptions
}

/** @deprecated Use StorageBinding instead */
export type Database = StorageBinding
