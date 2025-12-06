import { describe, it, expect } from 'vitest'
import { defineConfig } from '../../src/config/define-config'
import { ConfigError } from '../../src/config/errors'

describe('defineConfig', () => {
  describe('valid configurations', () => {
    it('should accept minimal config and apply defaults', () => {
      const config = defineConfig({ name: 'my-app' })

      expect(config.name).toBe('my-app')
      // Should have defaults applied
      expect(config.database?.binding).toBe('DB')
      expect(config.database?.warmup).toBe(true)
      expect(config.cache?.binding).toBe('CACHE')
      expect(config.cache?.defaultTtl).toBe(3600)
      expect(config.security?.csrf).toBe(true)
      expect(config.security?.headers).toBe(true)
    })

    it('should preserve user-provided values', () => {
      const config = defineConfig({
        name: 'custom-app',
        database: {
          binding: 'MY_DB',
          warmup: false,
        },
        cache: {
          binding: 'MY_KV',
          defaultTtl: 7200,
        },
        security: {
          csrf: false,
          headers: false,
        },
      })

      expect(config.database?.binding).toBe('MY_DB')
      expect(config.database?.warmup).toBe(false)
      expect(config.cache?.binding).toBe('MY_KV')
      expect(config.cache?.defaultTtl).toBe(7200)
      expect(config.security?.csrf).toBe(false)
      expect(config.security?.headers).toBe(false)
    })

    it('should accept environment variables', () => {
      const config = defineConfig({
        name: 'my-app',
        env: {
          API_KEY: 'secret',
          PORT: 3000,
          DEBUG: true,
        },
      })

      expect(config.env?.API_KEY).toBe('secret')
      expect(config.env?.PORT).toBe(3000)
      expect(config.env?.DEBUG).toBe(true)
    })

    it('should accept lifecycle hooks', () => {
      const preBuild = () => {}
      const postBuild = () => {}

      const config = defineConfig({
        name: 'my-app',
        hooks: {
          'pre-build': preBuild,
          'post-build': postBuild,
        },
      })

      // Zod wraps functions, so check for function type
      expect(typeof config.hooks?.['pre-build']).toBe('function')
      expect(typeof config.hooks?.['post-build']).toBe('function')
    })

    it('should accept custom commands', () => {
      const handler = async () => {}

      const config = defineConfig({
        name: 'my-app',
        commands: {
          'my-command': {
            description: 'Does something cool',
            handler,
          },
        },
      })

      expect(config.commands?.['my-command'].description).toBe('Does something cool')
      // Zod wraps functions, so check for function type
      expect(typeof config.commands?.['my-command'].handler).toBe('function')
    })

    it('should merge partial config sections with defaults', () => {
      // Only provide binding, warmup should get default
      const config = defineConfig({
        name: 'my-app',
        database: {
          binding: 'CUSTOM_DB',
          warmup: true,
        },
      })

      expect(config.database?.binding).toBe('CUSTOM_DB')
      expect(config.database?.warmup).toBe(true) // Default
      // Other sections should get full defaults
      expect(config.cache?.binding).toBe('CACHE')
    })
  })

  describe('invalid configurations', () => {
    it('should throw ConfigError for missing name', () => {
      expect(() => defineConfig({} as any)).toThrow(ConfigError)
    })

    it('should throw ConfigError for empty name', () => {
      expect(() => defineConfig({ name: '' })).toThrow(ConfigError)
    })

    it('should throw ConfigError for name too long', () => {
      expect(() => defineConfig({ name: 'a'.repeat(101) })).toThrow(ConfigError)
    })

    it('should throw ConfigError for invalid type', () => {
      expect(() => defineConfig({ name: 123 as any })).toThrow(ConfigError)
    })

    it('should throw ConfigError for invalid cache TTL', () => {
      expect(() =>
        defineConfig({
          name: 'test',
          cache: { binding: 'CACHE', defaultTtl: -1 },
        })
      ).toThrow(ConfigError)
    })

    it('should throw ConfigError for empty binding', () => {
      expect(() =>
        defineConfig({
          name: 'test',
          database: { binding: '', warmup: true },
        })
      ).toThrow(ConfigError)
    })

    it('should include helpful error message', () => {
      try {
        defineConfig({ name: '' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError)
        const configError = error as ConfigError
        expect(configError.message).toContain('Invalid')
        expect(configError.message).toContain('name')
      }
    })

    it('should include issues array for validation errors', () => {
      try {
        defineConfig({ name: '' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError)
        const configError = error as ConfigError
        expect(configError.issues.length).toBeGreaterThan(0)
        expect(configError.issues[0].path).toBe('name')
      }
    })
  })

  describe('type inference', () => {
    it('should provide correct types for returned config', () => {
      const config = defineConfig({
        name: 'typed-app',
        database: {
          binding: 'DB',
          warmup: true,
        },
      })

      // These should be type-safe (TypeScript compile-time check)
      const name: string = config.name
      const binding: string | undefined = config.database?.binding
      const warmup: boolean | undefined = config.database?.warmup
      const ttl: number | undefined = config.cache?.defaultTtl

      expect(name).toBe('typed-app')
      expect(binding).toBe('DB')
      expect(warmup).toBe(true)
      expect(ttl).toBe(3600) // Default
    })
  })
})
