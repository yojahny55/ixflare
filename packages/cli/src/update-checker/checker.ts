/**
 * Core update checking logic
 * Orchestrates version checking with rate limiting and caching
 */

import { gt, diff, major } from 'semver'
import type { UpdateCheckResult } from './types'
import type { UserPreferencesInterface, InteractiveMode } from '@/wizard/types'
import { fetchLatestVersion } from './fetcher'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Determine if update check should run
 * Checks user preferences, environment variables, CI detection, and rate limiting
 *
 * @param preferences - User preferences
 * @param mode - Interactive mode detection result
 * @returns True if check should run
 */
export function shouldCheckForUpdate(
  preferences: UserPreferencesInterface,
  mode: InteractiveMode
): boolean {
  // User disabled via config
  if (!preferences.updateCheck) {
    return false
  }

  // Environment variable override
  if (process.env.NO_UPDATE_CHECK === '1' || process.env.NO_UPDATE_CHECK === 'true') {
    return false
  }

  // CI or non-TTY environment
  if (mode.isCI || !mode.isTTY) {
    return false
  }

  // Rate limiting (24 hours)
  const lastCheck = preferences.lastUpdateCheck
  if (lastCheck && Date.now() - lastCheck < CHECK_INTERVAL_MS) {
    return false
  }

  return true
}

/**
 * Get update information by comparing versions
 * Uses semver to determine if update is available and what type
 *
 * @param current - Current installed version
 * @param latest - Latest available version
 * @returns Update check result or null if no update
 */
export function getUpdateInfo(current: string, latest: string): UpdateCheckResult | null {
  // Check if latest is greater than current
  if (!gt(latest, current)) {
    return null
  }

  // Determine update type
  const updateType = diff(current, latest) as 'major' | 'minor' | 'patch' | 'prerelease' | null

  return {
    hasUpdate: true,
    currentVersion: current,
    latestVersion: latest,
    updateType,
    changelogUrl: `https://ixflare.dev/releases/${latest}`,
    migrationUrl:
      updateType === 'major' ? `https://ixflare.dev/migrate/v${major(latest)}` : undefined,
  }
}

/**
 * Check for framework updates
 * Main orchestration function that handles fetching, caching, and rate limiting
 *
 * @param packageName - Package to check for updates
 * @param currentVersion - Current installed version
 * @param preferences - User preferences for caching
 * @param mode - Interactive mode detection
 * @returns Update check result or null if no update or check skipped
 */
export async function checkForUpdate(
  packageName: string,
  currentVersion: string,
  preferences: UserPreferencesInterface,
  mode: InteractiveMode
): Promise<UpdateCheckResult | null> {
  // Check if we should skip the check
  if (!shouldCheckForUpdate(preferences, mode)) {
    // If we have a cached version, check it without fetching
    const cached = preferences.cachedLatestVersion
    if (cached) {
      return getUpdateInfo(currentVersion, cached)
    }
    return null
  }

  // Fetch latest version
  const latestVersion = await fetchLatestVersion(packageName)

  // Failed to fetch - return null (graceful failure)
  if (!latestVersion) {
    return null
  }

  // Cache the result
  preferences.cacheVersionCheck(latestVersion)
  await preferences.persist()

  // Return update info
  return getUpdateInfo(currentVersion, latestVersion)
}
