/**
 * @module auth/rotation/key-store
 * @description KV-based key storage with eventual consistency handling
 */

import type { KeyMetadata, StoredKey } from './types'
import { KeyNotFoundError, KeyRotationError } from './errors'

/**
 * Key storage abstraction for Cloudflare KV
 *
 * Key structure in KV:
 * - `jwt:keys:current` → { kid: "key-2024-12", createdAt: 1234567890 }
 * - `jwt:keys:{kid}` → { metadata: {...}, privateKey: "...", publicKey: {...} }
 * - `jwt:keys:list` → ["key-2024-12", "key-2024-11"]
 *
 * @example
 * ```typescript
 * const keyStore = new KeyStore(env.KV_NAMESPACE)
 * await keyStore.storeKey(kid, privateKey, publicKey, expiresAt, gracePeriodEndsAt)
 * const key = await keyStore.getKey(kid)
 * ```
 */
export class KeyStore {
  private readonly kv: KVNamespace
  private readonly prefix = 'jwt:keys:'

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  /**
   * Store a key in KV with metadata
   *
   * @param kid - Key ID
   * @param privateKey - Private key material (encrypted or base64url)
   * @param algorithm - JWT algorithm
   * @param expiresAt - When key enters grace period (Unix ms)
   * @param gracePeriodEndsAt - When key is removed (Unix ms)
   * @param publicKey - Public JWK (ES256 only)
   */
  async storeKey(
    kid: string,
    privateKey: string,
    algorithm: 'ES256' | 'HS256',
    expiresAt: number,
    gracePeriodEndsAt: number,
    publicKey?: Record<string, unknown>
  ): Promise<void> {
    const now = Date.now()

    const metadata: KeyMetadata = {
      kid,
      algorithm,
      createdAt: now,
      expiresAt,
      gracePeriodEndsAt,
      status: 'active',
    }

    const storedKey: StoredKey = {
      metadata,
      privateKey,
      publicKey: publicKey as StoredKey['publicKey'],
    }

    // Store individual key
    await this.kv.put(`${this.prefix}${kid}`, JSON.stringify(storedKey))

    // Update key list (add to front)
    const currentList = await this.getKeyList()
    const newList = [kid, ...currentList.filter((k) => k !== kid)]
    await this.kv.put(`${this.prefix}list`, JSON.stringify(newList))

    // Update current key pointer
    await this.kv.put(`${this.prefix}current`, JSON.stringify({ kid, createdAt: now }))
  }

  /**
   * Get a specific key by ID
   *
   * @param kid - Key ID
   * @returns Stored key with metadata
   * @throws {KeyNotFoundError} If key doesn't exist
   */
  async getKey(kid: string): Promise<StoredKey> {
    const value = await this.kv.get(`${this.prefix}${kid}`, 'text')

    if (!value) {
      throw new KeyNotFoundError(kid)
    }

    const storedKey: StoredKey = JSON.parse(value)

    // Update status based on current time
    const now = Date.now()
    if (now >= storedKey.metadata.gracePeriodEndsAt) {
      storedKey.metadata.status = 'expired'
    } else if (now >= storedKey.metadata.expiresAt) {
      storedKey.metadata.status = 'grace'
    } else {
      storedKey.metadata.status = 'active'
    }

    return storedKey
  }

  /**
   * Get all active keys (including grace period keys)
   *
   * @returns Array of non-expired keys, ordered by status (active first)
   */
  async listActiveKeys(): Promise<StoredKey[]> {
    const keyList = await this.getKeyList()
    const now = Date.now()

    const keys: StoredKey[] = []

    for (const kid of keyList) {
      try {
        const key = await this.getKey(kid)

        // Filter out expired keys
        if (key.metadata.status !== 'expired' && now < key.metadata.gracePeriodEndsAt) {
          keys.push(key)
        }
      } catch {
        // Key not found or corrupted - skip it
        continue
      }
    }

    // Sort: active first, then grace period
    keys.sort((a, b) => {
      if (a.metadata.status === 'active' && b.metadata.status !== 'active') return -1
      if (a.metadata.status !== 'active' && b.metadata.status === 'active') return 1
      return b.metadata.createdAt - a.metadata.createdAt // Newer first
    })

    return keys
  }

  /**
   * Delete a key from KV
   *
   * @param kid - Key ID to delete
   */
  async deleteKey(kid: string): Promise<void> {
    // Delete the key itself
    await this.kv.delete(`${this.prefix}${kid}`)

    // Update key list (remove this kid)
    const currentList = await this.getKeyList()
    const newList = currentList.filter((k) => k !== kid)
    await this.kv.put(`${this.prefix}list`, JSON.stringify(newList))
  }

  /**
   * Get the current active signing key ID
   *
   * @returns Key ID of the current active key
   * @throws {KeyRotationError} If no current key is set
   */
  async getCurrentKeyId(): Promise<string> {
    const value = await this.kv.get(`${this.prefix}current`, 'text')

    if (!value) {
      throw new KeyRotationError('No current signing key found. Initialize rotation first.')
    }

    const current: { kid: string; createdAt: number } = JSON.parse(value)
    return current.kid
  }

  /**
   * Get the list of key IDs from KV
   *
   * @returns Array of key IDs
   */
  async getKeyList(): Promise<string[]> {
    const value = await this.kv.get(`${this.prefix}list`, 'text')

    if (!value) {
      return []
    }

    return JSON.parse(value)
  }

  /**
   * Get current key metadata
   *
   * @returns Current key metadata or null if not set
   */
  async getCurrentKeyMetadata(): Promise<{ kid: string; createdAt: number } | null> {
    const value = await this.kv.get(`${this.prefix}current`, 'text')

    if (!value) {
      return null
    }

    return JSON.parse(value)
  }
}
