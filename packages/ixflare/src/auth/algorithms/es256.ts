/**
 * @module auth/algorithms/es256
 * @description ECDSA P-256 signing and verification using WebCrypto
 */

/** PEM header/footer patterns */
const PEM_PRIVATE_KEY_HEADER = '-----BEGIN PRIVATE KEY-----'
const PEM_PRIVATE_KEY_FOOTER = '-----END PRIVATE KEY-----'
const PEM_PUBLIC_KEY_HEADER = '-----BEGIN PUBLIC KEY-----'
const PEM_PUBLIC_KEY_FOOTER = '-----END PUBLIC KEY-----'

/**
 * Validate and convert PEM format to ArrayBuffer
 *
 * @param pem - PEM-encoded key string
 * @param expectedType - Expected key type ('private' or 'public')
 * @throws {Error} If PEM format is invalid or doesn't match expected type
 */
function pemToArrayBuffer(pem: string, expectedType: 'private' | 'public'): ArrayBuffer {
  const trimmedPem = pem.trim()

  // Validate PEM structure based on expected type
  if (expectedType === 'private') {
    if (!trimmedPem.includes(PEM_PRIVATE_KEY_HEADER)) {
      throw new Error(
        `Invalid private key PEM: missing "${PEM_PRIVATE_KEY_HEADER}" header. ` +
          'Use PKCS#8 format (openssl pkcs8 -topk8 -nocrypt)'
      )
    }
    if (!trimmedPem.includes(PEM_PRIVATE_KEY_FOOTER)) {
      throw new Error(`Invalid private key PEM: missing "${PEM_PRIVATE_KEY_FOOTER}" footer`)
    }
  } else {
    if (!trimmedPem.includes(PEM_PUBLIC_KEY_HEADER)) {
      throw new Error(
        `Invalid public key PEM: missing "${PEM_PUBLIC_KEY_HEADER}" header. ` +
          'Use SPKI format (openssl ec -pubout)'
      )
    }
    if (!trimmedPem.includes(PEM_PUBLIC_KEY_FOOTER)) {
      throw new Error(`Invalid public key PEM: missing "${PEM_PUBLIC_KEY_FOOTER}" footer`)
    }
  }

  // Extract base64 content between headers
  const pemContents = trimmedPem
    .replace(/-----BEGIN.*?-----/, '')
    .replace(/-----END.*?-----/, '')
    .replace(/\s/g, '')

  if (!pemContents || pemContents.length === 0) {
    throw new Error('Invalid PEM: no key data found between headers')
  }

  // Validate base64 content
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(pemContents)) {
    throw new Error('Invalid PEM: key data is not valid base64')
  }

  // Decode base64
  try {
    const binaryString = atob(pemContents)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  } catch {
    throw new Error('Invalid PEM: failed to decode base64 content')
  }
}

/**
 * Import ECDSA private key from PEM format (PKCS#8)
 * Expects "-----BEGIN PRIVATE KEY-----" format
 * Generate using: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt
 */
export async function importES256PrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem, 'private')

  return crypto.subtle.importKey('pkcs8', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
}

/**
 * Import ECDSA public key from PEM format (SPKI)
 * Expects "-----BEGIN PUBLIC KEY-----" format
 * Generate using: openssl ec -in private.pem -pubout
 */
export async function importES256PublicKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem, 'public')

  return crypto.subtle.importKey('spki', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'verify',
  ])
}

/**
 * Sign data using ECDSA P-256
 * Returns raw r||s format (64 bytes) as required by JWT
 *
 * Note: WebCrypto ECDSA outputs IEEE P1363 format (raw r||s concatenation),
 * which is exactly what JWT requires. No conversion needed.
 */
export async function signES256(data: string, privateKeyPem: string): Promise<ArrayBuffer> {
  const key = await importES256PrivateKey(privateKeyPem)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  // WebCrypto produces raw r||s format (64 bytes for P-256), exactly what JWT needs
  return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, dataBuffer)
}

/**
 * Verify ECDSA P-256 signature
 * Accepts raw r||s format (64 bytes) as required by JWT
 *
 * Note: WebCrypto ECDSA expects IEEE P1363 format (raw r||s concatenation),
 * which is exactly what JWT uses. No conversion needed.
 */
export async function verifyES256(
  data: string,
  signature: ArrayBuffer,
  publicKeyPem: string
): Promise<boolean> {
  const key = await importES256PublicKey(publicKeyPem)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  // WebCrypto expects raw r||s format (64 bytes for P-256), exactly what JWT provides
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, dataBuffer)
}
