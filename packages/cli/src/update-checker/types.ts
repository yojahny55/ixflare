/**
 * Type definitions for update checker
 * Framework version notification system
 */

/**
 * Result of checking for updates
 */
export interface UpdateCheckResult {
  /** Is an update available */
  hasUpdate: boolean
  /** Current installed version */
  currentVersion: string
  /** Latest available version */
  latestVersion: string
  /** Type of update as returned by semver.diff() */
  updateType:
    | 'major'
    | 'minor'
    | 'patch'
    | 'premajor'
    | 'preminor'
    | 'prepatch'
    | 'prerelease'
    | null
  /** URL to changelog */
  changelogUrl: string
  /** URL to migration guide (for major updates) */
  migrationUrl?: string
}
