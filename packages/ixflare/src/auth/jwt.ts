/**
 * @module auth/jwt
 * @description Lightweight JWT implementation using WebCrypto API
 * @size ~2KB (no jose dependency)
 */

import type { JWTPayload, JWTOptions, DecodedJWT, JWTHeader } from './types'
import { encodeJson, decodeJson, parseDuration, base64urlEncode } from './utils'
import { signHS256, verifyHS256 } from './algorithms/hs256'
import {
  TokenExpiredError,
  TokenInvalidError,
  AlgorithmMismatchError,
  SignatureVerificationError,
} from './errors'

// Global configuration (set via config)
let jwtConfig: {
  algorithm: 'HS256'
  secret: string
  defaultExpiresIn: string
} = {
  algorithm: 'HS256',
  secret: '',
  defaultExpiresIn: '15m',
}

/**
 * Configure JWT settings (called by framework initialization)
 */
export function configure(config: {
  algorithm: 'HS256'
  secret: string
  defaultExpiresIn?: string
}): void {
  jwtConfig = {
    ...config,
    defaultExpiresIn: config.defaultExpiresIn || '15m',
  }
}

/**
 * Sign a JWT token with the given payload using HS256
 */
export async function sign(payload: JWTPayload, options: JWTOptions = {}): Promise<string> {
  if (!jwtConfig.secret) {
    throw new Error('JWT secret not configured. Call jwt.configure() first.')
  }

  // Create header
  const header: JWTHeader = {
    alg: 'HS256',
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

  // Sign using HS256
  const signature = await signHS256(signingInput, jwtConfig.secret)
  const signatureEncoded = base64urlEncode(signature)

  // Return compact JWT
  return `${signingInput}.${signatureEncoded}`
}

/**
 * Verify and decode a JWT token
 */
export async function verify(token: string): Promise<JWTPayload> {
  if (!jwtConfig.secret) {
    throw new Error('JWT secret not configured. Call jwt.configure() first.')
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

  // Verify signature
  const signingInput = `${headerEncoded}.${payloadEncoded}`
  const signatureBuffer = await import('./utils').then((m) => m.base64urlDecode(signatureEncoded))

  const isValid = await verifyHS256(signingInput, signatureBuffer, jwtConfig.secret)

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
 * WARNING: Do not use in production for authentication
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
