/**
 * Tests for update notification formatter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatUpdateNotification,
  displayUpdateNotification,
} from '../../src/update-checker/formatter'
import type { UpdateCheckResult } from '../../src/update-checker/types'

describe('formatUpdateNotification', () => {
  it('should format minor/patch update notification', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
    }

    const formatted = formatUpdateNotification(result, 'pnpm')

    // Check for key content
    expect(formatted).toContain('Update available')
    expect(formatted).toContain('1.0.0')
    expect(formatted).toContain('1.1.0')
    expect(formatted).toContain('pnpm update ixflare')
    expect(formatted).toContain('Changelog: https://ixflare.dev/releases/1.1.0')

    // Check for box characters
    expect(formatted).toContain('╭')
    expect(formatted).toContain('╮')
    expect(formatted).toContain('╰')
    expect(formatted).toContain('╯')
    expect(formatted).toContain('│')
  })

  it('should format major update notification with warning', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateType: 'major',
      changelogUrl: 'https://ixflare.dev/releases/2.0.0',
      migrationUrl: 'https://ixflare.dev/migrate/v2',
    }

    const formatted = formatUpdateNotification(result, 'npm')

    // Check for major update specific content
    expect(formatted).toContain('⚠️')
    expect(formatted).toContain('Major update available')
    expect(formatted).toContain('breaking changes')
    expect(formatted).toContain('Migration guide')
    expect(formatted).toContain('https://ixflare.dev/migrate/v2')
    expect(formatted).toContain('npm update ixflare@2')
  })

  it('should use correct package manager command for npm', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
    }

    const formatted = formatUpdateNotification(result, 'npm')

    expect(formatted).toContain('npm update ixflare')
  })

  it('should use correct package manager command for bun', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
    }

    const formatted = formatUpdateNotification(result, 'bun')

    expect(formatted).toContain('bun update ixflare')
  })

  it('should format patch update notification', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.0.1',
      updateType: 'patch',
      changelogUrl: 'https://ixflare.dev/releases/1.0.1',
    }

    const formatted = formatUpdateNotification(result, 'pnpm')

    expect(formatted).toContain('Update available')
    expect(formatted).toContain('1.0.1')
    expect(formatted).not.toContain('Major')
    expect(formatted).not.toContain('breaking changes')
  })

  it('should include empty lines for box padding', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
    }

    const formatted = formatUpdateNotification(result, 'pnpm')
    const lines = formatted.split('\n')

    // Should start and end with empty lines
    expect(lines[0]).toBe('')
    expect(lines[lines.length - 1]).toBe('')
  })
})

describe('displayUpdateNotification', () => {
  const originalLog = console.log

  beforeEach(() => {
    console.log = vi.fn()
  })

  afterEach(() => {
    console.log = originalLog
  })

  it('should call console.log with formatted notification', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
    }

    displayUpdateNotification(result, 'pnpm')

    expect(console.log).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Update available'))
  })

  it('should default to pnpm when no package manager specified', () => {
    const result: UpdateCheckResult = {
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
    }

    displayUpdateNotification(result)

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('pnpm update ixflare'))
  })
})
