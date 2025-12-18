/**
 * User preference storage for wizard configuration
 * Stores non-sensitive user preferences in XDG-compliant location
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import type { PreferencesData } from './types'

/**
 * User preferences manager
 * Handles loading and saving user preferences to disk
 */
export class UserPreferences {
  private static readonly CONFIG_DIR_NAME = 'ixflare'
  private static readonly FILENAME = 'preferences.json'

  private data: PreferencesData

  private constructor(
    private readonly configHome: string,
    data?: PreferencesData
  ) {
    this.data = data ?? {
      updatedAt: Date.now(),
    }
  }

  /**
   * Get config directory path
   * Uses XDG_CONFIG_HOME if set, otherwise ~/.config
   */
  private static getConfigDir(testDir?: string): string {
    if (testDir) {
      return testDir
    }
    return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  }

  /**
   * Get full path to preferences file
   */
  private getPreferencesPath(): string {
    return join(this.configHome, UserPreferences.CONFIG_DIR_NAME, UserPreferences.FILENAME)
  }

  /**
   * Load preferences from disk
   * Creates empty preferences if file doesn't exist
   *
   * @param testConfigDir - Optional test directory (for testing only)
   * @returns UserPreferences instance
   */
  static async load(testConfigDir?: string): Promise<UserPreferences> {
    const configHome = this.getConfigDir(testConfigDir)
    const prefsPath = join(configHome, this.CONFIG_DIR_NAME, this.FILENAME)

    if (!existsSync(prefsPath)) {
      return new UserPreferences(configHome)
    }

    try {
      const content = readFileSync(prefsPath, 'utf-8')
      if (!content.trim()) {
        return new UserPreferences(configHome)
      }

      const data = JSON.parse(content) as PreferencesData
      return new UserPreferences(configHome, data)
    } catch {
      // If file is corrupted or invalid JSON, return empty preferences
      return new UserPreferences(configHome)
    }
  }

  /**
   * Get preferred package manager
   */
  get packageManager(): 'npm' | 'pnpm' | 'bun' | undefined {
    return this.data.packageManager
  }

  /**
   * Get last used template
   */
  get lastTemplate(): string | undefined {
    return this.data.lastTemplate
  }

  /**
   * Get Cloudflare account ID (non-sensitive metadata)
   */
  get cloudflareAccountId(): string | undefined {
    return this.data.cloudflareAccountId
  }

  /**
   * Get update check preference (default: true)
   */
  get updateCheck(): boolean {
    return this.data.updateCheck ?? true
  }

  /**
   * Get last update check timestamp
   */
  get lastUpdateCheck(): number | undefined {
    return this.data.lastUpdateCheck
  }

  /**
   * Get cached latest version
   */
  get cachedLatestVersion(): string | undefined {
    return this.data.cachedLatestVersion
  }

  /**
   * Set package manager preference
   */
  setPackageManager(pm: 'npm' | 'pnpm' | 'bun'): this {
    this.data.packageManager = pm
    return this
  }

  /**
   * Set last used template
   */
  setLastTemplate(template: string): this {
    this.data.lastTemplate = template
    return this
  }

  /**
   * Set Cloudflare account ID
   */
  setCloudflareAccountId(accountId: string): this {
    this.data.cloudflareAccountId = accountId
    return this
  }

  /**
   * Set update check preference
   */
  setUpdateCheck(enabled: boolean): this {
    this.data.updateCheck = enabled
    return this
  }

  /**
   * Cache version check result
   * Updates both the cached version and last check timestamp
   */
  cacheVersionCheck(version: string): this {
    this.data.cachedLatestVersion = version
    this.data.lastUpdateCheck = Date.now()
    return this
  }

  /**
   * Save preferences to disk
   * Creates directory structure if it doesn't exist
   */
  async persist(): Promise<void> {
    const dir = join(this.configHome, UserPreferences.CONFIG_DIR_NAME)
    const filePath = this.getPreferencesPath()

    // Create directory if it doesn't exist
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Update timestamp
    this.data.updatedAt = Date.now()

    // Write to disk
    writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}
