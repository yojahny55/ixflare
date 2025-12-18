/**
 * Tests for specific error type classes
 */

import { describe, it, expect } from 'vitest'
import { ConfigError } from '@/errors/config-error'
import { BuildError } from '@/errors/build-error'
import { DeployError } from '@/errors/deploy-error'
import { DatabaseError } from '@/errors/database-error'
import { AuthError } from '@/errors/auth-error'

describe('ConfigError', () => {
  it('should create config error with docs URL', () => {
    const error = new ConfigError({
      code: 'IX_E101',
      message: 'Invalid configuration syntax',
    })

    expect(error.name).toBe('ConfigError')
    expect(error.code).toBe('IX_E101')
    expect(error.message).toBe('Invalid configuration syntax')
    expect(error.docsUrl).toBe('https://ixflare.dev/errors/IX_E101')
  })

  it('should create config error with all fields', () => {
    const error = new ConfigError({
      code: 'IX_E102',
      message: 'Missing required configuration',
      causes: ['edge.config.ts not found'],
      fixes: ['Create edge.config.ts file'],
    })

    expect(error.causes).toEqual(['edge.config.ts not found'])
    expect(error.fixes).toEqual(['Create edge.config.ts file'])
  })
})

describe('BuildError', () => {
  it('should create build error with docs URL', () => {
    const error = new BuildError({
      code: 'IX_E201',
      message: 'TypeScript compilation error',
    })

    expect(error.name).toBe('BuildError')
    expect(error.code).toBe('IX_E201')
    expect(error.docsUrl).toBe('https://ixflare.dev/errors/IX_E201')
  })

  it('should create build error with source location', () => {
    const error = new BuildError({
      code: 'IX_E203',
      message: 'Module not found',
      sourceLocation: {
        file: 'src/index.ts',
        line: 5,
        column: 10,
      },
    })

    expect(error.sourceLocation).toEqual({
      file: 'src/index.ts',
      line: 5,
      column: 10,
    })
  })
})

describe('DeployError', () => {
  it('should create deploy error with docs URL', () => {
    const error = new DeployError({
      code: 'IX_E301',
      message: 'Missing Cloudflare credentials',
    })

    expect(error.name).toBe('DeployError')
    expect(error.code).toBe('IX_E301')
    expect(error.docsUrl).toBe('https://ixflare.dev/errors/IX_E301')
  })

  it('should create deploy error with recovery suggestions', () => {
    const error = new DeployError({
      code: 'IX_E302',
      message: 'Wrangler configuration missing',
      fixes: ['Run `wrangler login`', 'Set CLOUDFLARE_API_TOKEN'],
    })

    expect(error.fixes).toEqual(['Run `wrangler login`', 'Set CLOUDFLARE_API_TOKEN'])
  })
})

describe('DatabaseError', () => {
  it('should create database error with docs URL', () => {
    const error = new DatabaseError({
      code: 'IX_E401',
      message: 'Migration file not found',
    })

    expect(error.name).toBe('DatabaseError')
    expect(error.code).toBe('IX_E401')
    expect(error.docsUrl).toBe('https://ixflare.dev/errors/IX_E401')
  })

  it('should create database error with technical details', () => {
    const error = new DatabaseError({
      code: 'IX_E402',
      message: 'Schema validation failed',
      causes: ['Table users has invalid column type'],
      fixes: ['Check migration file', 'Review schema definition'],
    })

    expect(error.causes).toContain('Table users has invalid column type')
    expect(error.fixes).toHaveLength(2)
  })
})

describe('AuthError', () => {
  it('should create auth error with docs URL', () => {
    const error = new AuthError({
      code: 'IX_E501',
      message: 'Invalid JWT configuration',
    })

    expect(error.name).toBe('AuthError')
    expect(error.code).toBe('IX_E501')
    expect(error.docsUrl).toBe('https://ixflare.dev/errors/IX_E501')
  })

  it('should create auth error with security details', () => {
    const error = new AuthError({
      code: 'IX_E503',
      message: 'Missing authentication secrets',
      causes: ['JWT_SECRET not set', 'Session secret missing'],
      fixes: ['Set JWT_SECRET in environment', 'Generate secret with openssl'],
    })

    expect(error.causes).toContain('JWT_SECRET not set')
    expect(error.fixes).toHaveLength(2)
  })
})
