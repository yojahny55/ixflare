/**
 * CSRF Configuration Schema Tests
 * Story 5-6: CSRF Protection
 */

import { describe, it, expect } from 'vitest'
import { csrfConfigSchema, securityConfigSchema } from '../../src/config/schema'

describe('CSRF Configuration Schema', () => {
  describe('csrfConfigSchema', () => {
    it('should validate complete CSRF config', () => {
      const config = {
        enabled: true,
        cookie: '__csrf',
        header: 'X-CSRF-Token',
        bodyField: '_csrf',
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'] as const,
        sameSite: 'strict' as const,
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result).toEqual(config)
    })

    it('should apply default values', () => {
      const config = {
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result.enabled).toBe(true)
      expect(result.cookie).toBe('__csrf')
      expect(result.header).toBe('X-CSRF-Token')
      expect(result.bodyField).toBe('_csrf')
      expect(result.methods).toEqual(['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(result.sameSite).toBe('strict')
    })

    it('should allow custom cookie name', () => {
      const config = {
        cookie: '_custom_csrf',
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result.cookie).toBe('_custom_csrf')
    })

    it('should allow custom header name', () => {
      const config = {
        header: 'X-Custom-CSRF',
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result.header).toBe('X-Custom-CSRF')
    })

    it('should allow custom body field name', () => {
      const config = {
        bodyField: '_custom_token',
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result.bodyField).toBe('_custom_token')
    })

    it('should allow sameSite=lax', () => {
      const config = {
        sameSite: 'lax' as const,
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result.sameSite).toBe('lax')
    })

    it('should allow custom methods array', () => {
      const config = {
        methods: ['POST', 'PUT'] as const,
        secret: 'test-secret-key',
      }

      const result = csrfConfigSchema.parse(config)

      expect(result.methods).toEqual(['POST', 'PUT'])
    })

    it('should require secret', () => {
      const config = {
        enabled: true,
      }

      expect(() => csrfConfigSchema.parse(config)).toThrow()
    })

    it('should reject empty secret', () => {
      const config = {
        secret: '',
      }

      expect(() => csrfConfigSchema.parse(config)).toThrow()
    })

    it('should reject invalid sameSite value', () => {
      const config = {
        sameSite: 'none',
        secret: 'test-secret-key',
      }

      expect(() => csrfConfigSchema.parse(config)).toThrow()
    })

    it('should reject invalid method', () => {
      const config = {
        methods: ['GET', 'POST'],
        secret: 'test-secret-key',
      }

      expect(() => csrfConfigSchema.parse(config)).toThrow()
    })
  })

  describe('securityConfigSchema', () => {
    it('should accept boolean csrf value', () => {
      const config = {
        csrf: true,
        headers: true,
      }

      const result = securityConfigSchema.parse(config)

      expect(result.csrf).toBe(true)
    })

    it('should accept CSRF config object', () => {
      const config = {
        csrf: {
          enabled: true,
          cookie: '__csrf',
          header: 'X-CSRF-Token',
          bodyField: '_csrf',
          methods: ['POST', 'PUT', 'PATCH', 'DELETE'] as const,
          sameSite: 'strict' as const,
          secret: 'test-secret-key',
        },
        headers: true,
      }

      const result = securityConfigSchema.parse(config)

      expect(result.csrf).toEqual({
        enabled: true,
        cookie: '__csrf',
        header: 'X-CSRF-Token',
        bodyField: '_csrf',
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        sameSite: 'strict',
        secret: 'test-secret-key',
      })
    })

    it('should apply defaults for security config', () => {
      const config = {}

      const result = securityConfigSchema.parse(config)

      expect(result.csrf).toBe(true)
      expect(result.headers).toBe(true)
    })

    it('should allow disabling CSRF', () => {
      const config = {
        csrf: false,
      }

      const result = securityConfigSchema.parse(config)

      expect(result.csrf).toBe(false)
    })
  })

  describe('Configuration Use Cases', () => {
    it('should support minimal CSRF configuration', () => {
      // User only provides secret, everything else uses defaults
      const config = {
        csrf: {
          secret: 'my-secret-key',
        },
      }

      const result = securityConfigSchema.parse(config)

      expect(result.csrf).toMatchObject({
        enabled: true,
        cookie: '__csrf',
        header: 'X-CSRF-Token',
        bodyField: '_csrf',
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        sameSite: 'strict',
        secret: 'my-secret-key',
      })
    })

    it('should support full custom CSRF configuration', () => {
      const config = {
        csrf: {
          enabled: true,
          cookie: '_xsrf',
          header: 'X-XSRF-Token',
          bodyField: '_xsrf_token',
          methods: ['POST', 'PATCH'] as const,
          sameSite: 'lax' as const,
          secret: 'custom-secret-key',
        },
      }

      const result = securityConfigSchema.parse(config)

      expect(result.csrf).toEqual({
        enabled: true,
        cookie: '_xsrf',
        header: 'X-XSRF-Token',
        bodyField: '_xsrf_token',
        methods: ['POST', 'PATCH'],
        sameSite: 'lax',
        secret: 'custom-secret-key',
      })
    })

    it('should support simple on/off configuration', () => {
      // Legacy simple boolean configuration
      const enabledConfig = { csrf: true }
      const disabledConfig = { csrf: false }

      const enabledResult = securityConfigSchema.parse(enabledConfig)
      const disabledResult = securityConfigSchema.parse(disabledConfig)

      expect(enabledResult.csrf).toBe(true)
      expect(disabledResult.csrf).toBe(false)
    })
  })
})
