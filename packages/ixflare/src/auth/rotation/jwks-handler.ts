/**
 * @module auth/rotation/jwks-handler
 * @description JWKS endpoint handler (RFC 7517)
 */

import type { JWKS, RotationConfig } from './types'
import { KeyStore } from './key-store'
import { parseDuration } from '@/auth/utils'

/** Options for JWKS handler */
export interface JWKSHandlerOptions {
  /** Rotation config to calculate appropriate cache duration */
  rotationConfig?: RotationConfig
}

/**
 * Handle JWKS endpoint request
 *
 * Returns public keys in RFC 7517 compliant format.
 * For HS256 (symmetric), returns 404 as symmetric keys must not be exposed.
 *
 * @param kv - KV namespace containing keys
 * @param options - Optional settings including rotation config for cache calculation
 * @returns Response with JWKS JSON or 404
 *
 * @example
 * ```typescript
 * // In route handler
 * export async function GET(ctx: EdgeContext) {
 *   return handleJWKSRequest(ctx.env.KV_NAMESPACE, {
 *     rotationConfig: { interval: '30d', gracePeriod: '24h' }
 *   })
 * }
 * ```
 */
export async function handleJWKSRequest(
  kv: KVNamespace,
  options?: JWKSHandlerOptions
): Promise<Response> {
  const keyStore = new KeyStore(kv)

  // Get all active and grace period keys
  const keys = await keyStore.listActiveKeys()

  // Check if any key is HS256 (symmetric) - must not expose
  const hasSymmetricKey = keys.some((k) => k.metadata.algorithm === 'HS256')
  if (hasSymmetricKey) {
    return new Response('Not Found: JWKS endpoint not available for symmetric algorithms', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }

  // Build JWKS response with public keys only
  const jwks: JWKS = {
    keys: keys
      .filter((k) => k.publicKey) // Only include keys with public keys
      .map((k) => ({
        ...k.publicKey,
        kid: k.metadata.kid,
        alg: k.metadata.algorithm,
        use: 'sig',
        kty: k.publicKey!.kty,
        crv: k.publicKey!.crv,
        x: k.publicKey!.x,
        y: k.publicKey!.y,
      })),
  }

  // Calculate cache max-age based on rotation config
  // Use half the rotation interval for reasonable cache refresh
  let cacheMaxAgeSeconds: number
  if (options?.rotationConfig) {
    const intervalSeconds = parseDuration(options.rotationConfig.interval)
    cacheMaxAgeSeconds = Math.floor(intervalSeconds / 2)
  } else {
    // Default: 12 hours if config not provided, 1 hour if no keys
    cacheMaxAgeSeconds = keys.length > 0 ? 12 * 3600 : 3600
  }

  return Response.json(jwks, {
    headers: {
      'Cache-Control': `public, max-age=${cacheMaxAgeSeconds}`,
      'Content-Type': 'application/json',
    },
  })
}
