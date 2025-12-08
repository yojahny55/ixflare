/**
 * @module core/rate-limiter-store
 * @description Storage backends for rate limiting (KV, Memory)
 * @worker-only
 */

import type { RateLimitStore, RateLimitResult } from '@/types/rate-limiter'

/**
 * In-memory rate limit store for testing and single-instance use
 *
 * NOT suitable for production with multiple Workers instances
 * Use KVRateLimitStore for distributed rate limiting
 *
 * @example
 * ```typescript
 * const store = new MemoryRateLimitStore()
 * const middleware = rateLimit({
 *   max: 100,
 *   window: '15m',
 *   store
 * })
 * ```
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private counters: Map<string, { count: number; resetAt: number }> = new Map()

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowSeconds = Math.floor(windowMs / 1000)
    const resetAt = Math.floor(now / 1000) + windowSeconds

    // Get or create counter
    const existing = this.counters.get(key)

    // Check if window has expired
    if (!existing || existing.resetAt * 1000 <= now) {
      // Create new window
      this.counters.set(key, { count: 1, resetAt })
      return {
        count: 1,
        resetAt,
        retryAfter: windowSeconds,
        limited: false,
      }
    }

    // Increment existing counter
    existing.count++
    this.counters.set(key, existing)

    return {
      count: existing.count,
      resetAt: existing.resetAt,
      retryAfter: Math.ceil((existing.resetAt * 1000 - now) / 1000),
      limited: false, // Caller will check count > max
    }
  }

  async reset(key: string): Promise<void> {
    this.counters.delete(key)
  }

  /**
   * Clear all counters (useful for tests)
   */
  clear(): void {
    this.counters.clear()
  }
}

/**
 * Cloudflare KV-based rate limit store for distributed rate limiting
 *
 * Uses sliding window algorithm for accurate rate limiting.
 * Handles KV eventual consistency gracefully (may allow slight over-count).
 *
 * @example
 * ```typescript
 * interface Env {
 *   RATE_LIMIT_KV: KVNamespace
 * }
 *
 * const store = new KVRateLimitStore(env.RATE_LIMIT_KV)
 * const middleware = rateLimit<Env>({
 *   max: 100,
 *   window: '15m',
 *   store
 * })
 * ```
 */
export class KVRateLimitStore implements RateLimitStore {
  private kv: KVNamespace
  private algorithm: 'fixed-window' | 'sliding-window'

  /**
   * Create KV-based rate limit store
   *
   * @param kv - Cloudflare KV namespace binding
   * @param algorithm - Rate limiting algorithm (default: 'sliding-window')
   */
  constructor(kv: KVNamespace, algorithm: 'fixed-window' | 'sliding-window' = 'sliding-window') {
    this.kv = kv
    this.algorithm = algorithm
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    if (this.algorithm === 'sliding-window') {
      return this.incrementSlidingWindow(key, windowMs)
    }
    return this.incrementFixedWindow(key, windowMs)
  }

  /**
   * Fixed window algorithm - simple counter with reset at fixed intervals
   */
  private async incrementFixedWindow(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowSeconds = Math.floor(windowMs / 1000)

    // Calculate current window bucket
    const windowStart = Math.floor(now / windowMs) * windowMs
    const kvKey = `ratelimit:${key}:${windowStart}`

    // Get current count
    const existing = await this.kv.get(kvKey, 'json')
    const currentCount = (existing as { count: number } | null)?.count || 0

    // Increment counter
    const newCount = currentCount + 1

    // Store with TTL (KV minimum is 60 seconds)
    const ttl = Math.max(60, windowSeconds)
    await this.kv.put(kvKey, JSON.stringify({ count: newCount, timestamp: now }), {
      expirationTtl: ttl,
    })

    // Calculate reset time
    const resetAt = Math.floor((windowStart + windowMs) / 1000)
    const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000)

