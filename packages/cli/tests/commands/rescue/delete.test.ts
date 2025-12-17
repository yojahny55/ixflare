/**
 * @module tests/commands/rescue/delete
 * @description Tests for rescue:delete command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { deleteCheckpoint as deleteCheckpointCommand } from '../../../src/commands/rescue/delete'
import {
  saveCheckpointMetadata,
  loadCheckpointMetadata,
  type CheckpointMetadata,
} from '../../../src/commands/rescue/utils'

// Mock prompts
let promptsResponse: object = { proceed: true }
vi.mock('prompts', () => ({
  default: vi.fn(() => promptsResponse),
}))

describe('rescue:delete command', () => {
  const testDir = join(process.cwd(), '.test-rescue-delete')
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

      await deleteCheckpointCommand(undefined, ['--help'])

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('rescue:delete')
      expect(output).toContain('USAGE')
      expect(output).toContain('OPTIONS')

      consoleSpy.mockRestore()
    })
  })

  describe('single checkpoint deletion', () => {
    it('should delete checkpoint with confirmation', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const checkpoint: CheckpointMetadata = {
        id: 'test-delete',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, checkpoint)
      expect(loadCheckpointMetadata(testDir, 'test-delete')).not.toBeNull()

      await deleteCheckpointCommand('test-delete', [])

      expect(loadCheckpointMetadata(testDir, 'test-delete')).toBeNull()

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('deleted successfully')

      consoleSpy.mockRestore()
    })

    it('should delete checkpoint without confirmation when --yes flag is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const checkpoint: CheckpointMetadata = {
        id: 'test-delete-yes',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, checkpoint)

      await deleteCheckpointCommand('test-delete-yes', ['--yes'])

      expect(loadCheckpointMetadata(testDir, 'test-delete-yes')).toBeNull()

      consoleSpy.mockRestore()
    })

    it('should exit with error when checkpoint does not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await deleteCheckpointCommand('non-existent', [])

      expect(process.exit).toHaveBeenCalledWith(1)

      consoleSpy.mockRestore()
    })
  })

  describe('bulk deletion by age', () => {
    it('should delete all checkpoints older than specified days', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const oldCheckpoint1: CheckpointMetadata = {
        id: 'old-1',
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        components: {},
      }

      const oldCheckpoint2: CheckpointMetadata = {
        id: 'old-2',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        components: {},
      }

      const recentCheckpoint: CheckpointMetadata = {
        id: 'recent',
        timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
        components: {},
      }

      saveCheckpointMetadata(testDir, oldCheckpoint1)
      saveCheckpointMetadata(testDir, oldCheckpoint2)
      saveCheckpointMetadata(testDir, recentCheckpoint)

      await deleteCheckpointCommand(undefined, ['--older-than', '7'])

      expect(loadCheckpointMetadata(testDir, 'old-1')).toBeNull()
      expect(loadCheckpointMetadata(testDir, 'old-2')).toBeNull()
      expect(loadCheckpointMetadata(testDir, 'recent')).not.toBeNull()

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Successfully deleted 2')

      consoleSpy.mockRestore()
    })

    it('should show message when no old checkpoints exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const recentCheckpoint: CheckpointMetadata = {
        id: 'recent',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, recentCheckpoint)

      await deleteCheckpointCommand(undefined, ['--older-than', '7'])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('No checkpoints older than 7 days found')

      consoleSpy.mockRestore()
    })

    it('should exit with error when --older-than value is invalid', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await deleteCheckpointCommand(undefined, ['--older-than', 'invalid'])

      expect(process.exit).toHaveBeenCalledWith(1)

      consoleSpy.mockRestore()
    })
  })
})
