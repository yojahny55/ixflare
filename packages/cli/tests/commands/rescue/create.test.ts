/**
 * @module tests/commands/rescue/create
 * @description Tests for rescue:create command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { create } from '../../../src/commands/rescue/create'
import { loadCheckpointMetadata, getRescueDir } from '../../../src/commands/rescue/utils'

// Mock child_process for git operations
let execAsyncCalls: string[] = []
let gitCommandsEnabled = true

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    exec: vi.fn((cmd: string, options: any, callback?: Function) => {
      execAsyncCalls.push(cmd)

      // Handle both callback and promisify patterns
      const respond = callback || (() => {})

      if (!gitCommandsEnabled) {
        respond(new Error('Not a git repository'))
        return
      }

      // Simulate git commands
      if (cmd.includes('rev-parse --git-dir')) {
        respond(null, { stdout: '.git\n', stderr: '' })
      } else if (cmd.includes('branch --show-current')) {
        respond(null, { stdout: 'main\n', stderr: '' })
      } else if (cmd.includes('rev-parse HEAD')) {
        respond(null, { stdout: 'abc123def456\n', stderr: '' })
      } else if (cmd.includes('git stash push')) {
        respond(null, { stdout: 'Saved working directory\n', stderr: '' })
      } else {
        respond(new Error('Command not mocked'))
      }
    }),
  }
})

// Mock better-sqlite3 for table counting
const mockDatabase = {
  prepare: vi.fn(),
  close: vi.fn(),
}

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => mockDatabase),
  }
})

describe('rescue:create command', () => {
  const testDir = join(process.cwd(), '.test-rescue-create')
  const originalCwd = process.cwd()

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })

    execAsyncCalls = []
    process.cwd = vi.fn(() => testDir)

    // Reset better-sqlite3 mock
    mockDatabase.prepare = vi.fn(() => ({
      get: vi.fn(() => ({ count: 3 })),
    }))
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

      await create(['--help'])

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('rescue:create')
      expect(output).toContain('USAGE')
      expect(output).toContain('OPTIONS')

      consoleSpy.mockRestore()
    })
  })

  describe('checkpoint creation', () => {
    it('should create checkpoint with auto-generated ID', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create a mock D1 database
      const d1Dir = join(testDir, '.wrangler/state/v3/d1/test-binding')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), 'mock database', 'utf-8')

      await create([])

      const rescueDir = getRescueDir(testDir)
      expect(existsSync(rescueDir)).toBe(true)

      // Check that checkpoint was created (directory exists)
      const entries = require('fs').readdirSync(rescueDir)
      expect(entries.length).toBeGreaterThan(0)

      // Verify checkpoint ID format
      const checkpointId = entries[0]
      expect(checkpointId).toMatch(/^rescue-\d{4}-\d{2}-\d{2}-\d{4}$/)

      // Load and verify metadata
      const metadata = loadCheckpointMetadata(testDir, checkpointId)
      expect(metadata).not.toBeNull()
      expect(metadata?.id).toBe(checkpointId)
      expect(metadata?.timestamp).toBeLessThanOrEqual(Date.now())

      consoleSpy.mockRestore()
    })

    it('should create checkpoint with custom name', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await create(['--name', 'pre-migration'])

      const metadata = loadCheckpointMetadata(testDir, 'pre-migration')
      expect(metadata).not.toBeNull()
      expect(metadata?.id).toBe('pre-migration')
      expect(metadata?.name).toBe('pre-migration')

      consoleSpy.mockRestore()
    })

    it('should create checkpoint with description', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await create(['--name', 'test', '--description', 'Test description'])

      const metadata = loadCheckpointMetadata(testDir, 'test')
      expect(metadata).not.toBeNull()
      expect(metadata?.description).toBe('Test description')

      consoleSpy.mockRestore()
    })
  })

  describe('D1 database backup', () => {
    it('should backup D1 database if it exists', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create a mock D1 database
      const d1Dir = join(testDir, '.wrangler/state/v3/d1/DB')
      mkdirSync(d1Dir, { recursive: true })
      writeFileSync(join(d1Dir, 'db.sqlite'), 'mock database', 'utf-8')

      await create(['--name', 'test-d1'])

      const metadata = loadCheckpointMetadata(testDir, 'test-d1')
      expect(metadata?.components.d1).toBeDefined()
      expect(metadata?.components.d1?.binding).toBe('DB')
      expect(metadata?.components.d1?.file).toBe('d1-DB.sqlite')

      // Verify backup file exists
      const backupPath = join(getRescueDir(testDir), 'test-d1', 'd1-DB.sqlite')
      expect(existsSync(backupPath)).toBe(true)

      consoleSpy.mockRestore()
    })

    it('should handle missing D1 database gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await create(['--name', 'test-no-d1'])

      const metadata = loadCheckpointMetadata(testDir, 'test-no-d1')
      expect(metadata?.components.d1).toBeUndefined()

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('No local D1 database found')

      consoleSpy.mockRestore()
    })
  })

  describe('git state backup', () => {
    it('should skip git stash gracefully if git commands fail', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Disable git for this test
      gitCommandsEnabled = false

      await create(['--name', 'test-no-git'])

      const metadata = loadCheckpointMetadata(testDir, 'test-no-git')
      // Git component should be undefined if git failed
      expect(metadata?.components.git).toBeUndefined()

      const output = consoleSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('No git changes to stash')

      consoleSpy.mockRestore()
      gitCommandsEnabled = true
    })
  })
})
