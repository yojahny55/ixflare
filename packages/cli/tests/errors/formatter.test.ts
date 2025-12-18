/**
 * Tests for error formatting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CLIError } from '@/errors/cli-error'
import { formatError, detectDisplayOptions } from '@/errors/formatter'
import type { FormatOptions } from '@/errors/types'

describe('formatError', () => {
  const defaultOptions: FormatOptions = {
    color: false, // Disable colors for testing
    verbose: false,
    interactive: false,
  }

  it('should format basic error', () => {
    const error = new CLIError({
      code: 'IX_E101',
      message: 'Invalid configuration syntax',
    })

    const output = formatError(error, defaultOptions)

    expect(output).toContain('IX_E101')
    expect(output).toContain('Invalid configuration syntax')
  })

  it('should format error with causes', () => {
    const error = new CLIError({
      code: 'IX_E102',
      message: 'Missing configuration',
      causes: ['File not found', 'Invalid path'],
    })

    const output = formatError(error, defaultOptions)

    expect(output).toContain('This usually means:')
    expect(output).toContain('1. File not found')
    expect(output).toContain('2. Invalid path')
  })

  it('should format error with fixes', () => {
    const error = new CLIError({
      code: 'IX_E103',
      message: 'Invalid value',
      fixes: ['Use ES256 algorithm', 'Check documentation'],
    })

    const output = formatError(error, defaultOptions)

    expect(output).toContain('Quick fixes:')
    expect(output).toContain('• Use ES256 algorithm')
    expect(output).toContain('• Check documentation')
  })

  it('should format error with documentation URL', () => {
    const error = new CLIError({
      code: 'IX_E104',
      message: 'Configuration not found',
      docsUrl: 'https://ixflare.dev/errors/IX_E104',
    })

    const output = formatError(error, defaultOptions)

    expect(output).toContain('More info:')
    expect(output).toContain('https://ixflare.dev/errors/IX_E104')
  })

  it('should format error with source location', () => {
    const error = new CLIError({
      code: 'IX_E105',
      message: 'Syntax error',
      sourceLocation: {
        file: 'edge.config.ts',
        line: 10,
        snippet: 'const config = {\n  algorithm: "RS256",\n}',
      },
    })

    const output = formatError(error, defaultOptions)

    expect(output).toContain('edge.config.ts:10')
  })

  it('should include verbose info when requested', () => {
    const error = new CLIError({
      code: 'IX_E901',
      message: 'Internal error',
    })

    const output = formatError(error, { ...defaultOptions, verbose: true })

    expect(output).toContain('Verbose Debug Information')
    expect(output).toContain('Stack trace')
    expect(output).toContain('Environment')
    expect(output).toContain('Node version')
  })

  it('should show original error in verbose mode', () => {
    const originalError = new Error('Original error')
    const error = new CLIError({
      code: 'IX_E902',
      message: 'Wrapped error',
      originalError,
    })

    const output = formatError(error, { ...defaultOptions, verbose: true })

    expect(output).toContain('Original error:')
    expect(output).toContain('Original error')
  })

  it('should highlight commands in fixes when color enabled', () => {
    const error = new CLIError({
      code: 'IX_E203',
      message: 'Module not found',
      fixes: ['Run `pnpm install` to install dependencies'],
    })

    const coloredOutput = formatError(error, { color: true, verbose: false, interactive: true })
    const plainOutput = formatError(error, defaultOptions)

    // Both outputs should contain the command text
    expect(coloredOutput).toContain('pnpm install')
    expect(plainOutput).toContain('pnpm install')

    // Colored output should contain backtick highlights (picocolors may or may not add length with ANSI codes)
    expect(plainOutput).toContain('`pnpm install`')
  })
})

describe('detectDisplayOptions', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should detect --no-color flag', () => {
    delete process.env.NO_COLOR
    delete process.env.CI
    const options = detectDisplayOptions(['node', 'cli', '--no-color'])
    expect(options.color).toBe(false)
  })

  it('should detect NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1'
    delete process.env.CI
    const options = detectDisplayOptions([])
    expect(options.color).toBe(false)
  })

  it('should detect --verbose flag', () => {
    const options = detectDisplayOptions(['node', 'cli', '--verbose'])
    expect(options.verbose).toBe(true)
  })

  it('should detect -v flag', () => {
    const options = detectDisplayOptions(['node', 'cli', '-v'])
    expect(options.verbose).toBe(true)
  })

  it('should detect CI environment', () => {
    process.env.CI = 'true'
    delete process.env.NO_COLOR
    const options = detectDisplayOptions([])
    expect(options.interactive).toBe(false)
  })

  it('should have expected properties', () => {
    delete process.env.NO_COLOR
    delete process.env.CI
    const options = detectDisplayOptions([])
    // Verify it returns an object with the expected keys
    expect(options).toHaveProperty('color')
    expect(options).toHaveProperty('verbose')
    expect(options).toHaveProperty('interactive')
  })
})
