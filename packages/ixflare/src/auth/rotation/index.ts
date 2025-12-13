/**
 * @module auth/rotation
 * @description Automatic JWT key rotation with grace periods
 *
 * Features:
 * - Automatic key rotation with configurable intervals
 * - Grace period for key transitions
 * - JWKS endpoint for public key distribution
 * - Multi-key verification during grace period
 * - Manual rotation via CLI
 *
 * @example
 * ```typescript
 * // Configure rotation
 * const keyStore = new KeyStore(env.KV_NAMESPACE)
 * await configureRotation({
 *   interval: '30d',
 *   gracePeriod: '24h',
 * }, keyStore)
 *
 * // JWKS endpoint
 * export async function onRequest(ctx: EdgeContext) {
 *   return handleJWKSRequest(ctx.env.KV_NAMESPACE)
 * }
 * ```
 */

export type {
  JWK,
  KeyMetadata,
  StoredKey,
  RotationConfig,
  KeyStatus,
  JWKS,
  EncryptedPrivateKey,
} from './types'
export { KeyRotationError, KeyNotFoundError, InvalidRotationConfigError } from './errors'
export { generateES256KeyPair, generateHS256Secret, generateKeyId } from './key-generator'
export { KeyStore } from './key-store'
export { shouldRotate, rotateKeys, cleanupExpiredKeys, type RotateKeysOptions } from './scheduler'
export { handleJWKSRequest } from './jwks-handler'
export {
  deriveEncryptionKey,
  encryptPrivateKey,
  decryptPrivateKey,
  isEncryptedData,
  type EncryptedData,
} from './encryption'
