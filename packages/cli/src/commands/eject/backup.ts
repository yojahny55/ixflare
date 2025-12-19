/**
 * File backup utilities
 */

import { existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EjectOptions } from './types.js'

export interface BackupResult {
  original: string
  backup: string
}

/**
 * Create timestamped backups of existing files before overwriting
 */
export async function backupExistingFiles(
  projectRoot: string,
  options: EjectOptions
): Promise<BackupResult[]> {
  const backups: BackupResult[] = []
  const timestamp = Math.floor(Date.now() / 1000)

  const filesToBackup: string[] = []

  // Always backup wrangler.toml if it exists
  if (existsSync(join(projectRoot, 'wrangler.toml'))) {
    filesToBackup.push('wrangler.toml')
  }

  // Backup vite.config.ts and package.json for full eject
  if (!options.configOnly) {
    if (existsSync(join(projectRoot, 'vite.config.ts'))) {
      filesToBackup.push('vite.config.ts')
    }
    if (existsSync(join(projectRoot, 'package.json'))) {
      filesToBackup.push('package.json')
    }
  }

  for (const filename of filesToBackup) {
    const originalPath = join(projectRoot, filename)
    const backupFilename = `${filename}.backup-${timestamp}`
    const backupPath = join(projectRoot, backupFilename)

    try {
      copyFileSync(originalPath, backupPath)
      backups.push({
        original: filename,
        backup: backupFilename,
      })
    } catch (error) {
      throw new Error(
        `Failed to backup ${filename}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return backups
}

/**
 * Restore files from backups (rollback on error)
 */
export async function restoreFromBackups(
  projectRoot: string,
  backups: BackupResult[]
): Promise<void> {
  for (const { original, backup } of backups) {
    const originalPath = join(projectRoot, original)
    const backupPath = join(projectRoot, backup)

    if (existsSync(backupPath)) {
      copyFileSync(backupPath, originalPath)
    }
  }
}
