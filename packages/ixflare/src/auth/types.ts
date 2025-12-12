/**
 * @module auth/types
 * @description Type definitions for JWT authentication
 */

export type JWTAlgorithm = 'ES256' | 'HS256'

export interface JWTPayload {
  [key: string]: unknown
  iat?: number
  exp?: number
}

export interface JWTHeader {
  alg: JWTAlgorithm
  typ: 'JWT'
  /** Key ID - used for key rotation (Story 5-5) */
  kid?: string
}

export interface JWTOptions {
  expiresIn?: string | number
}

/** Result of jwt.decode() - unverified header and payload */
export interface DecodedJWT {
  header: JWTHeader
  payload: JWTPayload
}

/** Result of jwt.verifyComplete() - verified header and payload */
export interface VerifiedJWT {
  header: JWTHeader
  payload: JWTPayload
}