    return {
      count: newCount,
      resetAt,
      retryAfter,
      limited: false, // Caller checks count > max
    }
  }

  /**
   * Sliding window algorithm - more accurate, prevents burst at boundaries
   *
   * Divides window into sub-buckets (1-minute granularity) and calculates
   * weighted count based on current position in window
   */
  private async incrementSlidingWindow(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowSeconds = Math.floor(windowMs / 1000)

    // Use 1-minute bucket granularity
    const BUCKET_SIZE_MS = 60 * 1000
    const currentBucket = Math.floor(now / BUCKET_SIZE_MS) * BUCKET_SIZE_MS

    // Calculate how many buckets we need to check
    const bucketsInWindow = Math.ceil(windowMs / BUCKET_SIZE_MS)

    // Increment current bucket
    const currentBucketKey = `ratelimit:${key}:bucket:${currentBucket}`
    const existing = await this.kv.get(currentBucketKey, 'json')
    const currentBucketCount = (existing as { count: number } | null)?.count || 0
    const newBucketCount = currentBucketCount + 1

    // Store with TTL
    const ttl = Math.max(60, windowSeconds + 60) // Extra 60s for cleanup
    await this.kv.put(
      currentBucketKey,
      JSON.stringify({ count: newBucketCount, timestamp: currentBucket }),
      { expirationTtl: ttl }
    )

    // Load all buckets in the sliding window
    const windowStart = now - windowMs
    const bucketPromises: Promise<{ timestamp: number; count: number } | null>[] = []

    for (let i = 0; i < bucketsInWindow; i++) {
      const bucketTime = currentBucket - i * BUCKET_SIZE_MS
      if (bucketTime < windowStart - BUCKET_SIZE_MS) break // Too old

      const bucketKey = `ratelimit:${key}:bucket:${bucketTime}`
      bucketPromises.push(
        this.kv.get(bucketKey, 'json').then((data) => {
          if (!data) return null
          const parsed = data as { count: number; timestamp: number }
          return { timestamp: bucketTime, count: parsed.count }
        })
      )
    }

    const buckets = (await Promise.all(bucketPromises)).filter(
      (b): b is { timestamp: number; count: number } => b !== null
    )

    // Calculate weighted count
    const totalCount = this.calculateSlidingWindowCount(buckets, now, windowMs, BUCKET_SIZE_MS)

    // Calculate reset time based on oldest bucket that will expire
    // For sliding window, we track when the oldest request will slide out
    const oldestBucket = buckets.length > 0 ? Math.min(...buckets.map((b) => b.timestamp)) : now
    const oldestBucketExpiry = oldestBucket + windowMs

    // Reset time is when the oldest bucket slides out of the window
    const resetAt = Math.floor(oldestBucketExpiry / 1000)
    const retryAfter = Math.max(1, Math.ceil((oldestBucketExpiry - now) / 1000))

    return {
      count: Math.ceil(totalCount),
      resetAt,
      retryAfter,
      limited: false,
    }
  }

  /**
   * Calculate weighted count for sliding window
   *
   * Weights each bucket by how much it overlaps with the current window
   */
  private calculateSlidingWindowCount(
    buckets: Array<{ timestamp: number; count: number }>,
    now: number,
    windowMs: number,
    bucketSizeMs: number
  ): number {
    const windowStart = now - windowMs
    let total = 0

    for (const bucket of buckets) {
      const bucketEnd = bucket.timestamp + bucketSizeMs

      // Skip if bucket is entirely outside window
      if (bucketEnd <= windowStart || bucket.timestamp > now) {
        continue
      }

      // Calculate overlap
      const overlapStart = Math.max(bucket.timestamp, windowStart)
      const overlapEnd = Math.min(bucketEnd, now)
      const weight = (overlapEnd - overlapStart) / bucketSizeMs

      total += bucket.count * weight
    }

    return total
  }

  async reset(key: string): Promise<void> {
    // For sliding window, delete all bucket keys within recent window
    // This uses KV list to find matching keys (more expensive but correct)
    if (this.algorithm === 'sliding-window') {
      const prefix = `ratelimit:${key}:bucket:`
      const listed = await this.kv.list({ prefix })
      const deletePromises = listed.keys.map((k) => this.kv.delete(k.name))
      await Promise.all(deletePromises)
    } else {
      // For fixed window, delete keys matching the pattern
      // Since we don't know the exact window start, list and delete
      const prefix = `ratelimit:${key}:`
      const listed = await this.kv.list({ prefix })
      const deletePromises = listed.keys.map((k) => this.kv.delete(k.name))
      await Promise.all(deletePromises)
    }
  }
}

/**
 * Create a default KV store from environment binding
 *
 * @param env - Environment bindings object containing KV namespace
 * @param bindingName - KV binding name in wrangler.toml (default: 'RATE_LIMIT_KV')
 * @param algorithm - Rate limiting algorithm: 'sliding-window' (default, more accurate) or 'fixed-window' (simpler)
 * @returns Configured KV rate limit store
 * @throws Error if KV binding not found in environment
 *
 * @example
 * ```typescript
 * // In wrangler.toml:
 * // [[kv_namespaces]]
 * // binding = "RATE_LIMIT_KV"
 * // id = "your-kv-namespace-id"
 *
 * const store = createKVStore(env)
 * const store = createKVStore(env, 'CUSTOM_KV', 'fixed-window')
 * ```
 */
export function createKVStore(
  env: Record<string, unknown>,
  bindingName = 'RATE_LIMIT_KV',
  algorithm: 'fixed-window' | 'sliding-window' = 'sliding-window'
): KVRateLimitStore {
  const kv = env[bindingName]
  if (!kv || typeof kv !== 'object' || !('get' in kv)) {
    throw new Error(
      `KV binding '${bindingName}' not found in environment. ` +
        `Add to wrangler.toml: [[kv_namespaces]]\nbinding = "${bindingName}"\nid = "your-kv-id"`
    )
  }

  return new KVRateLimitStore(kv as KVNamespace, algorithm)
}
