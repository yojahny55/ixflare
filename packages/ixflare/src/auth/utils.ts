/**
 * @module auth/utils
 * @description Utility functions for JWT operations
 */

/**
 * Encode ArrayBuffer to base64url string (RFC 4648)
 * Base64url is base64 with URL-safe characters: - instead of + and _ instead of /
 * No padding (= characters)
 */
export function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  // Convert base64 to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Decode base64url string to ArrayBuffer
 */
export function base64urlDecode(base64url: string): ArrayBuffer {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')

  // Add padding if needed
  const padding = (4 - (base64.length % 4)) % 4
  base64 += '='.repeat(padding)

  // Decode base64 to binary string
  const binary = atob(base64)

  // Convert binary string to ArrayBuffer
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

/**
 * Parse duration string (e.g., '15m', '1h', '7d') to seconds
 */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration
  }

  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Expected format: 15m, 1h, 7d`)
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  }

  return value * multipliers[unit]
}

/**
 * Encode object to JSON and then base64url
 */
export function encodeJson(obj: unknown): string {
  const json = JSON.stringify(obj)
  const encoder = new TextEncoder()
  const buffer = encoder.encode(json)
  return base64urlEncode(buffer.buffer)
}

/**
 * Decode base64url string to JSON object
 */
export function decodeJson<T = unknown>(base64url: string): T {
  const buffer = base64urlDecode(base64url)
  const json = new TextDecoder().decode(buffer)
  return JSON.parse(json) as T
}
