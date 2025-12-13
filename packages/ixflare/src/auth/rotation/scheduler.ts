/**
 * @module auth/rotation/scheduler
 * @description Key rotation scheduling and cleanup logic
 */

import type { RotationConfig } from './types'
import type { KeyStore } from './key-store'
import { parseDuration } from '@/auth/utils'
import { InvalidRotationConfigError } from './errors'
import {
  generateES256KeyPair,
  generateHS256Secret,
  generateKeyId,
  exportKeyAsBase64url,
} from './key-generator'

/** Minimum rotation interval: 1 day (in seconds) */
const MIN_ROTATION_INTERVAL_SECONDS = 86400

/**
 * Parse and validate rotation configuration
 *
 * @param config - Rotation config with interval and grace period
 * @throws {InvalidRotationConfigError} If intervals are too short
 */
export function validateRotationConfig(config: RotationConfig): {
  intervalSeconds: number
  gracePeriodSeconds: number
  intervalMs: number
  gracePeriodMs: number
} {
  const intervalSeconds = parseDuration(config.interval)
  const gracePeriodSeconds = parseDuration(config.gracePeriod)

  // Validate minimum interval
  if (intervalSeconds < MIN_ROTATION_INTERVAL_SECONDS) {
    throw new InvalidRotationConfigError(
      `Rotation interval must be at least 1 day (86400s). Got: ${intervalSeconds}s`
    )
  }

  // Validate grace period is shorter than interval
  if (gracePeriodSeconds >= intervalSeconds) {
    throw new InvalidRotationConfigError(
      `Grace period (${gracePeriodSeconds}s) must be shorter than rotation interval (${intervalSeconds}s)`
    )
  }

  return {
    intervalSeconds,
    gracePeriodSeconds,
    intervalMs: intervalSeconds * 1000,
    gracePeriodMs: gracePeriodSeconds * 1000,
  }
}

/**
 * Check if keys should rotate based on configuration and current key age
 *
 * @param config - Rotation configuration
 * @param keyStore - Key store instance
 * @returns True if rotation is needed
 *
 * @example
 * ```typescript
 * const config = { interval: '30d', gracePeriod: '24h' }
 * if (await shouldRotate(config, keyStore)) {
 *   await rotateKeys(config, keyStore, 'ES256')
 * }
 * ```
 */
export async function shouldRotate(config: RotationConfig, keyStore: KeyStore): Promise<boolean> {
  const { intervalMs } = validateRotationConfig(config)

  // Get current key metadata
  const currentKeyMeta = await keyStore.getCurrentKeyMetadata()

  // No current key = needs initialization
  if (!currentKeyMeta) {
    return true
  }

  // Check if interval has elapsed
  const now = Date.now()
  const keyAge = now - currentKeyMeta.createdAt

  return keyAge >= intervalMs
}

/**
 * Rotate keys: generate new key, move old key to grace period
 *
 * @param config - Rotation configuration
 * @param keyStore - Key store instance
 * @param algorithm - Algorithm to use for new key
 *
 * @example
 * ```typescript
 * await rotateKeys({ interval: '30d', gracePeriod: '24h' }, keyStore, 'ES256')
 * ```
 */
export async function rotateKeys(
  config: RotationConfig,
  keyStore: KeyStore,
  algorithm: 'ES256' | 'HS256'
): Promise<{ kid: string; rotatedAt: number }> {
  const { intervalMs, gracePeriodMs } = validateRotationConfig(config)

  const now = Date.now()
  const kid = generateKeyId()
  const expiresAt = now + intervalMs // When key enters grace period
  const gracePeriodEndsAt = expiresAt + gracePeriodMs // When key is deleted

  if (algorithm === 'ES256') {
    // Generate ES256 key pair
    const { privateKey, publicJwk } = await generateES256KeyPair()

    // Export private key for storage
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey)
    const privateKeyStr = JSON.stringify(privateKeyJwk)

    // Store in KV
    await keyStore.storeKey(kid, privateKeyStr, algorithm, expiresAt, gracePeriodEndsAt, publicJwk)
  } else {
    // Generate HS256 secret
    const secret = await generateHS256Secret()
    const secretBase64url = await exportKeyAsBase64url(secret)

    // Store in KV (no public key for symmetric)
    await keyStore.storeKey(kid, secretBase64url, algorithm, expiresAt, gracePeriodEndsAt)
  }

  return { kid, rotatedAt: now }
}

/**
 * Remove keys that have exceeded their grace period
 *
 * @param keyStore - Key store instance
 * @returns Array of deleted key IDs
 *
 * @example
 * ```typescript
 * const deleted = await cleanupExpiredKeys(keyStore)
 * console.log(`Removed ${deleted.length} expired keys`)
 * ```
 */
export async function cleanupExpiredKeys(keyStore: KeyStore): Promise<string[]> {
  // Get the full key list (including expired keys)
  const keyList = await keyStore.getKeyList()
  const now = Date.now()
  const expiredKids: string[] = []

  for (const kid of keyList) {
    try {
      const key = await keyStore.getKey(kid)

      // Check if grace period has ended
      if (now >= key.metadata.gracePeriodEndsAt) {
        await keyStore.deleteKey(key.metadata.kid)
        expiredKids.push(key.metadata.kid)
      }
    } catch {
      // Key not found or corrupted - skip
      continue
    }
  }

  return expiredKids
}
