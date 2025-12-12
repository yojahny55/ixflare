/**
 * @module auth/jwt
 * @description Lightweight JWT implementation using WebCrypto API
 * @size ~2KB (no jose dependency)
 */

import type { JWTPayload, JWTOptions, DecodedJWT, JWTHeader } from './types'
import { encodeJson, decodeJson, parseDuration, base64urlEncode, base64urlDecode } from './utils'
import { signHS256, verifyHS256 } from './algorithms/hs256'
import { signES256, verifyES256 } from './algorithms/es256'
import {
  TokenExpiredError,
  TokenInvalidError,
  AlgorithmMismatchError,
  SignatureVerificationError,
} from './errors'

/** Minimum secret length for HS256 (256 bits = 32 bytes) */
const MIN_HS256_SECRET_LENGTH = 32

/** Configuration for HS256 algorithm */
interface HS256Config {
  algorithm: 'HS256'
  secret: string
  defaultExpiresIn?: string
}

/** Configuration for ES256 algorithm */
interface ES256Config {
  algorithm: 'ES256'
  privateKey: string
  publicKey: string
  defaultExpiresIn?: string
}

/** JWT configuration union type */
type JWTConfig = HS256Config | ES256Config

// Global configuration (set via config)
let jwtConfig: (HS256Config | ES256Config) & { defaultExpiresIn: string } = {
  algorithm: 'HS256',
  secret: '',
  defaultExpiresIn: '15m',
}

/**
 * Configure JWT settings (called by framework initialization)
 *
 * @throws {Error} If HS256 secret is too short (minimum 32 characters)
 * @throws {Error} If ES256 keys are missing or invalid
 *
 * @example
 * // HS256 configuration
 * jwt.configure({
 *   algorithm: 'HS256',
 *   secret: process.env.JWT_SECRET, // Must be at least 32 characters
 *   defaultExpiresIn: '15m',
 * })
 *
 * @example
 * // ES256 configuration
 * jwt.configure({
 *   algorithm: 'ES256',
 *   privateKey: process.env.JWT_PRIVATE_KEY,
 *   publicKey: process.env.JWT_PUBLIC_KEY,
 *   defaultExpiresIn: '15m',
 * })
 */
export function configure(config: JWTConfig): void {
  // Validate HS256 secret length
  if (config.algorithm === 'HS256') {
    if (!config.secret || config.secret.length < MIN_HS256_SECRET_LENGTH) {
      throw new Error(
        `JWT secret must be at least ${MIN_HS256_SECRET_LENGTH} characters for HS256. ` +
          `Provided: ${config.secret?.length || 0} characters`
      )
    }
    jwtConfig = {
      ...config,
      defaultExpiresIn: config.defaultExpiresIn || '15m',
    }
  } else if (config.algorithm === 'ES256') {
    if (!config.privateKey || !config.publicKey) {
      throw new Error('ES256 requires both privateKey and publicKey')
    }
    if (!config.privateKey.includes('-----BEGIN') || !config.publicKey.includes('-----BEGIN')) {
      throw new Error('ES256 keys must be in PEM format (-----BEGIN ... -----END)')
    }
    jwtConfig = {
      ...config,
      defaultExpiresIn: config.defaultExpiresIn || '15m',
    }
  }
}

/**
 * Sign a JWT token with the given payload
 * Uses the configured algorithm (HS256 or ES256)
 */
export async function sign(payload: JWTPayload, options: JWTOptions = {}): Promise<string> {
  // Validate configuration
  if (jwtConfig.algorithm === 'HS256') {
    const config = jwtConfig as HS256Config & { defaultExpiresIn: string }
    if (!config.secret) {
      throw new Error('JWT secret not configured. Call jwt.configure() first.')
    }
  } else if (jwtConfig.algorithm === 'ES256') {
    const config = jwtConfig as ES256Config & { defaultExpiresIn: string }
    if (!config.privateKey) {
      throw new Error('JWT private key not configured. Call jwt.configure() first.')
    }
  }

  // Create header with configured algorithm
  const header: JWTHeader = {
    alg: jwtConfig.algorithm,
    typ: 'JWT',
  }

  // Create payload with timestamps
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = options.expiresIn || jwtConfig.defaultExpiresIn
  const exp = now + parseDuration(expiresIn)

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp,
  }

  // Encode header and payload
  const headerEncoded = encodeJson(header)
  const payloadEncoded = encodeJson(fullPayload)

  // Create signing input
  const signingInput = `${headerEncoded}.${payloadEncoded}`

  // Sign using configured algorithm
  let signature: ArrayBuffer
  if (jwtConfig.algorithm === 'HS256') {
    const config = jwtConfig as HS256Config
    signature = await signHS256(signingInput, config.secret)
  } else {
    const config = jwtConfig as ES256Config
    signature = await signES256(signingInput, config.privateKey)
  }

  const signatureEncoded = base64urlEncode(signature)

  // Return compact JWT
  return `${signingInput}.${signatureEncoded}`
}

/**
 * Verify and decode a JWT token
 * Uses the configured algorithm (HS256 or ES256)
 */
export async function verify(token: string): Promise<JWTPayload> {
  // Validate configuration
  if (jwtConfig.algorithm === 'HS256') {
    const config = jwtConfig as HS256Config
    if (!config.secret) {
      throw new Error('JWT secret not configured. Call jwt.configure() first.')
    }
  } else if (jwtConfig.algorithm === 'ES256') {
    const config = jwtConfig as ES256Config
    if (!config.publicKey) {
      throw new Error('JWT public key not configured. Call jwt.configure() first.')
    }
  }

  // Parse token
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new TokenInvalidError('Invalid JWT format: expected 3 parts')
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts

  // Decode header
  const header = decodeJson<JWTHeader>(headerEncoded)

  // Validate algorithm BEFORE signature verification (security!)
  if (header.alg !== jwtConfig.algorithm) {
    throw new AlgorithmMismatchError(jwtConfig.algorithm, header.alg)
  }

  // Verify signature using configured algorithm
  const signingInput = `${headerEncoded}.${payloadEncoded}`
  const signatureBuffer = base64urlDecode(signatureEncoded)

  let isValid: boolean
  if (jwtConfig.algorithm === 'HS256') {
    const config = jwtConfig as HS256Config
    isValid = await verifyHS256(signingInput, signatureBuffer, config.secret)
  } else {
    const config = jwtConfig as ES256Config
    isValid = await verifyES256(signingInput, signatureBuffer, config.publicKey)
  }

  if (!isValid) {
    throw new SignatureVerificationError('JWT signature verification failed')
  }

  // Decode payload
  const payload = decodeJson<JWTPayload>(payloadEncoded)

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp <= now) {
    throw new TokenExpiredError(payload.exp)
  }

  return payload
}

/**
 * Decode a JWT token without verification (debugging only)
 *
 * ⚠️ SECURITY WARNING: This function does NOT verify the token signature!
 * - NEVER use this for authentication or authorization decisions
 * - NEVER trust data from decode() in production code
 * - An attacker can craft a token with any payload without knowing the secret
 *
 * Safe uses:
 * - Debugging token issues in development
 * - Logging token metadata (after verification)
 * - Inspecting token structure in tests
 *
 * @param token - The JWT string to decode
 * @returns The decoded header and payload (UNVERIFIED!)
 */
export function decode(token: string): DecodedJWT {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new TokenInvalidError('Invalid JWT format: expected 3 parts')
  }

  const [headerEncoded, payloadEncoded] = parts

  return {
    header: decodeJson<JWTHeader>(headerEncoded),
    payload: decodeJson<JWTPayload>(payloadEncoded),
  }
}
