/**
 * Tests for UserPreferences update checking extensions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UserPreferences } from '../../src/wizard/preferences'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('UserPreferences - Update Check Extensions', () => {
  let testDir: string

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `ixflare-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('updateCheck property', () => {
    it('should default to true when not set', async () => {
      const prefs = await UserPreferences.load(testDir)

      expect(prefs.updateCheck).toBe(true)
    })

    it('should return false when explicitly disabled', async () => {
      const prefs = await UserPreferences.load(testDir)
      prefs.setUpdateCheck(false)
      await prefs.persist()

      // Load again to verify persistence
      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.updateCheck).toBe(false)
    })

    it('should return true when explicitly enabled', async () => {
      const prefs = await UserPreferences.load(testDir)
      prefs.setUpdateCheck(true)
      await prefs.persist()

      // Load again to verify persistence
      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.updateCheck).toBe(true)
    })
  })

  describe('lastUpdateCheck property', () => {
    it('should be undefined by default', async () => {
      const prefs = await UserPreferences.load(testDir)

      expect(prefs.lastUpdateCheck).toBeUndefined()
    })

    it('should be set when cacheVersionCheck is called', async () => {
      const prefs = await UserPreferences.load(testDir)
      const beforeTime = Date.now()

      prefs.cacheVersionCheck('1.2.3')

      const afterTime = Date.now()
      const lastCheck = prefs.lastUpdateCheck

      expect(lastCheck).toBeDefined()
      expect(lastCheck).toBeGreaterThanOrEqual(beforeTime)
      expect(lastCheck).toBeLessThanOrEqual(afterTime)
    })

    it('should persist lastUpdateCheck timestamp', async () => {
      const prefs = await UserPreferences.load(testDir)
      prefs.cacheVersionCheck('1.2.3')
      await prefs.persist()

      // Load again to verify persistence
      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.lastUpdateCheck).toBeDefined()
      expect(reloaded.lastUpdateCheck).toBeTypeOf('number')
    })
  })

  describe('cachedLatestVersion property', () => {
    it('should be undefined by default', async () => {
      const prefs = await UserPreferences.load(testDir)

      expect(prefs.cachedLatestVersion).toBeUndefined()
    })

    it('should be set when cacheVersionCheck is called', async () => {
      const prefs = await UserPreferences.load(testDir)

      prefs.cacheVersionCheck('1.2.3')

      expect(prefs.cachedLatestVersion).toBe('1.2.3')
    })

    it('should persist cachedLatestVersion', async () => {
      const prefs = await UserPreferences.load(testDir)
      prefs.cacheVersionCheck('1.2.3')
      await prefs.persist()

      // Load again to verify persistence
      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.cachedLatestVersion).toBe('1.2.3')
    })

    it('should update cached version on subsequent calls', async () => {
      const prefs = await UserPreferences.load(testDir)

      prefs.cacheVersionCheck('1.2.3')
      expect(prefs.cachedLatestVersion).toBe('1.2.3')

      prefs.cacheVersionCheck('1.2.4')
      expect(prefs.cachedLatestVersion).toBe('1.2.4')
    })
  })

  describe('setUpdateCheck method', () => {
    it('should return this for method chaining', async () => {
      const prefs = await UserPreferences.load(testDir)

      const result = prefs.setUpdateCheck(false)

      expect(result).toBe(prefs)
    })

    it('should allow chaining with persist', async () => {
      const prefs = await UserPreferences.load(testDir)

      await prefs.setUpdateCheck(false).persist()

      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.updateCheck).toBe(false)
    })
  })

  describe('cacheVersionCheck method', () => {
    it('should return this for method chaining', async () => {
      const prefs = await UserPreferences.load(testDir)

      const result = prefs.cacheVersionCheck('1.2.3')

      expect(result).toBe(prefs)
    })

    it('should allow chaining with persist', async () => {
      const prefs = await UserPreferences.load(testDir)

      await prefs.cacheVersionCheck('1.2.3').persist()

      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.cachedLatestVersion).toBe('1.2.3')
    })

    it('should update both version and timestamp', async () => {
      const prefs = await UserPreferences.load(testDir)
      const beforeTime = Date.now()

      prefs.cacheVersionCheck('1.2.3')

      expect(prefs.cachedLatestVersion).toBe('1.2.3')
      expect(prefs.lastUpdateCheck).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('integration with existing preferences', () => {
    it('should work alongside packageManager preference', async () => {
      const prefs = await UserPreferences.load(testDir)

      prefs.setPackageManager('pnpm').setUpdateCheck(false).cacheVersionCheck('1.2.3')

      await prefs.persist()

      const reloaded = await UserPreferences.load(testDir)
      expect(reloaded.packageManager).toBe('pnpm')
      expect(reloaded.updateCheck).toBe(false)
      expect(reloaded.cachedLatestVersion).toBe('1.2.3')
    })

    it('should preserve existing preferences when adding update check fields', async () => {
      const prefs = await UserPreferences.load(testDir)
      prefs.setPackageManager('npm')
      prefs.setLastTemplate('minimal')
      await prefs.persist()

      // Load and add update check fields
      const reloaded = await UserPreferences.load(testDir)
      reloaded.setUpdateCheck(false)
      await reloaded.persist()

      // Verify all fields preserved
      const final = await UserPreferences.load(testDir)
      expect(final.packageManager).toBe('npm')
      expect(final.lastTemplate).toBe('minimal')
      expect(final.updateCheck).toBe(false)
    })
  })
})
