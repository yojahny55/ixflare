export type StorageTier = 'kv' | 'd1' | 'do'

export type ConsistencyLevel = 'eventual' | 'strong'

export interface StorageOptions {
  /** Explicit storage tier selection (overrides auto-detection) */
  storage?: StorageTier
  /** TTL in seconds for KV storage (auto-expire) */
  ttl?: number
  /** Consistency level - 'strong' triggers DO selection */
  consistency?: ConsistencyLevel
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
}

export interface ExtendedModelOptions extends StorageOptions {
  cache?: CacheOptions
}
