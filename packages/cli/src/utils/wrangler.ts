/**
 * @module utils/wrangler
 * @description Wrangler authentication detection utilities
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Check if wrangler CLI is installed
 */
export function isWranglerInstalled(): boolean {
  try {
    execSync('wrangler --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Detect authentication method in use
 * @returns 'oauth' if OAuth config exists, 'api_token' if env var set, 'none' otherwise
 */
export function detectAuthMethod(): 'oauth' | 'api_token' | 'none' {
  // Check API token first (takes precedence)
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return 'api_token'
  }

  // Check OAuth config file
  const configPath = getWranglerConfigPath()
  if (existsSync(configPath)) {
    return 'oauth'
  }

  return 'none'
}

/**
 * Get platform-specific wrangler OAuth config path
 */
export function getWranglerConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const platform = process.platform

  if (platform === 'darwin') {
    return join(home, 'Library', 'Preferences', '.wrangler', 'config', 'default.toml')
  } else if (platform === 'win32') {
    return join(home, '.wrangler', 'config', 'default.toml')
  } else {
    return join(home, '.config', '.wrangler', 'config', 'default.toml')
  }
}

/**
 * Check if currently authenticated to Cloudflare
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    execSync('wrangler whoami', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Check if account ID is configured
 */
export function hasAccountId(): boolean {
  // Check env var
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return true
  }

  // Check wrangler.toml
  const wranglerPath = join(process.cwd(), 'wrangler.toml')
  if (existsSync(wranglerPath)) {
    try {
      const content = readFileSync(wranglerPath, 'utf-8')
      // Simple check for account_id in TOML
      return /account_id\s*=\s*["'][\w-]+["']/.test(content)
    } catch {
      return false
    }
  }

  return false
}
