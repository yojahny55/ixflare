/**
 * @module detect-pm
 * @description Package manager detection from lockfiles and package.json
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageManager } from './types'
import { DEFAULT_PACKAGE_MANAGER } from './types'

/** Lockfile to package manager mapping (in order of preference) */
const LOCKFILE_MAP: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'package-lock.json': 'npm',
  'yarn.lock': 'npm', // Fall back to npm for yarn (not directly supported)
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
}

/** Order of lockfile checking (pnpm preferred, then npm, then bun) */
const LOCKFILE_ORDER = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb', 'bun.lock']

/**
 * Detect package manager from lockfiles in directory
 */
export function detectFromLockfile(cwd: string): PackageManager | null {
  for (const lockfile of LOCKFILE_ORDER) {
    if (existsSync(join(cwd, lockfile))) {
      return LOCKFILE_MAP[lockfile]
    }
  }
  return null
}

/**
 * Detect package manager from packageManager field in package.json
 */
export function detectFromPackageJson(cwd: string): PackageManager | null {
  const pkgPath = join(cwd, 'package.json')

  if (!existsSync(pkgPath)) {
    return null
  }

  try {
    const content = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)

    if (typeof pkg.packageManager === 'string') {
      const pmField = pkg.packageManager.toLowerCase()
      if (pmField.startsWith('pnpm')) return 'pnpm'
      if (pmField.startsWith('bun')) return 'bun'
      if (pmField.startsWith('npm')) return 'npm'
      if (pmField.startsWith('yarn')) return 'npm' // Fallback for yarn
    }
  } catch {
    // Ignore JSON parse errors
  }

  return null
}

/**
 * Detect package manager from environment
 * Checks npm_config_user_agent which is set by package managers
 */
export function detectFromEnvironment(): PackageManager | null {
  const userAgent = process.env.npm_config_user_agent

  if (!userAgent) {
    return null
  }

  if (userAgent.includes('pnpm')) return 'pnpm'
  if (userAgent.includes('bun')) return 'bun'
  if (userAgent.includes('npm')) return 'npm'
  if (userAgent.includes('yarn')) return 'npm' // Fallback for yarn

  return null
}

/**
 * Detect package manager using multiple strategies
 *
 * Priority:
 * 1. Lockfile in current directory
 * 2. packageManager field in package.json
 * 3. Environment variable (npm_config_user_agent)
 * 4. Returns null if no detection (caller decides default)
 */
export function detectPackageManager(cwd: string = process.cwd()): PackageManager | null {
  // 1. Check lockfiles first (most reliable)
  const fromLockfile = detectFromLockfile(cwd)
  if (fromLockfile) {
    return fromLockfile
  }

  // 2. Check packageManager field in package.json
  const fromPackageJson = detectFromPackageJson(cwd)
  if (fromPackageJson) {
    return fromPackageJson
  }

  // 3. Check environment (how the CLI was invoked)
  const fromEnv = detectFromEnvironment()
  if (fromEnv) {
    return fromEnv
  }

  // 4. No detection - return null (caller decides default)
  return null
}

/**
 * Detect package manager with fallback to default
 * Use this when you always need a value
 */
export function detectPackageManagerWithDefault(cwd: string = process.cwd()): PackageManager {
  return detectPackageManager(cwd) ?? DEFAULT_PACKAGE_MANAGER
}

/**
 * Get the install command for a package manager
 */
export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm install'
    case 'bun':
      return 'bun install'
    case 'npm':
    default:
      return 'npm install'
  }
}

/**
 * Get the run command prefix for a package manager
 */
export function getRunCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm'
    case 'bun':
      return 'bun run'
    case 'npm':
    default:
      return 'npm run'
  }
}
