/**
 * @module tests/commands/rescue/restore
 * @description Tests for rescue:restore command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { restore } from '../../../src/commands/rescue/restore'
import {
  saveCheckpointMetadata,
  getRescueDir,
  getCheckpointDir,
  type CheckpointMetadata,
} from '../../../src/commands/rescue/utils'

// Mock prompts
let promptsResponse: object = { proceed: true }
vi.mock('prompts', () => ({
  default: vi.fn(() => promptsResponse),
}))

// Mock child_process for git operations
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    exec: vi.fn((cmd: string, options: unknown, callback?: Function) => {
      const respond = callback || (() => {})

      if (cmd.includes('git stash apply')) {
        respond(null, { stdout: 'Applied stash\n', stderr: '' })
      } else {
        respond(new Error('Command not mocked'))
      }
    }),
  }
})

describe('rescue:restore command', () => {
  const testDir = join(process.cwd(), '.test-rescue-restore')
  const originalCwd = process.cwd()
  const originalExit = process.exit

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
    process.cwd = vi.fn(() => testDir)
    process.exit = vi.fn() as never
    promptsResponse = { proceed: true }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    process.cwd = vi.fn(() => originalCwd)
    process.exit = originalExit as never
    vi.clearAllMocks()
  })

  describe('--help flag', () => {
    it('should show help information when --help is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restore(undefined, ['--help'])

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('rescue:restore')
      expect(output).toContain('USAGE')
      expect(output).toContain('OPTIONS')
      expect(output).toContain('--db-only')
      expect(output).toContain('--code-only')

      consoleSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should exit with error when checkpoint-id is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restore(undefined, [])

      expect(process.exit).toHaveBeenCalledWith(1)
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('checkpoint-id is required')

      consoleSpy.mockRestore()
    })

    it('should reject invalid checkpoint ID with path traversal attempt', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restore('../../../etc/passwd', [])

      expect(process.exit).toHaveBeenCalledWith(1)
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Invalid checkpoint ID format')

      consoleSpy.mockRestore()
    })

    it('should reject checkpoint ID with forward slashes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restore('some/path/checkpoint', [])

      expect(process.exit).toHaveBeenCalledWith(1)
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Invalid checkpoint ID format')

      consoleSpy.mockRestore()
    })

    it('should exit with error when checkpoint does not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restore('non-existent-checkpoint', [])

      expect(process.exit).toHaveBeenCalledWith(1)
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('not found')

      consoleSpy.mockRestore()
    })
  })

  describe('restore functionality', () => {
    it('should show what will be restored and prompt for confirmation', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      promptsResponse = { proceed: false } // User cancels

      const checkpoint: CheckpointMetadata = {
        id: 'test-restore',
        timestamp: Date.now(),
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 5,
          },
        },
      }

      saveCheckpointMetadata(testDir, checkpoint)

      // Create mock backup file
      const checkpointDir = getCheckpointDir(testDir, 'test-restore')
      writeFileSync(join(checkpointDir, 'd1-DB.sqlite'), 'mock database', 'utf-8')

      await restore('test-restore', [])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('This will restore')
      expect(output).toContain('Database')
      expect(output).toContain('Cancelled')

      consoleSpy.mockRestore()
    })

    it('should restore D1 database when confirmed', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      promptsResponse = { proceed: true }

      // Create mock D1 database in .wrangler
      const d1Dir = join(testDir, '.wrangler/state/v3/d1/DB')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), 'current database', 'utf-8')

      const checkpoint: CheckpointMetadata = {
        id: 'test-d1-restore',
        timestamp: Date.now(),
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 5,
          },
        },
      }

      saveCheckpointMetadata(testDir, checkpoint)

      // Create mock backup file
      const checkpointDir = getCheckpointDir(testDir, 'test-d1-restore')
      writeFileSync(join(checkpointDir, 'd1-DB.sqlite'), 'backed up database', 'utf-8')

      await restore('test-d1-restore', [])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Database restored')

      consoleSpy.mockRestore()
    })

    it('should skip confirmation when --yes flag is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create mock D1 database in .wrangler
      const d1Dir = join(testDir, '.wrangler/state/v3/d1/DB')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), 'current database', 'utf-8')

      const checkpoint: CheckpointMetadata = {
        id: 'test-yes-flag',
        timestamp: Date.now(),
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 3,
          },
        },
      }

      saveCheckpointMetadata(testDir, checkpoint)
      const checkpointDir = getCheckpointDir(testDir, 'test-yes-flag')
      writeFileSync(join(checkpointDir, 'd1-DB.sqlite'), 'backed up database', 'utf-8')

      await restore('test-yes-flag', ['--yes'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('restored')

      consoleSpy.mockRestore()
    })
  })

  describe('partial restore', () => {
    it('should only restore database when --db-only is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create mock D1 database
      const d1Dir = join(testDir, '.wrangler/state/v3/d1/DB')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), 'current database', 'utf-8')

      const checkpoint: CheckpointMetadata = {
        id: 'test-db-only',
        timestamp: Date.now(),
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 5,
          },
          git: {
            stashRef: 'stash@{0}',
            branch: 'main',
            commitHash: 'abc123',
          },
        },
      }

      saveCheckpointMetadata(testDir, checkpoint)
      const checkpointDir = getCheckpointDir(testDir, 'test-db-only')
      writeFileSync(join(checkpointDir, 'd1-DB.sqlite'), 'backed up database', 'utf-8')

      await restore('test-db-only', ['--db-only', '--yes'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Database restored')
      // Git should not be mentioned as restored
      expect(output).not.toContain('Code state restored')

      consoleSpy.mockRestore()
    })

    it('should only show code restore option when --code-only is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const checkpoint: CheckpointMetadata = {
        id: 'test-code-only',
        timestamp: Date.now(),
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 5,
          },
          git: {
            stashRef: 'stash@{0}',
            branch: 'main',
            commitHash: 'abc123',
          },
        },
      }

      saveCheckpointMetadata(testDir, checkpoint)
      const checkpointDir = getCheckpointDir(testDir, 'test-code-only')
      writeFileSync(join(checkpointDir, 'd1-DB.sqlite'), 'backed up database', 'utf-8')

      await restore('test-code-only', ['--code-only', '--yes'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      // Database should not be restored
      expect(output).not.toContain('Database restored')

      consoleSpy.mockRestore()
    })
  })
})
