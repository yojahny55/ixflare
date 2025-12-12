/**
 * @module auth/algorithms/hs256
 * @description HMAC-SHA256 signing and verification using WebCrypto
 */

/**
 * Import HMAC key from secret string
 */
export async function importHS256Key(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Sign data using HMAC-SHA256
 */
export async function signHS256(data: string, secret: string): Promise<ArrayBuffer> {
  const key = await importHS256Key(secret)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  return crypto.subtle.sign('HMAC', key, dataBuffer)
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifyHS256(
  data: string,
  signature: ArrayBuffer,
  secret: string
): Promise<boolean> {
  const key = await importHS256Key(secret)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  return crypto.subtle.verify('HMAC', key, signature, dataBuffer)
}
