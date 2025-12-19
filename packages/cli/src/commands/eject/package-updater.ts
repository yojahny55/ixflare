/**
 * Package.json updater
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface PackageJson {
  name?: string
  version?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  ixflare?: {
    ejected?: boolean
    ejectedAt?: string
  }
  [key: string]: unknown
}

/**
 * Ejected scripts that replace ix commands with raw tools
 */
const EJECTED_SCRIPTS = {
  dev: 'vite',
  build: 'vite build',
  preview: 'wrangler pages dev dist',
  deploy: 'wrangler deploy',
  typecheck: 'tsc --noEmit',
} as const

/**
 * Update package.json with ejected scripts
 */
export function updatePackageJson(projectRoot: string): void {
  const packageJsonPath = join(projectRoot, 'package.json')
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8')
  const packageJson = JSON.parse(packageJsonContent) as PackageJson

  // Update scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    ...EJECTED_SCRIPTS,
  }

  // Add ejection marker
  packageJson.ixflare = {
    ejected: true,
    ejectedAt: new Date().toISOString(),
  }

  // Write back with proper formatting (2 spaces, newline at end)
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')
}

/**
 * Get the updated scripts that will be applied
 */
export function getEjectedScripts(): Record<string, string> {
  return { ...EJECTED_SCRIPTS }
}
