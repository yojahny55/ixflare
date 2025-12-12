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
 * Convert DER-encoded ECDSA signature to raw r||s format (64 bytes for P-256)
 * JWT requires raw format, but WebCrypto produces DER
 */
function derToRaw(der: ArrayBuffer): ArrayBuffer {
  const derBytes = new Uint8Array(der)

  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 0

  // Skip sequence tag (0x30)
  offset++

  // Skip total length
  offset++

  // Skip integer tag for r (0x02)
  offset++

  // Get r length
  const rLength = derBytes[offset++]

  // Extract r (skip leading zero if present for positive numbers in DER)
  let r: Uint8Array
  if (rLength === 33 && derBytes[offset] === 0x00) {
    // Skip the leading zero
    r = derBytes.slice(offset + 1, offset + 33)
    offset += 33
  } else {
    r = derBytes.slice(offset, offset + rLength)
    offset += rLength
  }

  // Skip integer tag for s (0x02)
  offset++

  // Get s length
  const sLength = derBytes[offset++]

  // Extract s (skip leading zero if present)
  let s: Uint8Array
  if (sLength === 33 && derBytes[offset] === 0x00) {
    // Skip the leading zero
    s = derBytes.slice(offset + 1, offset + 33)
  } else {
    s = derBytes.slice(offset, offset + sLength)
  }

  // Create 64-byte raw signature (32 bytes r + 32 bytes s)
  const raw = new Uint8Array(64)

  // Ensure r and s are exactly 32 bytes (pad with leading zeros if shorter)
  if (r.length > 32 || s.length > 32) {
    throw new Error(`Invalid signature component length: r=${r.length}, s=${s.length}`)
  }

  // Pad r with leading zeros if needed (right-align in first 32 bytes)
  const rOffset = 32 - r.length
  raw.set(r, rOffset)

  // Pad s with leading zeros if needed (right-align in second 32 bytes)
  const sOffset = 64 - s.length
  raw.set(s, sOffset)

  return raw.buffer
}

/**
 * Convert raw r||s signature to DER format for verification
 */
function rawToDer(raw: ArrayBuffer): ArrayBuffer {
  const rawBytes = new Uint8Array(raw)
  const r = rawBytes.slice(0, 32)
  const s = rawBytes.slice(32, 64)

  // Helper to encode integer in DER
  const encodeInteger = (int: Uint8Array): Uint8Array => {
    // Remove leading zeros
    let i = 0
    while (i < int.length - 1 && int[i] === 0x00 && int[i + 1] < 0x80) {
      i++
    }
    const trimmed = int.slice(i)

    // Add leading zero if high bit is set (to indicate positive number)
    const needsLeadingZero = trimmed[0] >= 0x80
    const length = trimmed.length + (needsLeadingZero ? 1 : 0)

    const result = new Uint8Array(2 + length)
    result[0] = 0x02 // INTEGER tag
    result[1] = length

    if (needsLeadingZero) {
      result[2] = 0x00
      result.set(trimmed, 3)
    } else {
      result.set(trimmed, 2)
    }

    return result
  }

  const rDer = encodeInteger(r)
  const sDer = encodeInteger(s)

  // Construct DER sequence
  const totalLength = rDer.length + sDer.length
  const der = new Uint8Array(2 + totalLength)
  der[0] = 0x30 // SEQUENCE tag
  der[1] = totalLength
  der.set(rDer, 2)
  der.set(sDer, 2 + rDer.length)

  return der.buffer
}

/**
 * Import ECDSA private key from PEM format (PKCS#8)
 * Expects "-----BEGIN PRIVATE KEY-----" format
 * Generate using: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt
 */
export async function importES256PrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)

  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

/**
 * Import ECDSA public key from PEM format
 */
export async function importES256PublicKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)

  return crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  )
}

/**
 * Sign data using ECDSA P-256
 * Returns raw r||s format (64 bytes) as required by JWT
 */
export async function signES256(data: string, privateKeyPem: string): Promise<ArrayBuffer> {
  const key = await importES256PrivateKey(privateKeyPem)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  const derSignature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    dataBuffer
  )

  // Convert DER to raw format
  return derToRaw(derSignature)
}

/**
 * Verify ECDSA P-256 signature
 * Accepts raw r||s format (64 bytes) as required by JWT
 */
export async function verifyES256(
  data: string,
  signature: ArrayBuffer,
  publicKeyPem: string
): Promise<boolean> {
  const key = await importES256PublicKey(publicKeyPem)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  // Convert raw to DER format for WebCrypto
  const derSignature = rawToDer(signature)

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    derSignature,
    dataBuffer
  )
}
