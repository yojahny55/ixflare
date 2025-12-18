/**
 * Tests for WizardContext state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WizardContext } from '../../src/wizard/context'
import { WizardCancelledError } from '../../src/wizard/types'
import prompts from 'prompts'

// Mock prompts
vi.mock('prompts', () => ({
  default: vi.fn(),
}))

describe('WizardContext', () => {
  const originalEnv = process.env
  const originalStdoutTTY = process.stdout.isTTY
  const originalStdinTTY = process.stdin.isTTY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true
  })

  afterEach(() => {
    process.env = originalEnv
    // @ts-expect-error - resetting isTTY
    process.stdout.isTTY = originalStdoutTTY
    // @ts-expect-error - resetting isTTY
    process.stdin.isTTY = originalStdinTTY
  })

  describe('initialization', () => {
    it('should initialize in interactive mode when TTY available', async () => {
      const ctx = await WizardContext.create([])

      expect(ctx.isInteractive).toBe(true)
      expect(ctx.isTTY).toBe(true)
      expect(ctx.isCI).toBe(false)
    })

    it('should initialize in non-interactive mode with --yes flag', async () => {
      const ctx = await WizardContext.create(['--yes'])

      expect(ctx.isInteractive).toBe(false)
    })

    it('should initialize in non-interactive mode in CI', async () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = false
      // @ts-expect-error - mocking isTTY
      process.stdin.isTTY = false
      process.env.CI = 'true'

      const ctx = await WizardContext.create([])

      expect(ctx.isInteractive).toBe(false)
      expect(ctx.isCI).toBe(true)
    })

    it('should load user preferences on initialization', async () => {
      const ctx = await WizardContext.create([])

      expect(ctx.preferences).toBeDefined()
    })
  })

  describe('prompt', () => {
    it('should show prompt in interactive mode', async () => {
      const mockResponse = { value: 'test-value' }
      vi.mocked(prompts).mockResolvedValue(mockResponse)

      const ctx = await WizardContext.create([])
      const result = await ctx.prompt({
        type: 'text',
        name: 'value',
        message: 'Enter value:',
      })

      expect(result).toBe('test-value')
      expect(prompts).toHaveBeenCalled()
    })

    it('should return null in non-interactive mode', async () => {
      const ctx = await WizardContext.create(['--yes'])
      const result = await ctx.prompt({
        type: 'text',
        name: 'value',
        message: 'Enter value:',
      })

      expect(result).toBeNull()
      expect(prompts).not.toHaveBeenCalled()
    })

    it('should throw WizardCancelledError on cancellation', async () => {
      // Simulate user cancellation
      vi.mocked(prompts).mockResolvedValue({})

      const ctx = await WizardContext.create([])

      await expect(
        ctx.prompt({
          type: 'text',
          name: 'value',
          message: 'Enter value:',
        })
      ).rejects.toThrow(WizardCancelledError)
    })
  })

  describe('confirm', () => {
    it('should show confirmation in interactive mode', async () => {
      vi.mocked(prompts).mockResolvedValue({ confirmed: true })

      const ctx = await WizardContext.create([])
      const result = await ctx.confirm('Continue?')

      expect(result).toBe(true)
    })

    it('should use default in non-interactive mode', async () => {
      const ctx = await WizardContext.create(['--yes'])
      const result = await ctx.confirm('Continue?', true)

      expect(result).toBe(true)
    })

    it('should return false as default in non-interactive mode', async () => {
      const ctx = await WizardContext.create(['--yes'])
      const result = await ctx.confirm('Continue?')

      expect(result).toBe(false)
    })
  })

  describe('select', () => {
    it('should show selection in interactive mode', async () => {
      vi.mocked(prompts).mockResolvedValue({ selected: 'option2' })

      const ctx = await WizardContext.create([])
      const result = await ctx.select('Choose option:', [
        { title: 'Option 1', value: 'option1' },
        { title: 'Option 2', value: 'option2' },
      ])

      expect(result).toBe('option2')
    })

    it('should return null in non-interactive mode', async () => {
      const ctx = await WizardContext.create(['--yes'])
      const result = await ctx.select('Choose option:', [
        { title: 'Option 1', value: 'option1' },
      ])

      expect(result).toBeNull()
    })

    it('should use default initial value', async () => {
      vi.mocked(prompts).mockResolvedValue({ selected: 'default-value' })

      const ctx = await WizardContext.create([])
      await ctx.select(
        'Choose:',
        [
          { title: 'Option 1', value: 'opt1' },
          { title: 'Default', value: 'default-value' },
        ],
        { initial: 'default-value' }
      )

      const call = vi.mocked(prompts).mock.calls[0][0]
      expect(call).toMatchObject({
        type: 'select',
        name: 'selected',
      })
    })
  })

  describe('text', () => {
    it('should prompt for text input in interactive mode', async () => {
      vi.mocked(prompts).mockResolvedValue({ input: 'user-input' })

      const ctx = await WizardContext.create([])
      const result = await ctx.text('Enter name:')

      expect(result).toBe('user-input')
    })

    it('should return null in non-interactive mode', async () => {
      const ctx = await WizardContext.create(['--yes'])
      const result = await ctx.text('Enter name:')

      expect(result).toBeNull()
    })

    it('should support validation', async () => {
      vi.mocked(prompts).mockResolvedValue({ input: 'valid-input' })

      const ctx = await WizardContext.create([])
      const result = await ctx.text('Enter:', {
        validate: (val) => val.length > 3 || 'Too short',
      })

      expect(result).toBe('valid-input')
      const call = vi.mocked(prompts).mock.calls[0][0]
      expect(call).toHaveProperty('validate')
    })
  })

  describe('password', () => {
    it('should prompt for masked password input', async () => {
      vi.mocked(prompts).mockResolvedValue({ password: 'secret123' })

      const ctx = await WizardContext.create([])
      const result = await ctx.password('Enter password:')

      expect(result).toBe('secret123')
      const call = vi.mocked(prompts).mock.calls[0][0]
      expect(call).toMatchObject({
        type: 'password',
      })
    })

    it('should return null in non-interactive mode', async () => {
      const ctx = await WizardContext.create(['--yes'])
      const result = await ctx.password('Enter password:')

      expect(result).toBeNull()
    })
  })

  describe('savePreference', () => {
    it('should save preference to storage', async () => {
      const ctx = await WizardContext.create([])
      await ctx.savePreference('packageManager', 'pnpm')

      expect(ctx.preferences?.packageManager).toBe('pnpm')
    })

    it('should persist multiple preferences', async () => {
      const ctx = await WizardContext.create([])
      await ctx.savePreference('packageManager', 'bun')
      await ctx.savePreference('lastTemplate', 'minimal')

      expect(ctx.preferences?.packageManager).toBe('bun')
      expect(ctx.preferences?.lastTemplate).toBe('minimal')
    })
  })
})
