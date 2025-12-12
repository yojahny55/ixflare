/**
 * @module auth/algorithms/es256
 * @description ECDSA P-256 signing and verification using WebCrypto
 */

/**
 * Convert PEM format to ArrayBuffer
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  // Remove PEM headers and whitespace
  const pemContents = pem
    .replace(/-----BEGIN.*?-----/, '')
    .replace(/-----END.*?-----/, '')
    .replace(/\s/g, '')

  // Decode base64
  const binaryString = atob(pemContents)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes.buffer
}

/**
 * Import ECDSA private key from PEM format (PKCS#8)
 * Expects "-----BEGIN PRIVATE KEY-----" format
 * Generate using: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt
 */
export async function importES256PrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)

  return crypto.subtle.importKey('pkcs8', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
}

/**
 * Import ECDSA public key from PEM format
 */
export async function importES256PublicKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)

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
