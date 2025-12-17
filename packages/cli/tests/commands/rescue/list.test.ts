/**
 * @module tests/commands/rescue/list
 * @description Tests for rescue:list command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { list } from '../../../src/commands/rescue/list'
import { saveCheckpointMetadata, type CheckpointMetadata } from '../../../src/commands/rescue/utils'

describe('rescue:list command', () => {
  const testDir = join(process.cwd(), '.test-rescue-list')
  const originalCwd = process.cwd()

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
    process.cwd = vi.fn(() => testDir)
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    process.cwd = vi.fn(() => originalCwd)
    vi.clearAllMocks()
  })

  describe('--help flag', () => {
    it('should show help information when --help is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await list(['--help'])

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('rescue:list')
      expect(output).toContain('USAGE')
      expect(output).toContain('OPTIONS')

      consoleSpy.mockRestore()
    })
  })

  describe('listing checkpoints', () => {
    it('should show message when no checkpoints exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await list([])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('No checkpoints found')
      expect(output).toContain('ix rescue:create')

      consoleSpy.mockRestore()
    })

    it('should list all checkpoints with details', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create test checkpoints
      const checkpoint1: CheckpointMetadata = {
        id: 'checkpoint-1',
        name: 'Pre-migration',
        description: 'Before migration',
        timestamp: Date.now() - 1000,
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 5,
          },
        },
      }

      const checkpoint2: CheckpointMetadata = {
        id: 'checkpoint-2',
        timestamp: Date.now(),
        components: {
          git: {
            stashRef: 'stash@{0}',
            branch: 'main',
            commitHash: 'abc123',
          },
        },
      }

      saveCheckpointMetadata(testDir, checkpoint1)
      saveCheckpointMetadata(testDir, checkpoint2)

      await list([])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('checkpoint-1')
      expect(output).toContain('checkpoint-2')
      expect(output).toContain('Pre-migration')
      expect(output).toContain('Before migration')
      expect(output).toContain('Total: 2 checkpoints')

      consoleSpy.mockRestore()
    })

    it('should output JSON format when --json flag is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const checkpoint: CheckpointMetadata = {
        id: 'test-json',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, checkpoint)

      await list(['--json'])

      const output = consoleSpy.mock.calls[0][0]
      const parsed = JSON.parse(output)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
      expect(parsed[0].id).toBe('test-json')

      consoleSpy.mockRestore()
    })
  })

  describe('old checkpoint warnings', () => {
    it('should warn about checkpoints older than 7 days', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const oldCheckpoint: CheckpointMetadata = {
        id: 'old-checkpoint',
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        components: {},
      }

      saveCheckpointMetadata(testDir, oldCheckpoint)

      await list([])

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Older than 7 days')
      expect(output).toContain('ix rescue:delete --older-than')

      consoleSpy.mockRestore()
    })
  })
})
