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
 * Note: This is synchronous as it uses execSync internally
 */
export function isAuthenticated(): boolean {
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

export interface WranglerBindings {
  name?: string
  d1Databases: string[]
  kvNamespaces: string[]
  r2Buckets: string[]
  vars: Record<string, string>
}

/**
 * Parse wrangler.toml for bindings and worker name
 */
export function parseWranglerBindings(): WranglerBindings {
  const result: WranglerBindings = {
    name: undefined,
    d1Databases: [],
    kvNamespaces: [],
    r2Buckets: [],
    vars: {},
  }

  const wranglerPath = join(process.cwd(), 'wrangler.toml')
  if (!existsSync(wranglerPath)) {
    return result
  }

  try {
    const content = readFileSync(wranglerPath, 'utf-8')

    // Parse worker name
    const nameMatch = content.match(/^name\s*=\s*["']([^"']+)["']/m)
    if (nameMatch) {
      result.name = nameMatch[1]
    }

    // Parse D1 databases - look for [[d1_databases]] sections
    // eslint-disable-next-line no-useless-escape
    const d1Matches = content.matchAll(/\[\[d1_databases\]\][^\[]*binding\s*=\s*["']([^"']+)["']/g)
    for (const match of d1Matches) {
      result.d1Databases.push(match[1])
    }

    // Parse KV namespaces - look for [[kv_namespaces]] sections
    // eslint-disable-next-line no-useless-escape
    const kvMatches = content.matchAll(/\[\[kv_namespaces\]\][^\[]*binding\s*=\s*["']([^"']+)["']/g)
    for (const match of kvMatches) {
      result.kvNamespaces.push(match[1])
    }

    // Parse R2 buckets - look for [[r2_buckets]] sections
    // eslint-disable-next-line no-useless-escape
    const r2Matches = content.matchAll(/\[\[r2_buckets\]\][^\[]*binding\s*=\s*["']([^"']+)["']/g)
    for (const match of r2Matches) {
      result.r2Buckets.push(match[1])
    }

    // Parse vars section - look for [vars] section
    const varsMatch = content.match(/\[vars\]([\s\S]*?)(?=\n\[|\n\[\[|$)/)
    if (varsMatch) {
      const varsSection = varsMatch[1]
      const varLines = varsSection.matchAll(/^(\w+)\s*=\s*["']?([^"'\n]+)["']?/gm)
      for (const match of varLines) {
        result.vars[match[1]] = match[2]
      }
    }

    return result
  } catch {
    return result
  }
}
