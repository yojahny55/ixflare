/**
 * @module auth/rotation/encryption
 * @description AES-GCM encryption for private key storage at rest
 *
 * Uses AES-256-GCM with random IV for each encryption operation.
 * The encryption key should be derived from a master secret stored
 * in environment variables or Cloudflare secrets.
 */

import { base64urlEncode, base64urlDecode } from '@/auth/utils'

/** Encrypted data format */
export interface EncryptedData {
  /** Base64url-encoded ciphertext */
  ciphertext: string
  /** Base64url-encoded IV (12 bytes) */
  iv: string
  /** Algorithm identifier */
  alg: 'A256GCM'
}

/**
 * Derive an AES-256 key from a master secret
 *
 * Uses HKDF with SHA-256 for key derivation.
 *
 * @param masterSecret - The master secret (from env or secrets)
 * @param salt - Optional salt for key derivation (defaults to fixed value)
 * @returns CryptoKey for AES-GCM operations
 */
export async function deriveEncryptionKey(masterSecret: string, salt?: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const secretBuffer = encoder.encode(masterSecret)
  const saltBuffer = encoder.encode(salt || 'ixflare-key-rotation-v1')

  // Import as HKDF key material
  const keyMaterial = await crypto.subtle.importKey('raw', secretBuffer, 'HKDF', false, [
    'deriveKey',
  ])

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBuffer,
      info: encoder.encode('key-encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt private key data using AES-256-GCM
 *
 * @param plaintext - The private key data to encrypt
 * @param encryptionKey - AES-256 key from deriveEncryptionKey
 * @returns Encrypted data with IV
 *
 * @example
 * ```typescript
 * const key = await deriveEncryptionKey(env.KEY_ENCRYPTION_SECRET)
 * const encrypted = await encryptPrivateKey(privateKeyJwk, key)
 * // Store encrypted.ciphertext and encrypted.iv in KV
 * ```
 */
export async function encryptPrivateKey(
  plaintext: string,
  encryptionKey: CryptoKey
): Promise<EncryptedData> {
  const encoder = new TextEncoder()
  const plaintextBuffer = encoder.encode(plaintext)

  // Generate random 96-bit IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt using AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    plaintextBuffer
  )

  return {
    ciphertext: base64urlEncode(ciphertext),
    iv: base64urlEncode(iv.buffer),
    alg: 'A256GCM',
  }
}

/**
 * Decrypt private key data using AES-256-GCM
 *
 * @param encrypted - The encrypted data from encryptPrivateKey
 * @param encryptionKey - AES-256 key from deriveEncryptionKey
 * @returns Decrypted private key data
 *
 * @example
 * ```typescript
 * const key = await deriveEncryptionKey(env.KEY_ENCRYPTION_SECRET)
 * const privateKeyJwk = await decryptPrivateKey(encrypted, key)
 * ```
 */
export async function decryptPrivateKey(
  encrypted: EncryptedData,
  encryptionKey: CryptoKey
): Promise<string> {
  const ciphertext = base64urlDecode(encrypted.ciphertext)
  const iv = base64urlDecode(encrypted.iv)

  // Decrypt using AES-GCM
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    ciphertext
  )

  const decoder = new TextDecoder()
  return decoder.decode(plaintext)
}

/**
 * Check if a string is encrypted data
 *
 * @param value - Value to check
 * @returns True if value appears to be encrypted
 */
export function isEncryptedData(value: unknown): value is EncryptedData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const obj = value as Record<string, unknown>
  return typeof obj.ciphertext === 'string' && typeof obj.iv === 'string' && obj.alg === 'A256GCM'
}
