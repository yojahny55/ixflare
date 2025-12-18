/**
 * Tests for update checker core logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  shouldCheckForUpdate,
  getUpdateInfo,
  checkForUpdate,
} from '../../src/update-checker/checker'
import type { UserPreferencesInterface, InteractiveMode } from '../../src/wizard/types'

describe('shouldCheckForUpdate', () => {
  let mockPreferences: UserPreferencesInterface
  let mockMode: InteractiveMode

  beforeEach(() => {
    mockPreferences = {
      packageManager: 'pnpm',
      lastTemplate: undefined,
      cloudflareAccountId: undefined,
      updateCheck: true,
      lastUpdateCheck: undefined,
      cachedLatestVersion: undefined,
      setPackageManager: vi.fn().mockReturnThis(),
      setLastTemplate: vi.fn().mockReturnThis(),
      setCloudflareAccountId: vi.fn().mockReturnThis(),
      setUpdateCheck: vi.fn().mockReturnThis(),
      cacheVersionCheck: vi.fn().mockReturnThis(),
      persist: vi.fn(),
    }

    mockMode = {
      isInteractive: true,
      isTTY: true,
      isCI: false,
    }

    delete process.env.NO_UPDATE_CHECK
  })

  it('should return true when all conditions are met', () => {
    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(true)
  })

  it('should return false when updateCheck is disabled in preferences', () => {
    mockPreferences.updateCheck = false

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(false)
  })

  it('should return false when NO_UPDATE_CHECK=1 is set', () => {
    process.env.NO_UPDATE_CHECK = '1'

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(false)
  })

  it('should return false when NO_UPDATE_CHECK=true is set', () => {
    process.env.NO_UPDATE_CHECK = 'true'

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(false)
  })

  it('should return false in CI environment', () => {
    mockMode.isCI = true

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(false)
  })

  it('should return false when not TTY', () => {
    mockMode.isTTY = false

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(false)
  })

  it('should return false when last check was within 24 hours', () => {
    // Set last check to 1 hour ago
    mockPreferences.lastUpdateCheck = Date.now() - 60 * 60 * 1000

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(false)
  })

  it('should return true when last check was more than 24 hours ago', () => {
    // Set last check to 25 hours ago
    mockPreferences.lastUpdateCheck = Date.now() - 25 * 60 * 60 * 1000

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(true)
  })

  it('should return true when lastUpdateCheck is undefined', () => {
    mockPreferences.lastUpdateCheck = undefined

    const result = shouldCheckForUpdate(mockPreferences, mockMode)
    expect(result).toBe(true)
  })
})

describe('getUpdateInfo', () => {
  it('should return update info for minor version update', () => {
    const result = getUpdateInfo('1.0.0', '1.1.0')

    expect(result).toEqual({
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateType: 'minor',
      changelogUrl: 'https://ixflare.dev/releases/1.1.0',
      migrationUrl: undefined,
    })
  })

  it('should return update info for patch version update', () => {
    const result = getUpdateInfo('1.0.0', '1.0.1')

    expect(result).toEqual({
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '1.0.1',
      updateType: 'patch',
      changelogUrl: 'https://ixflare.dev/releases/1.0.1',
      migrationUrl: undefined,
    })
  })

  it('should return update info with migration URL for major version update', () => {
    const result = getUpdateInfo('1.0.0', '2.0.0')

    expect(result).toEqual({
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateType: 'major',
      changelogUrl: 'https://ixflare.dev/releases/2.0.0',
      migrationUrl: 'https://ixflare.dev/migrate/v2',
    })
  })

  it('should return null when versions are equal', () => {
    const result = getUpdateInfo('1.0.0', '1.0.0')

    expect(result).toBeNull()
  })

  it('should return null when current version is greater', () => {
    const result = getUpdateInfo('2.0.0', '1.0.0')

    expect(result).toBeNull()
  })

  it('should handle prerelease versions', () => {
    const result = getUpdateInfo('1.0.0', '1.1.0-beta.1')

    expect(result).not.toBeNull()
    // semver.diff returns 'preminor' for prerelease versions
    expect(result?.updateType).toBe('preminor')
  })
})

describe('checkForUpdate', () => {
  let mockPreferences: UserPreferencesInterface
  let mockMode: InteractiveMode

  beforeEach(() => {
    mockPreferences = {
      packageManager: 'pnpm',
      lastTemplate: undefined,
      cloudflareAccountId: undefined,
      updateCheck: true,
      lastUpdateCheck: undefined,
      cachedLatestVersion: undefined,
      setPackageManager: vi.fn().mockReturnThis(),
      setLastTemplate: vi.fn().mockReturnThis(),
      setCloudflareAccountId: vi.fn().mockReturnThis(),
      setUpdateCheck: vi.fn().mockReturnThis(),
      cacheVersionCheck: vi.fn().mockReturnThis(),
      persist: vi.fn(),
    }

    mockMode = {
      isInteractive: true,
      isTTY: true,
      isCI: false,
    }

    delete process.env.NO_UPDATE_CHECK
  })

  it('should return null when check is skipped due to CI', async () => {
    mockMode.isCI = true

    const result = await checkForUpdate('ixflare', '1.0.0', mockPreferences, mockMode)

    expect(result).toBeNull()
    expect(mockPreferences.persist).not.toHaveBeenCalled()
  })

  it('should return cached update info when check is skipped but cache exists', async () => {
    mockPreferences.lastUpdateCheck = Date.now() - 60 * 60 * 1000 // 1 hour ago
    mockPreferences.cachedLatestVersion = '1.1.0'

    const result = await checkForUpdate('ixflare', '1.0.0', mockPreferences, mockMode)

    expect(result).not.toBeNull()
    expect(result?.latestVersion).toBe('1.1.0')
    expect(result?.hasUpdate).toBe(true)
  })

  it('should return null when check is skipped and no cache exists', async () => {
    mockMode.isCI = true
    mockPreferences.cachedLatestVersion = undefined

    const result = await checkForUpdate('ixflare', '1.0.0', mockPreferences, mockMode)

    expect(result).toBeNull()
  })
})
