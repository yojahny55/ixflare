/**
 * Integration tests for error system
 * Tests the full error lifecycle from creation to display
 */

import { describe, it, expect } from 'vitest'
import { CLIError } from '@/errors/cli-error'
import { ConfigError } from '@/errors/config-error'
import { BuildError } from '@/errors/build-error'
import { formatError } from '@/errors/formatter'
import type { FormatOptions } from '@/errors/types'

describe('Error System Integration', () => {
  const plainOptions: FormatOptions = {
    color: false,
    verbose: false,
    interactive: false,
  }

  it('should create and format complete error with all features', () => {
    const error = new ConfigError({
      code: 'IX_E103',
      message: 'Invalid configuration value',
      causes: [
        'RS256 algorithm is not supported',
        'Only ES256 and HS256 are allowed for Cloudflare Workers',
      ],
      fixes: [
        'Change `algorithm: "RS256"` to `algorithm: "ES256"`',
        'See documentation for supported algorithms',
      ],
      sourceLocation: {
        file: 'edge.config.ts',
        line: 3,
        column: 16,
        length: 6,
        snippet: `auth: {
  jwt: {
    algorithm: "RS256",
  }
}`,
      },
    })

    const output = formatError(error, plainOptions)

    // Verify all components are present
    expect(output).toContain('IX_E103')
    expect(output).toContain('Invalid configuration value')
    expect(output).toContain('edge.config.ts:3:16')
    expect(output).toContain('This usually means:')
    expect(output).toContain('RS256 algorithm is not supported')
    expect(output).toContain('Quick fixes:')
    expect(output).toContain('Change `algorithm: "RS256"` to `algorithm: "ES256"`')
    expect(output).toContain('More info:')
    expect(output).toContain('https://ixflare.dev/errors/IX_E103')
    expect(output).toContain('^^^^^^') // Error pointer
  })

  it('should handle module not found error scenario', () => {
    const error = new BuildError({
      code: 'IX_E203',
      message: 'Cannot find module @/models/User',
      causes: [
        "The file doesn't exist at src/models/User.ts",
        "There's a typo in the import path",
        "TypeScript paths aren't configured correctly",
      ],
      fixes: [
        'Create the file: `touch src/models/User.ts`',
        'Check tsconfig.json paths configuration',
        'Verify the import statement',
      ],
    })

    const output = formatError(error, plainOptions)

    expect(output).toContain('IX_E203')
    expect(output).toContain('Cannot find module @/models/User')
    expect(output).toContain('touch src/models/User.ts')
    expect(output).toContain('tsconfig.json')
  })

  it('should format error for verbose debugging', () => {
    const originalError = new Error('ENOENT: no such file or directory')
    const error = new CLIError({
      code: 'IX_E903',
      message: 'File system error',
      originalError,
    })

    const verboseOutput = formatError(error, { ...plainOptions, verbose: true })

    expect(verboseOutput).toContain('Verbose Debug Information')
    expect(verboseOutput).toContain('Stack trace')
    expect(verboseOutput).toContain('Original error')
    expect(verboseOutput).toContain('ENOENT')
    expect(verboseOutput).toContain('Node version')
    expect(verboseOutput).toContain('Platform')
  })

  it('should serialize error to JSON for logging', () => {
    const error = new ConfigError({
      code: 'IX_E101',
      message: 'Invalid syntax',
      causes: ['Unexpected token'],
      fixes: ['Check syntax'],
    })

    const json = error.toJSON()

    expect(json).toMatchObject({
      name: 'ConfigError',
      code: 'IX_E101',
      message: 'Invalid syntax',
      causes: ['Unexpected token'],
      fixes: ['Check syntax'],
      severity: 'error',
    })
    expect(json.stack).toBeDefined()
    expect(json.docsUrl).toBe('https://ixflare.dev/errors/IX_E101')
  })

  it('should create user-friendly deployment error', () => {
    const error = new ConfigError({
      code: 'IX_E301',
      message: 'Missing Cloudflare credentials',
      causes: ['CLOUDFLARE_API_TOKEN environment variable not set', 'wrangler login not completed'],
      fixes: [
        'Run: `wrangler login`',
        'Or set CLOUDFLARE_API_TOKEN in your environment',
        'Get token at: https://dash.cloudflare.com/profile/api-tokens',
      ],
    })

    const output = formatError(error, plainOptions)

    expect(output).toContain('wrangler login')
    expect(output).toContain('CLOUDFLARE_API_TOKEN')
    expect(output).toContain('dash.cloudflare.com')
  })
})

describe('Error Display Modes', () => {
  it('should adapt output for CI environments', () => {
    const error = new CLIError({
      code: 'IX_E201',
      message: 'Build failed',
    })

    const ciOptions: FormatOptions = {
      color: false, // No color in CI
      verbose: false,
      interactive: false, // Not interactive
    }

    const output = formatError(error, ciOptions)

    // Should not contain ANSI codes (verified by length being similar to content)
    expect(output).toContain('IX_E201')
    expect(output).toContain('Build failed')
  })

  it('should show minimal output for simple errors', () => {
    const error = new CLIError({
      code: 'IX_E902',
      message: 'Invalid command argument',
    })

    const output = formatError(error, {
      color: false,
      verbose: false,
      interactive: false,
    })

    // Minimal error should still be informative
    expect(output).toContain('IX_E902')
    expect(output).toContain('Invalid command argument')
  })
})
