import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SecretTracker,
  getSecretTracker,
  resetGlobalTracker,
} from '../../../src/security/secrets/tracker'

describe('SecretTracker', () => {
  let tracker: SecretTracker

  beforeEach(() => {
    tracker = new SecretTracker()
    // Ensure we're not in production for tests
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.IX_DEBUG_SECRETS
      process.env.NODE_ENV = 'test'
    }
  })

  describe('track', () => {
    it('should track a secret value', () => {
      tracker.track('API_KEY', 'sk_live_abc123')
      expect(tracker.isTracked('API_KEY')).toBe(true)
    })

    it('should track multiple secrets', () => {
      tracker.track('API_KEY', 'sk_live_abc123')
      tracker.track('JWT_SECRET', 'super_secret_key')
      expect(tracker.getSecretNames()).toEqual(['API_KEY', 'JWT_SECRET'])
    })

    it('should handle empty values', () => {
      tracker.track('EMPTY', '')
      expect(tracker.isTracked('EMPTY')).toBe(false)
    })

    it('should handle non-string values', () => {
      // @ts-expect-error - testing runtime behavior
      tracker.track('NUMBER', 12345)
      expect(tracker.isTracked('NUMBER')).toBe(false)
    })

    it('should overwrite existing tracked secrets', () => {
      tracker.track('API_KEY', 'old_value')
      tracker.track('API_KEY', 'new_value')
      const redacted = tracker.redact('new_value')
      expect(redacted).toContain('[REDACTED:API_KEY]')
    })
  })

  describe('redact', () => {
    it('should redact tracked secret values', () => {
      tracker.track('API_KEY', 'sk_live_abc123')
      const result = tracker.redact('My API key is sk_live_abc123')
      expect(result).toBe('My API key is [REDACTED:API_KEY]')
    })

    it('should redact multiple instances of same secret', () => {
      tracker.track('PASSWORD', 'secret123')
      const result = tracker.redact('password: secret123, again: secret123')
      expect(result).toBe(
        'password: [REDACTED:PASSWORD], again: [REDACTED:PASSWORD]'
      )
    })

    it('should redact multiple different secrets', () => {
      tracker.track('API_KEY', 'key123')
      tracker.track('PASSWORD', 'pass456')
      const result = tracker.redact('key: key123, password: pass456')
      expect(result).toContain('[REDACTED:API_KEY]')
      expect(result).toContain('[REDACTED:PASSWORD]')
    })

    it('should not redact non-tracked values', () => {
      tracker.track('API_KEY', 'sk_live_abc123')
      const result = tracker.redact('Some random text')
      expect(result).toBe('Some random text')
    })

    it('should handle empty strings', () => {
      tracker.track('API_KEY', 'sk_live_abc123')
      const result = tracker.redact('')
      expect(result).toBe('')
    })

    it('should be case-sensitive', () => {
      tracker.track('API_KEY', 'SecretValue')
      expect(tracker.redact('secretvalue')).toBe('secretvalue')
      expect(tracker.redact('SecretValue')).toContain('[REDACTED:API_KEY]')
    })
  })

  describe('debug mode', () => {
    it('should not redact in debug mode (non-production)', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.IX_DEBUG_SECRETS = 'true'
        process.env.NODE_ENV = 'development'
      }

      const debugTracker = new SecretTracker()
      debugTracker.track('API_KEY', 'sk_live_abc123')
      const result = debugTracker.redact('My key: sk_live_abc123')

      // In debug mode + development, secrets should NOT be redacted
      expect(result).toBe('My key: sk_live_abc123')
    })

    it('should always redact in production even with debug mode', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.IX_DEBUG_SECRETS = 'true'
        process.env.NODE_ENV = 'production'
      }

      const prodTracker = new SecretTracker()
      prodTracker.track('API_KEY', 'sk_live_abc123')
      const result = prodTracker.redact('My key: sk_live_abc123')

      // In production, secrets should ALWAYS be redacted
      expect(result).toContain('[REDACTED:API_KEY]')
    })

    it('should not enable debug mode in production via setDebugMode', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.NODE_ENV = 'production'
      }

      const prodTracker = new SecretTracker()
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      prodTracker.setDebugMode(true)
      prodTracker.track('API_KEY', 'sk_live_abc123')
      const result = prodTracker.redact('My key: sk_live_abc123')

      expect(result).toContain('[REDACTED:API_KEY]')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot be enabled in production')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should allow debug mode in development via setDebugMode', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.NODE_ENV = 'development'
      }

      const devTracker = new SecretTracker()
      devTracker.setDebugMode(true)
      devTracker.track('API_KEY', 'sk_live_abc123')
      const result = devTracker.redact('My key: sk_live_abc123')

      expect(result).toBe('My key: sk_live_abc123')
    })
  })

  describe('getSecretNames', () => {
    it('should return all tracked secret names', () => {
      tracker.track('API_KEY', 'key123')
      tracker.track('PASSWORD', 'pass456')
      tracker.track('TOKEN', 'token789')

      const names = tracker.getSecretNames()
      expect(names).toEqual(['API_KEY', 'PASSWORD', 'TOKEN'])
    })

    it('should return empty array when no secrets tracked', () => {
      expect(tracker.getSecretNames()).toEqual([])
    })

    it('should NOT return secret values', () => {
      tracker.track('API_KEY', 'sk_live_abc123')
      const names = tracker.getSecretNames()

      expect(names).toContain('API_KEY')
      expect(names.join(',')).not.toContain('sk_live_')
    })
  })

  describe('clear', () => {
    it('should clear all tracked secrets', () => {
      tracker.track('API_KEY', 'key123')
      tracker.track('PASSWORD', 'pass456')

      tracker.clear()

      expect(tracker.getSecretNames()).toEqual([])
      expect(tracker.isTracked('API_KEY')).toBe(false)
    })

    it('should allow tracking new secrets after clear', () => {
      tracker.track('API_KEY', 'key123')
      tracker.clear()
      tracker.track('NEW_KEY', 'new_value')

      expect(tracker.isTracked('NEW_KEY')).toBe(true)
    })
  })

  describe('isTracked', () => {
    it('should return true for tracked secrets', () => {
      tracker.track('API_KEY', 'key123')
      expect(tracker.isTracked('API_KEY')).toBe(true)
    })

    it('should return false for non-tracked secrets', () => {
      expect(tracker.isTracked('NON_EXISTENT')).toBe(false)
    })

    it('should be case-sensitive', () => {
      tracker.track('API_KEY', 'key123')
      expect(tracker.isTracked('API_KEY')).toBe(true)
      expect(tracker.isTracked('api_key')).toBe(false)
      expect(tracker.isTracked('Api_Key')).toBe(false)
    })
  })
})

