/**
 * @module cli.test
 * @description Tests for CLI argument parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseArgs } from '../src/cli'

describe('parseArgs', () => {
  const originalExit = process.exit
  const originalConsoleError = console.error

  beforeEach(() => {
    process.exit = vi.fn() as never
    console.error = vi.fn()
  })

  afterEach(() => {
    process.exit = originalExit
    console.error = originalConsoleError
  })

  describe('project name parsing', () => {
    it('should parse project name as first positional argument', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app'])
      expect(result.projectName).toBe('my-app')
    })

    it('should handle project name with hyphens', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-cool-app'])
      expect(result.projectName).toBe('my-cool-app')
    })

    it('should return undefined when no project name provided', () => {
      const result = parseArgs(['node', 'create-ixflare'])
      expect(result.projectName).toBeUndefined()
    })
  })

  describe('template flag parsing', () => {
    it('should parse --template flag', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '--template', 'api-backend'])
      expect(result.template).toBe('api-backend')
    })

    it('should parse -t shorthand flag', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '-t', 'fullstack-react'])
      expect(result.template).toBe('fullstack-react')
    })

    it('should accept minimal template', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '-t', 'minimal'])
      expect(result.template).toBe('minimal')
    })

    it('should exit with error for invalid template', () => {
      parseArgs(['node', 'create-ixflare', 'my-app', '--template', 'invalid'])
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('package manager flag parsing', () => {
    it('should parse --pm flag', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '--pm', 'pnpm'])
      expect(result.packageManager).toBe('pnpm')
    })

    it('should parse --package-manager flag', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '--package-manager', 'bun'])
      expect(result.packageManager).toBe('bun')
    })

    it('should accept npm', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '--pm', 'npm'])
      expect(result.packageManager).toBe('npm')
    })

    it('should exit with error for invalid package manager', () => {
      parseArgs(['node', 'create-ixflare', 'my-app', '--pm', 'yarn'])
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('skip prompts flag parsing', () => {
    it('should parse --yes flag', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '--yes'])
      expect(result.skipPrompts).toBe(true)
    })

    it('should parse -y shorthand flag', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app', '-y'])
      expect(result.skipPrompts).toBe(true)
    })

    it('should default skipPrompts to false', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app'])
      expect(result.skipPrompts).toBe(false)
    })
  })

  describe('help flag parsing', () => {
    it('should parse --help flag', () => {
      const result = parseArgs(['node', 'create-ixflare', '--help'])
      expect(result.showHelp).toBe(true)
    })

    it('should parse -h shorthand flag', () => {
      const result = parseArgs(['node', 'create-ixflare', '-h'])
      expect(result.showHelp).toBe(true)
    })

    it('should default showHelp to false', () => {
      const result = parseArgs(['node', 'create-ixflare', 'my-app'])
      expect(result.showHelp).toBe(false)
    })
  })

  describe('combined flags', () => {
    it('should parse all flags together', () => {
      const result = parseArgs([
        'node',
        'create-ixflare',
        'my-app',
        '-t',
        'api-backend',
        '--pm',
        'pnpm',
        '-y',
      ])
      expect(result.projectName).toBe('my-app')
      expect(result.template).toBe('api-backend')
      expect(result.packageManager).toBe('pnpm')
      expect(result.skipPrompts).toBe(true)
    })

    it('should handle flags in any order', () => {
      const result = parseArgs([
        'node',
        'create-ixflare',
        '--pm',
        'bun',
        'my-app',
        '-t',
        'minimal',
      ])
      expect(result.projectName).toBe('my-app')
      expect(result.template).toBe('minimal')
      expect(result.packageManager).toBe('bun')
    })
  })
})
