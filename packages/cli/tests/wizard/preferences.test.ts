/**
 * Tests for user preference storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { UserPreferences } from '../../src/wizard/preferences'
import { homedir } from 'node:os'

describe('UserPreferences', () => {
  const testConfigDir = join(homedir(), '.config-test-wizard')
  const testConfigPath = join(testConfigDir, 'ixflare', 'preferences.json')

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true })
    }
  })

  describe('load', () => {
    it('should create empty preferences when file does not exist', async () => {
      const prefs = await UserPreferences.load(testConfigDir)

      expect(prefs).toBeInstanceOf(UserPreferences)
      expect(prefs.packageManager).toBeUndefined()
      expect(prefs.lastTemplate).toBeUndefined()
    })

    it('should load existing preferences from file', async () => {
      // Create test preferences file
      const testData = {
        packageManager: 'pnpm',
        lastTemplate: 'fullstack-react',
        updatedAt: Date.now(),
      }

      mkdirSync(join(testConfigDir, 'ixflare'), { recursive: true })
      writeFileSync(testConfigPath, JSON.stringify(testData))

      const prefs = await UserPreferences.load(testConfigDir)

      expect(prefs.packageManager).toBe('pnpm')
      expect(prefs.lastTemplate).toBe('fullstack-react')
    })

    it('should handle corrupted JSON gracefully', async () => {
      // Create invalid JSON file
      mkdirSync(join(testConfigDir, 'ixflare'), { recursive: true })
      writeFileSync(testConfigPath, '{invalid json')

      const prefs = await UserPreferences.load(testConfigDir)

      expect(prefs).toBeInstanceOf(UserPreferences)
      expect(prefs.packageManager).toBeUndefined()
    })
  })

  describe('setters', () => {
    it('should set package manager preference', async () => {
      const prefs = await UserPreferences.load(testConfigDir)
      prefs.setPackageManager('bun')

      expect(prefs.packageManager).toBe('bun')
    })

    it('should set last template preference', async () => {
      const prefs = await UserPreferences.load(testConfigDir)
      prefs.setLastTemplate('minimal')

      expect(prefs.lastTemplate).toBe('minimal')
    })

    it('should chain setter calls', async () => {
      const prefs = await UserPreferences.load(testConfigDir)
      const result = prefs
        .setPackageManager('npm')
        .setLastTemplate('api-backend')

      expect(result).toBe(prefs)
      expect(prefs.packageManager).toBe('npm')
      expect(prefs.lastTemplate).toBe('api-backend')
    })
  })

  describe('persist', () => {
    it('should save preferences to disk', async () => {
      const prefs = await UserPreferences.load(testConfigDir)
      prefs
        .setPackageManager('pnpm')
        .setLastTemplate('fullstack-react')

      await prefs.persist()

      expect(existsSync(testConfigPath)).toBe(true)

      const saved = JSON.parse(readFileSync(testConfigPath, 'utf-8'))
      expect(saved.packageManager).toBe('pnpm')
      expect(saved.lastTemplate).toBe('fullstack-react')
      expect(saved.updatedAt).toBeTypeOf('number')
    })

    it('should create directory structure if missing', async () => {
      const prefs = await UserPreferences.load(testConfigDir)
      prefs.setPackageManager('npm')

      await prefs.persist()

      expect(existsSync(join(testConfigDir, 'ixflare'))).toBe(true)
      expect(existsSync(testConfigPath)).toBe(true)
    })

    it('should update existing preferences', async () => {
      // Create initial preferences
      const prefs1 = await UserPreferences.load(testConfigDir)
      prefs1.setPackageManager('npm')
      await prefs1.persist()

      // Load and update
      const prefs2 = await UserPreferences.load(testConfigDir)
      prefs2.setPackageManager('pnpm')
      await prefs2.persist()

      // Verify update
      const saved = JSON.parse(readFileSync(testConfigPath, 'utf-8'))
      expect(saved.packageManager).toBe('pnpm')
    })
  })

  describe('edge cases', () => {
    it('should handle empty preferences file', async () => {
      mkdirSync(join(testConfigDir, 'ixflare'), { recursive: true })
      writeFileSync(testConfigPath, '')

      const prefs = await UserPreferences.load(testConfigDir)

      expect(prefs.packageManager).toBeUndefined()
    })

    it('should handle very old preferences (updatedAt)', async () => {
      const oldData = {
        packageManager: 'npm',
        updatedAt: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
      }

      mkdirSync(join(testConfigDir, 'ixflare'), { recursive: true })
      writeFileSync(testConfigPath, JSON.stringify(oldData))

      const prefs = await UserPreferences.load(testConfigDir)

      expect(prefs.packageManager).toBe('npm') // Still load old preferences
    })
  })
})
