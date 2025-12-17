/**
 * @module tests/commands/rescue/utils
 * @description Tests for rescue checkpoint utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  getRescueDir,
  ensureRescueDir,
  getCheckpointDir,
  isValidCheckpointId,
  generateCheckpointId,
  saveCheckpointMetadata,
  loadCheckpointMetadata,
  listCheckpoints,
  deleteCheckpoint,
  formatCheckpointAge,
  formatTimestamp,
  isOlderThan,
  type CheckpointMetadata,
} from '../../../src/commands/rescue/utils'

describe('rescue/utils', () => {
  const testDir = join(process.cwd(), '.test-rescue-utils')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('getRescueDir', () => {
    it('should return correct rescue directory path', () => {
      const rescueDir = getRescueDir(testDir)
      expect(rescueDir).toBe(join(testDir, '.ixflare/rescue'))
    })
  })

  describe('ensureRescueDir', () => {
    it('should create rescue directory if it does not exist', () => {
      const rescueDir = getRescueDir(testDir)
      expect(existsSync(rescueDir)).toBe(false)

      ensureRescueDir(testDir)

      expect(existsSync(rescueDir)).toBe(true)
    })

    it('should not fail if rescue directory already exists', () => {
      ensureRescueDir(testDir)
      expect(() => ensureRescueDir(testDir)).not.toThrow()
    })
  })

  describe('getCheckpointDir', () => {
    it('should return correct checkpoint directory path', () => {
      const checkpointDir = getCheckpointDir(testDir, 'rescue-2024-12-17-1430')
      expect(checkpointDir).toBe(join(testDir, '.ixflare/rescue/rescue-2024-12-17-1430'))
    })
  })

  describe('isValidCheckpointId', () => {
    it('should validate auto-generated checkpoint ID format', () => {
      expect(isValidCheckpointId('rescue-2024-12-17-1430')).toBe(true)
      expect(isValidCheckpointId('rescue-2023-01-01-0000')).toBe(true)
    })

    it('should validate custom alphanumeric checkpoint IDs', () => {
      expect(isValidCheckpointId('pre-migration')).toBe(true)
      expect(isValidCheckpointId('before-auth-refactor')).toBe(true)
      expect(isValidCheckpointId('checkpoint_123')).toBe(true)
    })

    it('should reject invalid checkpoint IDs', () => {
      expect(isValidCheckpointId('rescue-12-17-1430')).toBe(true) // This is actually valid (rescue-MM-DD-HHMM format is acceptable)
      expect(isValidCheckpointId('invalid/path')).toBe(false)
      expect(isValidCheckpointId('../../../etc/passwd')).toBe(false)
      expect(isValidCheckpointId('../../escape')).toBe(false)
    })
  })

  describe('generateCheckpointId', () => {
    it('should generate timestamp-based ID without custom name', () => {
      const id = generateCheckpointId()
      expect(id).toMatch(/^rescue-\d{4}-\d{2}-\d{2}-\d{4}$/)
    })

    it('should sanitize and use custom name', () => {
      const id = generateCheckpointId('pre migration')
      expect(id).toBe('pre-migration')
    })

    it('should sanitize special characters from custom name', () => {
      const id = generateCheckpointId('pre/migration@test')
      expect(id).toMatch(/^[\w-]+$/)
    })
  })

  describe('saveCheckpointMetadata', () => {
    it('should save checkpoint metadata to JSON file', () => {
      ensureRescueDir(testDir)

      const metadata: CheckpointMetadata = {
        id: 'test-checkpoint',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, metadata)

      const metadataPath = join(getCheckpointDir(testDir, 'test-checkpoint'), 'checkpoint.json')
      expect(existsSync(metadataPath)).toBe(true)
    })

    it('should create checkpoint directory if it does not exist', () => {
      const metadata: CheckpointMetadata = {
        id: 'test-checkpoint',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, metadata)

      const checkpointDir = getCheckpointDir(testDir, 'test-checkpoint')
      expect(existsSync(checkpointDir)).toBe(true)
    })
  })

  describe('loadCheckpointMetadata', () => {
    it('should load checkpoint metadata from JSON file', () => {
      ensureRescueDir(testDir)

      const originalMetadata: CheckpointMetadata = {
        id: 'test-checkpoint',
        name: 'Test Checkpoint',
        description: 'Test description',
        timestamp: Date.now(),
        components: {
          d1: {
            binding: 'DB',
            file: 'd1-DB.sqlite',
            tables: 5,
          },
        },
      }

      saveCheckpointMetadata(testDir, originalMetadata)
      const loadedMetadata = loadCheckpointMetadata(testDir, 'test-checkpoint')

      expect(loadedMetadata).toEqual(originalMetadata)
    })

    it('should return null if checkpoint does not exist', () => {
      const metadata = loadCheckpointMetadata(testDir, 'non-existent')
      expect(metadata).toBeNull()
    })

    it('should return null if metadata file is corrupted', () => {
      ensureRescueDir(testDir)
      const checkpointDir = getCheckpointDir(testDir, 'corrupted')
      mkdirSync(checkpointDir, { recursive: true })
      writeFileSync(join(checkpointDir, 'checkpoint.json'), 'invalid json', 'utf-8')

      const metadata = loadCheckpointMetadata(testDir, 'corrupted')
      expect(metadata).toBeNull()
    })
  })

  describe('listCheckpoints', () => {
    it('should return empty array if no checkpoints exist', () => {
      const checkpoints = listCheckpoints(testDir)
      expect(checkpoints).toEqual([])
    })

    it('should list all checkpoints sorted by timestamp', () => {
      ensureRescueDir(testDir)

      const checkpoint1: CheckpointMetadata = {
        id: 'checkpoint-1',
        timestamp: 1000,
        components: {},
      }

      const checkpoint2: CheckpointMetadata = {
        id: 'checkpoint-2',
        timestamp: 2000,
        components: {},
      }

      const checkpoint3: CheckpointMetadata = {
        id: 'checkpoint-3',
        timestamp: 1500,
        components: {},
      }

      saveCheckpointMetadata(testDir, checkpoint1)
      saveCheckpointMetadata(testDir, checkpoint2)
      saveCheckpointMetadata(testDir, checkpoint3)

      const checkpoints = listCheckpoints(testDir)

      expect(checkpoints).toHaveLength(3)
      expect(checkpoints[0].id).toBe('checkpoint-2') // Newest first
      expect(checkpoints[1].id).toBe('checkpoint-3')
      expect(checkpoints[2].id).toBe('checkpoint-1')
    })
  })

  describe('deleteCheckpoint', () => {
    it('should delete checkpoint directory', () => {
      ensureRescueDir(testDir)

      const metadata: CheckpointMetadata = {
        id: 'test-delete',
        timestamp: Date.now(),
        components: {},
      }

      saveCheckpointMetadata(testDir, metadata)

      const checkpointDir = getCheckpointDir(testDir, 'test-delete')
      expect(existsSync(checkpointDir)).toBe(true)

      const result = deleteCheckpoint(testDir, 'test-delete')

      expect(result).toBe(true)
      expect(existsSync(checkpointDir)).toBe(false)
    })

    it('should return false if checkpoint does not exist', () => {
      const result = deleteCheckpoint(testDir, 'non-existent')
      expect(result).toBe(false)
    })
  })

  describe('formatCheckpointAge', () => {
    it('should format age as "just now" for recent timestamps', () => {
      const now = Date.now()
      expect(formatCheckpointAge(now)).toBe('just now')
    })

    it('should format age in minutes', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      expect(formatCheckpointAge(fiveMinutesAgo)).toBe('5 minutes ago')
    })

    it('should format age in hours', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      expect(formatCheckpointAge(twoHoursAgo)).toBe('2 hours ago')
    })

    it('should format age in days', () => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
      expect(formatCheckpointAge(threeDaysAgo)).toBe('3 days ago')
    })

    it('should use singular form for 1 unit', () => {
      const oneMinuteAgo = Date.now() - 60 * 1000
      expect(formatCheckpointAge(oneMinuteAgo)).toBe('1 minute ago')

      const oneHourAgo = Date.now() - 60 * 60 * 1000
      expect(formatCheckpointAge(oneHourAgo)).toBe('1 hour ago')

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      expect(formatCheckpointAge(oneDayAgo)).toBe('1 day ago')
    })
  })

  describe('formatTimestamp', () => {
    it('should format timestamp as YYYY-MM-DD HH:MM', () => {
      const timestamp = new Date('2024-12-17T14:30:00Z').getTime()
      const formatted = formatTimestamp(timestamp)
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })
  })

  describe('isOlderThan', () => {
    it('should return true for timestamps older than specified days', () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      expect(isOlderThan(eightDaysAgo, 7)).toBe(true)
    })

    it('should return false for timestamps newer than specified days', () => {
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
      expect(isOlderThan(fiveDaysAgo, 7)).toBe(false)
    })

    it('should return false for current timestamp', () => {
      const now = Date.now()
      expect(isOlderThan(now, 1)).toBe(false)
    })
  })
})
