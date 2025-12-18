/**
 * Tests for ix init command
 * Tests argument parsing, validation, and wizard flow integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prompts before importing the module
vi.mock('prompts', () => ({
  default: vi.fn(),
}))

// Mock UserPreferences to avoid file system access
vi.mock('../../src/wizard/preferences', () => ({
  UserPreferences: {
    load: vi.fn().mockResolvedValue({
      packageManager: undefined,
      lastTemplate: undefined,
      setPackageManager: vi.fn().mockReturnThis(),
      setLastTemplate: vi.fn().mockReturnThis(),
      persist: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

describe('init command', () => {
  const originalEnv = process.env
  const originalArgv = process.argv
  const originalStdoutTTY = process.stdout.isTTY
  const originalStdinTTY = process.stdin.isTTY
  const originalExit = process.exit

  beforeEach(() => {
    // Reset module cache to ensure fresh imports
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true
    // Mock process.exit to prevent test runner from exiting
    process.exit = vi.fn() as never
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
    // @ts-expect-error - resetting isTTY
    process.stdout.isTTY = originalStdoutTTY
    // @ts-expect-error - resetting isTTY
    process.stdin.isTTY = originalStdinTTY
    process.exit = originalExit
  })

  describe('argument parsing', () => {
    it('should parse positional project name', async () => {
      process.argv = ['node', 'ix', 'init', 'my-project', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      // Should not exit with error
      expect(process.exit).not.toHaveBeenCalledWith(1)
      // Should show project name in output
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('my-project'))

      consoleSpy.mockRestore()
    })

    it('should parse --name flag', async () => {
      process.argv = ['node', 'ix', 'init', '--name', 'named-project', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).not.toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('named-project'))

      consoleSpy.mockRestore()
    })

    it('should prefer --name flag over positional arg', async () => {
      process.argv = ['node', 'ix', 'init', 'positional', '--name', 'flag-value', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('flag-value'))

      consoleSpy.mockRestore()
    })

    it('should parse --template flag', async () => {
      process.argv = ['node', 'ix', 'init', 'test-app', '--template', 'fullstack-react', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fullstack-react'))

      consoleSpy.mockRestore()
    })

    it('should parse -t shorthand for template', async () => {
      process.argv = ['node', 'ix', 'init', 'test-app', '-t', 'api-backend', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('api-backend'))

      consoleSpy.mockRestore()
    })

    it('should parse --pm flag', async () => {
      process.argv = ['node', 'ix', 'init', 'test-app', '--pm', 'bun', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bun'))

      consoleSpy.mockRestore()
    })

    it('should parse --package-manager flag', async () => {
      process.argv = ['node', 'ix', 'init', 'test-app', '--package-manager', 'npm', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('npm'))

      consoleSpy.mockRestore()
    })
  })

  describe('validation', () => {
    it('should reject invalid template value', async () => {
      process.argv = ['node', 'ix', 'init', 'test-app', '--template', 'invalid-template', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid template'))

      consoleSpy.mockRestore()
    })

    it('should reject invalid package manager value', async () => {
      process.argv = ['node', 'ix', 'init', 'test-app', '--pm', 'yarn', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid package manager'))

      consoleSpy.mockRestore()
    })

    it('should reject invalid project name with uppercase', async () => {
      process.argv = ['node', 'ix', 'init', 'MyProject', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('lowercase'))

      consoleSpy.mockRestore()
    })

    it('should reject project name starting with hyphen', async () => {
      // Use --name flag to pass the hyphen-prefixed name since positional args
      // starting with - are interpreted as flags
      process.argv = ['node', 'ix', 'init', '--name', '-bad-name', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('hyphen'))

      consoleSpy.mockRestore()
    })

    it('should reject project name ending with hyphen', async () => {
      process.argv = ['node', 'ix', 'init', 'bad-name-', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('hyphen'))

      consoleSpy.mockRestore()
    })

    it('should reject project name too short', async () => {
      process.argv = ['node', 'ix', 'init', 'a', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2 characters'))

      consoleSpy.mockRestore()
    })
  })

  describe('non-interactive mode', () => {
    it('should require project name in non-interactive mode', async () => {
      process.argv = ['node', 'ix', 'init', '--yes']

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('required'))

      consoleSpy.mockRestore()
    })

    it('should use default template when not specified', async () => {
      process.argv = ['node', 'ix', 'init', 'my-app', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      // Default template is 'minimal'
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('minimal'))

      consoleSpy.mockRestore()
    })

    it('should use default package manager when not specified', async () => {
      process.argv = ['node', 'ix', 'init', 'my-app', '--yes']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      // Default PM is 'pnpm'
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('pnpm'))

      consoleSpy.mockRestore()
    })

    it('should work with all flags in non-interactive mode', async () => {
      process.argv = [
        'node', 'ix', 'init',
        '--name', 'full-test',
        '--template', 'api-backend',
        '--pm', 'npm',
        '--yes'
      ]

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(process.exit).not.toHaveBeenCalledWith(1)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('full-test'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('api-backend'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('npm'))

      consoleSpy.mockRestore()
    })
  })

  describe('help display', () => {
    it('should display help with --help flag', async () => {
      process.argv = ['node', 'ix', 'init', '--help']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Options:'))

      consoleSpy.mockRestore()
    })

    it('should display help with -h flag', async () => {
      process.argv = ['node', 'ix', 'init', '-h']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'))

      consoleSpy.mockRestore()
    })
  })

  describe('CI environment detection', () => {
    it('should run non-interactively in CI environment', async () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = false
      // @ts-expect-error - mocking isTTY
      process.stdin.isTTY = false
      process.env.CI = 'true'
      process.argv = ['node', 'ix', 'init', 'ci-project']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { init } = await import('../../src/commands/init')
      await init()

      // Should use defaults since no prompts
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ci-project'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('minimal'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('pnpm'))

      consoleSpy.mockRestore()
    })
  })
})
