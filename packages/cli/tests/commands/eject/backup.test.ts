/**
 * Tests for backup utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupExistingFiles, restoreFromBackups } from '../../../src/commands/eject/backup'

describe('backupExistingFiles', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'eject-backup-test-'))
  })

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should backup wrangler.toml if it exists', async () => {
    writeFileSync(join(testDir, 'wrangler.toml'), 'name = "test"')

    const backups = await backupExistingFiles(testDir, {})

    expect(backups).toHaveLength(1)
    expect(backups[0].original).toBe('wrangler.toml')
    // Timestamp should now be milliseconds (13+ digits) instead of seconds (10 digits)
    expect(backups[0].backup).toMatch(/^wrangler\.toml\.backup-\d{13,}$/)
    expect(existsSync(join(testDir, backups[0].backup))).toBe(true)
  })

  it('should backup vite.config.ts and package.json for full eject', async () => {
    writeFileSync(join(testDir, 'vite.config.ts'), 'export default {}')
    writeFileSync(join(testDir, 'package.json'), '{"name":"test"}')

    const backups = await backupExistingFiles(testDir, {})

    expect(backups.length).toBeGreaterThanOrEqual(2)
    const filenames = backups.map((b) => b.original)
    expect(filenames).toContain('vite.config.ts')
    expect(filenames).toContain('package.json')
  })

  it('should not backup vite.config.ts for config-only eject', async () => {
    writeFileSync(join(testDir, 'vite.config.ts'), 'export default {}')
    writeFileSync(join(testDir, 'package.json'), '{"name":"test"}')

    const backups = await backupExistingFiles(testDir, { configOnly: true })

    const filenames = backups.map((b) => b.original)
    expect(filenames).not.toContain('vite.config.ts')
    expect(filenames).not.toContain('package.json')
  })

  it('should return empty array if no files to backup', async () => {
    const backups = await backupExistingFiles(testDir, {})

    expect(backups).toHaveLength(0)
  })

  it('should create unique timestamps for multiple backups', async () => {
    writeFileSync(join(testDir, 'wrangler.toml'), 'name = "test"')

    const backups1 = await backupExistingFiles(testDir, {})
    // Small delay to ensure different millisecond timestamp
    await new Promise((resolve) => setTimeout(resolve, 5))
    const backups2 = await backupExistingFiles(testDir, {})

    // With millisecond timestamps, backups should have unique names
    expect(backups1[0].backup).toMatch(/^wrangler\.toml\.backup-\d{13,}$/)
    expect(backups2[0].backup).toMatch(/^wrangler\.toml\.backup-\d{13,}$/)
    // Verify they're actually different (milliseconds should differ)
    expect(backups1[0].backup).not.toBe(backups2[0].backup)
  })
})

describe('restoreFromBackups', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'eject-restore-test-'))
  })

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should restore files from backups', async () => {
    const originalContent = 'name = "original"'
    const backupFilename = 'wrangler.toml.backup-123456'

    writeFileSync(join(testDir, backupFilename), originalContent)
    writeFileSync(join(testDir, 'wrangler.toml'), 'name = "modified"')

    await restoreFromBackups(testDir, [{ original: 'wrangler.toml', backup: backupFilename }])

    const restored = readFileSync(join(testDir, 'wrangler.toml'), 'utf-8')
    expect(restored).toBe(originalContent)
  })

  it('should handle multiple files', async () => {
    writeFileSync(join(testDir, 'wrangler.toml.backup-123'), 'name = "w1"')
    writeFileSync(join(testDir, 'vite.config.ts.backup-123'), 'export default {}')
    writeFileSync(join(testDir, 'wrangler.toml'), 'wrong')
    writeFileSync(join(testDir, 'vite.config.ts'), 'wrong')

    await restoreFromBackups(testDir, [
      { original: 'wrangler.toml', backup: 'wrangler.toml.backup-123' },
      { original: 'vite.config.ts', backup: 'vite.config.ts.backup-123' },
    ])

    expect(readFileSync(join(testDir, 'wrangler.toml'), 'utf-8')).toBe('name = "w1"')
    expect(readFileSync(join(testDir, 'vite.config.ts'), 'utf-8')).toBe('export default {}')
  })

  it('should not fail if backup file does not exist', async () => {
    await expect(
      restoreFromBackups(testDir, [{ original: 'wrangler.toml', backup: 'non-existent.backup' }])
    ).resolves.not.toThrow()
  })
})
