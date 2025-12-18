/**
 * Tests for display mode detection
 * Following red-green-refactor cycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectDisplayMode } from '../../src/progress/detection'

describe('detectDisplayMode', () => {
  const originalEnv = process.env
  const originalIsTTY = process.stdout.isTTY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    // @ts-expect-error - resetting isTTY
    process.stdout.isTTY = originalIsTTY
  })

  describe('TTY detection', () => {
    it('should detect TTY environment', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      const mode = detectDisplayMode([])

      expect(mode.interactive).toBe(true)
      expect(mode.spinner).toBe(true)
      expect(mode.colors).toBe(true)
    })

    it('should detect non-TTY environment', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = false
      const mode = detectDisplayMode([])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
    })
  })

  describe('CI detection', () => {
    it('should detect CI environment variable', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      process.env.CI = 'true'

      const mode = detectDisplayMode([])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
    })

    it('should detect GITHUB_ACTIONS environment', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      process.env.GITHUB_ACTIONS = 'true'

      const mode = detectDisplayMode([])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
    })
  })

  describe('quiet mode', () => {
    it('should detect --quiet flag', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true

      const mode = detectDisplayMode(['--quiet'])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
      expect(mode.verbose).toBe(false)
    })

    it('should detect -q flag', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true

      const mode = detectDisplayMode(['-q'])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
    })
  })

  describe('color detection', () => {
    it('should respect NO_COLOR environment variable', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      process.env.NO_COLOR = '1'

      const mode = detectDisplayMode([])

      expect(mode.colors).toBe(false)
    })

    it('should respect --no-color flag', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true

      const mode = detectDisplayMode(['--no-color'])

      expect(mode.colors).toBe(false)
    })

    it('should enable colors with FORCE_COLOR', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = false
      process.env.FORCE_COLOR = '1'

      const mode = detectDisplayMode([])

      expect(mode.colors).toBe(true)
    })
  })

  describe('verbose mode', () => {
    it('should detect --verbose flag', () => {
      const mode = detectDisplayMode(['--verbose'])

      expect(mode.verbose).toBe(true)
    })

    it('should detect -v flag', () => {
      const mode = detectDisplayMode(['-v'])

      expect(mode.verbose).toBe(true)
    })

    it('should default verbose to false', () => {
      const mode = detectDisplayMode([])

      expect(mode.verbose).toBe(false)
    })
  })

  describe('combined scenarios', () => {
    it('should handle TTY + CI (CI wins)', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      process.env.CI = 'true'

      const mode = detectDisplayMode([])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
    })

    it('should handle quiet + verbose (quiet wins)', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true

      const mode = detectDisplayMode(['--quiet', '--verbose'])

      expect(mode.interactive).toBe(false)
      expect(mode.spinner).toBe(false)
      expect(mode.verbose).toBe(true) // verbose still detected
    })

    it('should handle NO_COLOR + FORCE_COLOR (NO_COLOR wins)', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      process.env.NO_COLOR = '1'
      process.env.FORCE_COLOR = '1'

      const mode = detectDisplayMode([])

      expect(mode.colors).toBe(false)
    })

    it('should handle all interactive conditions enabled', () => {
      // @ts-expect-error - mocking isTTY
      process.stdout.isTTY = true
      delete process.env.CI
      delete process.env.GITHUB_ACTIONS
      delete process.env.NO_COLOR

      const mode = detectDisplayMode([])

      expect(mode.interactive).toBe(true)
      expect(mode.spinner).toBe(true)
      expect(mode.colors).toBe(true)
      expect(mode.verbose).toBe(false)
    })
  })
})
