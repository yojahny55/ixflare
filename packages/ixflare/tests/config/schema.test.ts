import { describe, it, expect } from 'vitest'
import {
  configSchema,
  databaseConfigSchema,
  cacheConfigSchema,
  securityConfigSchema,
  hooksConfigSchema,
  commandSchema,
  envConfigSchema,
  type IxflareConfig,
} from '../../src/config/schema'
import { createMiddleware } from '../../src/core/middleware'

describe('configSchema', () => {
  describe('valid configurations', () => {
    it('should validate minimal config with just name', () => {
      const config = { name: 'my-app' }
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('my-app')
      }
    })

    it('should validate full config with all options', () => {
      const config: IxflareConfig = {
        name: 'full-app',
        env: {
          API_KEY: 'secret',
          DEBUG: true,
          PORT: 3000,
        },
        database: {
          binding: 'MY_DB',
          warmup: false,
        },
        cache: {
          binding: 'MY_CACHE',
          defaultTtl: 7200,
        },
        security: {
          csrf: false,
          headers: true,
        },
        hooks: {
          'pre-build': () => {},
          'post-build': () => {},
        },
        commands: {
          'custom-cmd': {
            description: 'A custom command',
            handler: () => {},
          },
        },
      }

      const result = configSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('should apply default values for database config', () => {
      const result = databaseConfigSchema.safeParse({})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.binding).toBe('DB')
        expect(result.data.warmup).toBe(true)
      }
    })

    it('should apply default values for cache config', () => {
      const result = cacheConfigSchema.safeParse({})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.binding).toBe('CACHE')
        expect(result.data.defaultTtl).toBe(3600)
      }
    })

    it('should apply default values for security config', () => {
      const result = securityConfigSchema.safeParse({})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.csrf).toBe(true)
        expect(result.data.headers).toBe(true)
      }
    })
  })

  describe('invalid configurations', () => {
    it('should reject config without name', () => {
      const config = {}
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const config = { name: '' }
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('required')
      }
    })

    it('should reject name over 100 characters', () => {
      const config = { name: 'a'.repeat(101) }
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100')
      }
    })

    it('should reject non-integer cache TTL', () => {
      const config = {
        name: 'test',
        cache: { defaultTtl: 3.5 },
      }
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(false)
    })

    it('should reject negative cache TTL', () => {
      const config = {
        name: 'test',
        cache: { defaultTtl: -1 },
      }
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(false)
    })

    it('should reject empty binding name', () => {
      const config = {
        name: 'test',
        database: { binding: '' },
      }
      const result = configSchema.safeParse(config)

      expect(result.success).toBe(false)
    })
  })

  describe('type inference', () => {
    it('should infer correct types from schema', () => {
      const config: IxflareConfig = {
        name: 'typed-app',
        database: {
          binding: 'DB',
          warmup: true,
        },
      }

      // TypeScript should enforce these types
      expect(typeof config.name).toBe('string')
      expect(typeof config.database?.binding).toBe('string')
      expect(typeof config.database?.warmup).toBe('boolean')
    })
  })
})

describe('envConfigSchema', () => {
  it('should accept string values', () => {
    const result = envConfigSchema.safeParse({ API_KEY: 'secret' })
    expect(result.success).toBe(true)
  })

  it('should accept number values', () => {
    const result = envConfigSchema.safeParse({ PORT: 3000 })
    expect(result.success).toBe(true)
  })

  it('should accept boolean values', () => {
    const result = envConfigSchema.safeParse({ DEBUG: true })
    expect(result.success).toBe(true)
  })

  it('should accept mixed values', () => {
    const result = envConfigSchema.safeParse({
      API_KEY: 'secret',
      PORT: 3000,
      DEBUG: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('hooksConfigSchema', () => {
  it('should accept valid hook functions', () => {
    const hooks = {
      'pre-build': () => {},
      'post-build': () => {},
      'pre-deploy': () => {},
      'post-deploy': () => {},
    }
    const result = hooksConfigSchema.safeParse(hooks)
    expect(result.success).toBe(true)
  })

  it('should accept async hook functions', () => {
    const hooks = {
      'pre-build': async () => {},
    }
    const result = hooksConfigSchema.safeParse(hooks)
    expect(result.success).toBe(true)
  })

  it('should accept partial hooks', () => {
    const hooks = {
      'pre-build': () => {},
    }
    const result = hooksConfigSchema.safeParse(hooks)
    expect(result.success).toBe(true)
  })
})

describe('commandSchema', () => {
  it('should accept valid command', () => {
    const command = {
      description: 'Test command',
      handler: () => {},
    }
    const result = commandSchema.safeParse(command)
    expect(result.success).toBe(true)
  })

  it('should reject command without description', () => {
    const command = {
      handler: () => {},
    }
    const result = commandSchema.safeParse(command)
    expect(result.success).toBe(false)
  })

  it('should reject empty description', () => {
    const command = {
      description: '',
      handler: () => {},
    }
    const result = commandSchema.safeParse(command)
    expect(result.success).toBe(false)
  })
})

describe('middleware configuration', () => {
  it('should accept config with middleware array', () => {
    const loggingMiddleware = createMiddleware(async (ctx, next) => {
      console.log(`${ctx.method} ${ctx.url.pathname}`)
      return next()
    })

    const corsMiddleware = createMiddleware(async (ctx, next) => {
      const response = await next()
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    })

    const config = {
      name: 'my-app',
      middleware: [loggingMiddleware, corsMiddleware],
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.middleware).toHaveLength(2)
    }
  })

  it('should accept config with empty middleware array', () => {
    const config = {
      name: 'my-app',
      middleware: [],
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should accept config without middleware field', () => {
    const config = {
      name: 'my-app',
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.middleware).toBeUndefined()
    }
  })

  it('should reject config with non-array middleware', () => {
    const config = {
      name: 'my-app',
      middleware: 'not-an-array',
    }

    const result = configSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})
