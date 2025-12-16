/**
 * Runtime secret tracking and redaction
 * Tracks known secret values and redacts them from logs
 * @module security/secrets/tracker
 */

import type { SecretInfo } from './types'

/**
 * Secret tracker for runtime value tracking
 * Tracks known secret values and provides redaction
 */
export class SecretTracker {
  private secrets = new Map<string, SecretInfo>()
  private debugMode = false

  constructor() {
    // Check for debug mode from environment
    // Note: In Workers, we check c.env or passed config
    if (typeof process !== 'undefined' && process.env) {
      this.debugMode = process.env.IX_DEBUG_SECRETS === 'true'
    }
  }

  /**
   * Track a secret value
   * @param name - Secret name (e.g., 'STRIPE_SECRET_KEY')
   * @param value - The actual secret value
   */
  track(name: string, value: string): void {
    if (!value || typeof value !== 'string') {
      return
    }

    this.secrets.set(name, {
      name,
      value,
      registeredAt: Date.now(),
    })
  }

  /**
   * Redact tracked secrets from text
   * @param text - The text to redact
   * @returns Redacted text
   */
  redact(text: string): string {
    // In debug mode AND not production, show secrets
    if (this.debugMode && !this.isProduction()) {
      return text
    }

    let result = text

    // Replace tracked secret values
    for (const [name, info] of this.secrets) {
      if (info.value && result.includes(info.value)) {
        result = result.replaceAll(info.value, `[REDACTED:${name}]`)
      }
    }

    return result
  }

  /**
   * Check if running in production
   * @returns True if production environment
   */
  private isProduction(): boolean {
    if (typeof process !== 'undefined' && process.env) {
      const nodeEnv = process.env.NODE_ENV
      return nodeEnv === 'production'
    }

    // In Workers, we can't easily detect production
    // So we default to always enforcing redaction in Workers
    return true
  }

  /**
   * Enable debug mode (shows secrets in development)
   * WARNING: Never call this in production
   * @param enabled - Whether to enable debug mode
   */
  setDebugMode(enabled: boolean): void {
    // Only allow enabling debug mode in non-production
    if (enabled && this.isProduction()) {
      console.warn(
        'IX_DEBUG_SECRETS cannot be enabled in production - request ignored'
      )
      return
    }

    this.debugMode = enabled
  }

  /**
   * Get all tracked secret names (not values!)
   * @returns Array of secret names
   */
  getSecretNames(): string[] {
    return Array.from(this.secrets.keys())
  }

  /**
   * Clear all tracked secrets
   */
  clear(): void {
    this.secrets.clear()
  }

  /**
   * Check if a secret is tracked
   * @param name - Secret name to check
   * @returns True if secret is tracked
   */
  isTracked(name: string): boolean {
    return this.secrets.has(name)
  }
}

/**
 * Global secret tracker instance
 * @internal
 */
let globalTracker: SecretTracker | null = null

/**
 * Get the global secret tracker instance
 * Creates one if it doesn't exist
 *
 * @returns Global secret tracker
 * @example
 * ```typescript
 * const tracker = getSecretTracker()
 * tracker.track('API_KEY', 'sk_live_abc123')
 * console.log(tracker.redact('My key is sk_live_abc123'))
 * // Output: 'My key is [REDACTED:API_KEY]'
 * ```
 */
export function getSecretTracker(): SecretTracker {
  if (!globalTracker) {
    globalTracker = new SecretTracker()
  }
  return globalTracker
}

/**
 * Reset the global tracker (mainly for testing)
 * @internal
 */
export function resetGlobalTracker(): void {
  globalTracker = null
}
