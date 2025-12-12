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
}

export interface JWTOptions {
  expiresIn?: string | number
}

export interface DecodedJWT {
  header: JWTHeader
  payload: JWTPayload
}
