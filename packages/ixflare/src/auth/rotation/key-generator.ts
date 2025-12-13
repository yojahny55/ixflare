/**
 * @module auth/rotation/key-generator
 * @description Key generation for ES256 and HS256 using WebCrypto API
 */

import type { JWK } from './types'
import { base64urlEncode } from '@/auth/utils'

/**
 * Generate ES256 (ECDSA P-256) key pair for asymmetric signing
 *
 * @returns Private key, public key, and public JWK
 *
 * @example
 * ```typescript
 * const { privateKey, publicKey, publicJwk } = await generateES256KeyPair()
 * console.log(publicJwk)
 * // { kty: 'EC', crv: 'P-256', x: '...', y: '...' }
 * ```
 */
export async function generateES256KeyPair(): Promise<{
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicJwk: JWK
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable (needed for export)
    ['sign', 'verify']
  )

  // Export public key as JWK (RFC 7517)
  const publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JWK

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
  }
}

/**
 * Generate HS256 (HMAC-SHA256) secret for symmetric signing
 *
 * @returns Generated secret key
 *
 * @example
 * ```typescript
 * const secret = await generateHS256Secret()
 * // CryptoKey with 256 bits of entropy
 * ```
 */
export async function generateHS256Secret(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    true, // extractable
    ['sign', 'verify']
  )

  return key
}

/**
 * Export CryptoKey as base64url string for storage
 *
 * @param key - CryptoKey to export
 * @returns Base64url-encoded key
 */
export async function exportKeyAsBase64url(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  return base64urlEncode(exported)
}

/**
 * Generate a unique key ID
 *
 * Format: `key-{YYYY-MM-DD}-{random4chars}`
 *
 * @returns Key ID string
 *
 * @example
 * ```typescript
 * const kid = generateKeyId()
 * // 'key-2025-12-12-a1b2'
 * ```
 */
export function generateKeyId(): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const random = crypto.randomUUID().slice(0, 4)
  return `key-${date}-${random}`
}
