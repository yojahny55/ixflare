import { describe, it, expect } from 'vitest'
import {
  defaults,
  deepMerge,
  applyDefaults,
  DEFAULT_DATABASE_BINDING,
  DEFAULT_CACHE_BINDING,
  DEFAULT_CACHE_TTL,
} from '../../src/config/defaults'
import type { IxflareConfig } from '../../src/config/schema'

describe('defaults', () => {
  it('should have correct database defaults', () => {
    expect(defaults.database?.binding).toBe(DEFAULT_DATABASE_BINDING)
    expect(defaults.database?.warmup).toBe(true)
  })

  it('should have correct cache defaults', () => {
    expect(defaults.cache?.binding).toBe(DEFAULT_CACHE_BINDING)
    expect(defaults.cache?.defaultTtl).toBe(DEFAULT_CACHE_TTL)
  })

  it('should have correct security defaults', () => {
    expect(defaults.security?.csrf).toBe(true)
    expect(defaults.security?.headers).toBe(true)
  })
})

describe('deepMerge', () => {
  it('should merge flat objects', () => {
    const target = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('should preserve target values when source has undefined', () => {
    const target = { a: 1, b: 2 }
    const source = { a: undefined }
    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('should merge nested objects recursively', () => {
    const target = {
      outer: {
        inner: 'original',
        preserved: true,
      },
    }
    const source = {
      outer: {
        inner: 'overridden',
      },
    }
    const result = deepMerge(target, source)

    expect(result.outer.inner).toBe('overridden')
    expect(result.outer.preserved).toBe(true)
  })

  it('should override arrays (not merge)', () => {
    const target = { arr: [1, 2, 3] }
    const source = { arr: [4, 5] }
    const result = deepMerge(target, source)

    expect(result.arr).toEqual([4, 5])
  })

  it('should handle null values correctly', () => {
    const target = { a: { b: 1 } }
    const source = { a: null }
    const result = deepMerge(target, source)

    expect(result.a).toBe(null)
  })

  it('should not mutate original objects', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    const result = deepMerge(target, source)

    expect(target).toEqual({ a: 1 })
    expect(source).toEqual({ b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })
})

describe('applyDefaults', () => {
  it('should apply defaults to minimal config', () => {
    const config: IxflareConfig = { name: 'test-app' }
    const result = applyDefaults(config)

    expect(result.name).toBe('test-app')
    expect(result.database?.binding).toBe('DB')
    expect(result.database?.warmup).toBe(true)
    expect(result.cache?.binding).toBe('CACHE')
    expect(result.cache?.defaultTtl).toBe(3600)
    expect(result.security?.csrf).toBe(true)
    expect(result.security?.headers).toBe(true)
  })

  it('should preserve user-provided values over defaults', () => {
    const config: IxflareConfig = {
      name: 'test-app',
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
        headers: false,
      },
    }
    const result = applyDefaults(config)

    expect(result.database?.binding).toBe('MY_DB')
    expect(result.database?.warmup).toBe(false)
    expect(result.cache?.binding).toBe('MY_CACHE')
    expect(result.cache?.defaultTtl).toBe(7200)
    expect(result.security?.csrf).toBe(false)
    expect(result.security?.headers).toBe(false)
  })

  it('should merge partial section overrides with defaults', () => {
    const config: IxflareConfig = {
      name: 'test-app',
      database: {
        binding: 'CUSTOM_DB',
        warmup: true, // Will get default
      },
    }
    const result = applyDefaults(config)

    expect(result.database?.binding).toBe('CUSTOM_DB')
    expect(result.database?.warmup).toBe(true)
    // Other sections should get defaults
    expect(result.cache?.binding).toBe('CACHE')
    expect(result.security?.csrf).toBe(true)
  })

  it('should preserve hooks and commands', () => {
    const handler = () => {}
    const config: IxflareConfig = {
      name: 'test-app',
      hooks: {
        'pre-build': handler,
      },
      commands: {
        'my-cmd': {
          description: 'Test',
          handler,
        },
      },
    }
    const result = applyDefaults(config)

    expect(result.hooks?.['pre-build']).toBe(handler)
    expect(result.commands?.['my-cmd'].handler).toBe(handler)
  })

  it('should preserve env variables', () => {
    const config: IxflareConfig = {
      name: 'test-app',
      env: {
        API_KEY: 'secret',
        DEBUG: true,
      },
    }
    const result = applyDefaults(config)

    expect(result.env?.API_KEY).toBe('secret')
    expect(result.env?.DEBUG).toBe(true)
  })
})
