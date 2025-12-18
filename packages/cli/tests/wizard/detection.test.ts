/**
 * Tests for TTY/CI detection utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectInteractiveMode } from '../../src/wizard/detection'

describe('detectInteractiveMode', () => {
  const originalEnv = process.env
  const originalStdoutTTY = process.stdout.isTTY
  const originalStdinTTY = process.stdin.isTTY

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
    // @ts-expect-error - resetting isTTY
    process.stdout.isTTY = originalStdoutTTY
    // @ts-expect-error - resetting isTTY
    process.stdin.isTTY = originalStdinTTY
  })

  it('should detect interactive mode when TTY is available and not in CI', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI

    const result = detectInteractiveMode([])

    expect(result.isInteractive).toBe(true)
    expect(result.isTTY).toBe(true)
    expect(result.isCI).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  it('should detect non-interactive mode when --yes flag is provided', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true

    const result = detectInteractiveMode(['--yes'])

    expect(result.isInteractive).toBe(false)
    expect(result.isTTY).toBe(true)
    expect(result.isCI).toBe(false)
    expect(result.reason).toBe('--yes flag')
  })

  it('should detect non-interactive mode when -y flag is provided', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true

    const result = detectInteractiveMode(['-y'])

    expect(result.isInteractive).toBe(false)
    expect(result.reason).toBe('--yes flag')
  })

  it('should detect CI environment via CI env var', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = false
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = false
    process.env.CI = 'true'

    const result = detectInteractiveMode([])

    expect(result.isInteractive).toBe(false)
    expect(result.isTTY).toBe(false)
    expect(result.isCI).toBe(true)
    expect(result.reason).toBe('CI environment')
  })

  it('should detect CI environment via GITHUB_ACTIONS env var', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = false
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = false
    process.env.GITHUB_ACTIONS = 'true'

    const result = detectInteractiveMode([])

    expect(result.isInteractive).toBe(false)
    expect(result.isCI).toBe(true)
    expect(result.reason).toBe('CI environment')
  })

  it('should detect CI environment via GITLAB_CI env var', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = false
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = false
    process.env.GITLAB_CI = 'true'

    const result = detectInteractiveMode([])

    expect(result.isInteractive).toBe(false)
    expect(result.isCI).toBe(true)
    expect(result.reason).toBe('CI environment')
  })

  it('should detect non-interactive when stdout is not TTY', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = false
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true
    delete process.env.CI

    const result = detectInteractiveMode([])

    expect(result.isInteractive).toBe(false)
    expect(result.isTTY).toBe(false)
    expect(result.isCI).toBe(false)
    expect(result.reason).toBe('No TTY')
  })

  it('should detect non-interactive when stdin is not TTY', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = false
    delete process.env.CI

    const result = detectInteractiveMode([])

    expect(result.isInteractive).toBe(false)
    expect(result.isTTY).toBe(false)
    expect(result.isCI).toBe(false)
    expect(result.reason).toBe('No TTY')
  })

  it('should prioritize --yes flag over TTY detection', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = true
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = true
    delete process.env.CI

    const result = detectInteractiveMode(['--other', '--yes', '--flags'])

    expect(result.isInteractive).toBe(false)
    expect(result.reason).toBe('--yes flag')
  })

  it('should prioritize --yes over CI environment', () => {
    // @ts-expect-error - mocking isTTY
    process.stdout.isTTY = false
    // @ts-expect-error - mocking isTTY
    process.stdin.isTTY = false
    process.env.CI = 'true'

    const result = detectInteractiveMode(['--yes'])

    expect(result.isInteractive).toBe(false)
    expect(result.isCI).toBe(false) // CI check happens after --yes check
    expect(result.reason).toBe('--yes flag')
  })
})