describe('getSecretTracker', () => {
  afterEach(() => {
    resetGlobalTracker()
  })

  it('should return a singleton instance', () => {
    const tracker1 = getSecretTracker()
    const tracker2 = getSecretTracker()

    expect(tracker1).toBe(tracker2)
  })

  it('should persist tracked secrets across calls', () => {
    const tracker1 = getSecretTracker()
    tracker1.track('API_KEY', 'key123')

    const tracker2 = getSecretTracker()
    expect(tracker2.isTracked('API_KEY')).toBe(true)
  })

  it('should create new instance after reset', () => {
    const tracker1 = getSecretTracker()
    tracker1.track('API_KEY', 'key123')

    resetGlobalTracker()

    const tracker2 = getSecretTracker()
    expect(tracker2.isTracked('API_KEY')).toBe(false)
  })
})

describe('production environment detection', () => {
  it('should detect production from NODE_ENV', () => {
    if (typeof process !== 'undefined' && process.env) {
      process.env.NODE_ENV = 'production'
      process.env.IX_DEBUG_SECRETS = 'true'
    }

    const tracker = new SecretTracker()
    tracker.track('SECRET', 'value123')

    // Should redact in production despite debug flag
    expect(tracker.redact('value123')).toContain('[REDACTED:SECRET]')
  })

  it('should allow debug mode in test environment', () => {
    if (typeof process !== 'undefined' && process.env) {
      process.env.NODE_ENV = 'test'
      process.env.IX_DEBUG_SECRETS = 'true'
    }

    const tracker = new SecretTracker()
    tracker.track('SECRET', 'value123')

    // Should NOT redact in test with debug enabled
    expect(tracker.redact('value123')).toBe('value123')
  })
})
