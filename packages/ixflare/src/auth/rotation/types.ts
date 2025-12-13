/**
 * @module auth/rotation/types
 * @description Type definitions for automatic key rotation
 */

import type { JWTAlgorithm } from '@/auth/types'

/** JSON Web Key format (RFC 7517) */
export interface JWK {
  kty: string // Key type (e.g., "EC", "RSA", "oct")
  use?: string // Public key use (e.g., "sig")
  alg?: string // Algorithm (e.g., "ES256")
  kid?: string // Key ID
  // EC specific fields
  crv?: string // Curve (e.g., "P-256")
  x?: string // X coordinate (base64url)
  y?: string // Y coordinate (base64url)
  // Symmetric key field
  k?: string // Key value (base64url)
  // Index signature for additional JWK properties
  [key: string]: unknown
}

/** Key lifecycle status */
export type KeyStatus = 'active' | 'grace' | 'expired'

/** Metadata about a signing key */
export interface KeyMetadata {
  kid: string
  algorithm: JWTAlgorithm
  createdAt: number // Unix timestamp (ms)
  expiresAt: number // When key enters grace period (ms)
  gracePeriodEndsAt: number // When key is removed (ms)
  status: KeyStatus
}

/** Stored key with metadata and cryptographic material */
export interface StoredKey {
  metadata: KeyMetadata
  privateKey: string // Encrypted for ES256, base64url for HS256
  publicKey?: JWK // Only for ES256 (asymmetric)
}

/** Key rotation configuration */
export interface RotationConfig {
  interval: string // e.g., '30d', '7d'
  gracePeriod: string // e.g., '24h', '12h'
}

/** JWKS response format (RFC 7517) */
export interface JWKS {
  keys: JWK[]
}
