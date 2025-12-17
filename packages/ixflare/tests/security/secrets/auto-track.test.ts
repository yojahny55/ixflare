import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  autoTrackSecrets,
  getSecretTracker,
  resetGlobalTracker,
} from '../../../src/security/secrets/tracker'

describe('autoTrackSecrets', () => {
  beforeEach(() => {
    resetGlobalTracker()
  })

  afterEach(() => {
    resetGlobalTracker()
  })

  describe('automatic detection', () => {
    it('should track API_KEY', () => {
      const env = { API_KEY: 'sk_live_abc123', DEBUG: 'true' }

      const { tracked, skipped } = autoTrackSecrets(env)

      expect(tracked).toContain('API_KEY')
      expect(skipped).toContain('DEBUG')
    })

    it('should track various API key formats', () => {
      const env = {
        API_KEY: 'key1',
        APIKEY: 'key2',
        API_KEY_SECRET: 'key3',
        MY_API_KEY: 'key4',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('API_KEY')
      expect(tracked).toContain('APIKEY')
      expect(tracked).toContain('API_KEY_SECRET')
      expect(tracked).toContain('MY_API_KEY')
    })

    it('should track SECRET variables', () => {
      const env = {
        JWT_SECRET: 'secret1',
        MY_SECRET: 'secret2',
        SECRET_KEY: 'secret3',
        APP_SECRET: 'secret4',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('JWT_SECRET')
      expect(tracked).toContain('MY_SECRET')
      expect(tracked).toContain('SECRET_KEY')
      expect(tracked).toContain('APP_SECRET')
    })

    it('should track TOKEN variables', () => {
      const env = {
        ACCESS_TOKEN: 'token1',
        REFRESH_TOKEN: 'token2',
        AUTH_TOKEN: 'token3',
        SESSION_TOKEN: 'token4',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('ACCESS_TOKEN')
      expect(tracked).toContain('REFRESH_TOKEN')
      expect(tracked).toContain('AUTH_TOKEN')
      expect(tracked).toContain('SESSION_TOKEN')
    })

    it('should track PASSWORD variables', () => {
      const env = {
        PASSWORD: 'pass1',
        DB_PASSWORD: 'pass2',
        USER_PASSWORD: 'pass3',
        ADMIN_PASSWORD: 'pass4',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('PASSWORD')
      expect(tracked).toContain('DB_PASSWORD')
      expect(tracked).toContain('USER_PASSWORD')
      expect(tracked).toContain('ADMIN_PASSWORD')
    })

    it('should track AUTH variables', () => {
      const env = {
        AUTH_KEY: 'auth1',
        OAUTH_SECRET: 'auth2',
        AUTH_TOKEN: 'auth3',
        BASIC_AUTH: 'auth4',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('AUTH_KEY')
      expect(tracked).toContain('OAUTH_SECRET')
      expect(tracked).toContain('AUTH_TOKEN')
      expect(tracked).toContain('BASIC_AUTH')
    })

    it('should track DATABASE_URL variables', () => {
      const env = {
        DATABASE_URL: 'postgres://user:pass@host/db',
        DATABASE_CONNECTION_STRING: 'mysql://user:pass@host/db',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('DATABASE_URL')
      expect(tracked).toContain('DATABASE_CONNECTION_STRING')
    })

    it('should track PRIVATE_KEY variables', () => {
      const env = {
        PRIVATE_KEY: 'key1',
        RSA_PRIVATE_KEY: 'key2',
        SSH_PRIVATE_KEY: 'key3',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('PRIVATE_KEY')
      expect(tracked).toContain('RSA_PRIVATE_KEY')
      expect(tracked).toContain('SSH_PRIVATE_KEY')
    })

    it('should track CREDENTIAL variables', () => {
      const env = {
        CREDENTIAL: 'cred1',
        AWS_CREDENTIALS: 'cred2',
        DB_CREDENTIALS: 'cred3',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('CREDENTIAL')
      expect(tracked).toContain('AWS_CREDENTIALS')
      expect(tracked).toContain('DB_CREDENTIALS')
    })

    it('should track JWT variables', () => {
      const env = {
        JWT_SECRET: 'jwt1',
        JWT_SIGNING_KEY: 'jwt2',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('JWT_SECRET')
      expect(tracked).toContain('JWT_SIGNING_KEY')
    })

    it('should track SIGNING and ENCRYPTION variables', () => {
      const env = {
        SIGNING_KEY: 'sign1',
        ENCRYPTION_KEY: 'enc1',
        COOKIE_SIGNING_SECRET: 'sign2',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('SIGNING_KEY')
      expect(tracked).toContain('ENCRYPTION_KEY')
      expect(tracked).toContain('COOKIE_SIGNING_SECRET')
    })
  })

  describe('skip non-secrets', () => {
    it('should skip non-secret variables', () => {
      const env = {
        NODE_ENV: 'production',
        DEBUG: 'true',
        PORT: '3000',
        HOST: 'localhost',
        LOG_LEVEL: 'info',
      }

      const { tracked, skipped } = autoTrackSecrets(env)

      expect(tracked).toHaveLength(0)
      expect(skipped).toContain('NODE_ENV')
      expect(skipped).toContain('DEBUG')
      expect(skipped).toContain('PORT')
    })

    it('should skip non-string values', () => {
      const env = {
        API_KEY: 'secret',
        KV_BINDING: { get: () => {}, put: () => {} } as unknown,
        D1_BINDING: { prepare: () => {} } as unknown,
        NUMBER_VAL: 123 as unknown,
      }

      const { tracked, skipped } = autoTrackSecrets(env as Record<string, unknown>)

      expect(tracked).toContain('API_KEY')
      expect(skipped).toContain('KV_BINDING')
      expect(skipped).toContain('D1_BINDING')
      expect(skipped).toContain('NUMBER_VAL')
    })

    it('should skip empty values', () => {
      const env = {
        API_KEY: '',
        SECRET: '',
        TOKEN: 'valid_token',
      }

      const { tracked, skipped } = autoTrackSecrets(env)

      expect(tracked).toContain('TOKEN')
      expect(skipped).toContain('API_KEY')
      expect(skipped).toContain('SECRET')
    })
  })

  describe('options', () => {
    it('should respect exclude option', () => {
      const env = {
        API_KEY: 'key1',
        SECRET_KEY: 'key2',
        TOKEN: 'key3',
      }

      const { tracked, skipped } = autoTrackSecrets(env, {
        exclude: ['API_KEY', 'TOKEN'],
      })

      expect(tracked).toContain('SECRET_KEY')
      expect(tracked).not.toContain('API_KEY')
      expect(tracked).not.toContain('TOKEN')
      expect(skipped).toContain('API_KEY')
      expect(skipped).toContain('TOKEN')
    })

    it('should respect include option', () => {
      const env = {
        CUSTOM_VALUE: 'custom1',
        ANOTHER_CUSTOM: 'custom2',
        DEBUG: 'true',
      }

      const { tracked } = autoTrackSecrets(env, {
        include: ['CUSTOM_VALUE', 'ANOTHER_CUSTOM'],
      })

      expect(tracked).toContain('CUSTOM_VALUE')
      expect(tracked).toContain('ANOTHER_CUSTOM')
    })

    it('should respect additionalPatterns option', () => {
      const env = {
        MY_SPECIAL_KEY: 'special1',
        ANOTHER_SPECIAL: 'special2',
        DEBUG: 'true',
      }

      const { tracked } = autoTrackSecrets(env, {
        additionalPatterns: [/SPECIAL/i],
      })

      expect(tracked).toContain('MY_SPECIAL_KEY')
      expect(tracked).toContain('ANOTHER_SPECIAL')
    })
  })

  describe('tracker integration', () => {
    it('should register secrets with the global tracker', () => {
      const env = {
        API_KEY: 'sk_live_abc123',
        JWT_SECRET: 'super_secret_jwt',
      }

      autoTrackSecrets(env)

      const tracker = getSecretTracker()
      expect(tracker.isTracked('API_KEY')).toBe(true)
      expect(tracker.isTracked('JWT_SECRET')).toBe(true)
    })

    it('should redact tracked values', () => {
      const env = {
        API_KEY: 'sk_live_abc123',
      }

      autoTrackSecrets(env)

      const tracker = getSecretTracker()
      const result = tracker.redact('My key is sk_live_abc123')

      expect(result).toBe('My key is [REDACTED:API_KEY]')
    })

    it('should handle real-world Cloudflare Worker env', () => {
      // Simulate a typical Cloudflare Worker env
      const env = {
        // Secrets (should be tracked)
        STRIPE_SECRET_KEY: 'sk_live_51HvI9aB2C3D4E5F6G7H8I9J',
        DATABASE_URL: 'postgres://user:pass@host/db',
        JWT_SECRET: 'super_secret_jwt_key',
        SESSION_SECRET: 'session_signing_key',
        OAUTH_CLIENT_SECRET: 'oauth_secret_value',

        // Non-secrets (should be skipped)
        ENVIRONMENT: 'production',
        LOG_LEVEL: 'info',
        ALLOWED_ORIGINS: 'https://example.com',

        // Bindings (non-string, should be skipped)
        KV: { get: () => {}, put: () => {} } as unknown,
        D1: { prepare: () => {} } as unknown,
      }

      const { tracked, skipped } = autoTrackSecrets(env as Record<string, unknown>)

      // Verify secrets are tracked
      expect(tracked).toContain('STRIPE_SECRET_KEY')
      expect(tracked).toContain('DATABASE_URL')
      expect(tracked).toContain('JWT_SECRET')
      expect(tracked).toContain('SESSION_SECRET')
      expect(tracked).toContain('OAUTH_CLIENT_SECRET')

      // Verify non-secrets are skipped
      expect(skipped).toContain('ENVIRONMENT')
      expect(skipped).toContain('LOG_LEVEL')
      expect(skipped).toContain('ALLOWED_ORIGINS')
      expect(skipped).toContain('KV')
      expect(skipped).toContain('D1')

      // Verify redaction works
      const tracker = getSecretTracker()
      const redacted = tracker.redact('Connecting to postgres://user:pass@host/db')
      expect(redacted).toContain('[REDACTED:DATABASE_URL]')
    })
  })

  describe('case sensitivity', () => {
    it('should match patterns case-insensitively', () => {
      const env = {
        api_key: 'key1',
        Api_Key: 'key2',
        API_KEY: 'key3',
        ApIkEy: 'key4',
      }

      const { tracked } = autoTrackSecrets(env)

      expect(tracked).toContain('api_key')
      expect(tracked).toContain('Api_Key')
      expect(tracked).toContain('API_KEY')
      expect(tracked).toContain('ApIkEy')
    })
  })
})
