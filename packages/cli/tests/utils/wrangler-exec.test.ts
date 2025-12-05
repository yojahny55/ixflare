/**
 * @module tests/utils/wrangler-exec
 * @description Tests for wrangler subprocess execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { executeWranglerDeploy, executeWranglerDryRun } from '../../src/utils/wrangler-exec'

vi.mock('child_process')

describe('wrangler-exec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('executeWranglerDeploy', () => {
    it('should execute wrangler deploy successfully', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy()

      // Simulate successful deployment
      mockProcess.stdout.emit(
        'data',
        Buffer.from('Deployed to https://my-app.subdomain.workers.dev\n')
      )
      mockProcess.stdout.emit('data', Buffer.from('Version ID: abc123-def456\n'))
      mockProcess.emit('close', 0)

      const result = await deployPromise

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://my-app.subdomain.workers.dev')
      expect(result.versionId).toBe('abc123-def456')
      expect(result.exitCode).toBe(0)
      expect(spawn).toHaveBeenCalledWith('wrangler', ['deploy'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    })

    it('should execute wrangler deploy with environment', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy('staging')

      mockProcess.emit('close', 0)

      await deployPromise

      expect(spawn).toHaveBeenCalledWith('wrangler', ['deploy', '--env', 'staging'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    })

    it('should not add env flag for production', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy('production')

      mockProcess.emit('close', 0)

      await deployPromise

      expect(spawn).toHaveBeenCalledWith('wrangler', ['deploy'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    })

    it('should handle deployment failure', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy()

      mockProcess.stderr.emit('data', Buffer.from('Authentication error\n'))
      mockProcess.emit('close', 1)

      const result = await deployPromise

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Authentication error')
    })

    it('should parse deployment URL correctly', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy()

      mockProcess.stdout.emit(
        'data',
        Buffer.from('✓ Deployed to https://test-worker.example.workers.dev\n')
      )
      mockProcess.emit('close', 0)

      const result = await deployPromise

      expect(result.url).toBe('https://test-worker.example.workers.dev')
    })

    it('should parse version ID correctly', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy()

      mockProcess.stdout.emit('data', Buffer.from('Version ID: xyz789-abc123\n'))
      mockProcess.emit('close', 0)

      const result = await deployPromise

      expect(result.versionId).toBe('xyz789-abc123')
    })

    it('should handle null exit code', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const deployPromise = executeWranglerDeploy()

      mockProcess.emit('close', null)

      const result = await deployPromise

      expect(result.exitCode).toBe(1)
      expect(result.success).toBe(false)
    })
  })

  describe('executeWranglerDryRun', () => {
    it('should execute wrangler dry-run successfully', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const dryRunPromise = executeWranglerDryRun()

      mockProcess.stdout.emit(
        'data',
        Buffer.from('Total Upload: 1024 KiB (gzip: 256 KiB)\n')
      )
      mockProcess.emit('close', 0)

      const result = await dryRunPromise

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Total Upload')
      expect(spawn).toHaveBeenCalledWith(
        'wrangler',
        ['deploy', '--dry-run', '--outdir', '.wrangler-dry-run'],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
        }
      )
    })

    it('should handle dry-run failure', async () => {
      const mockProcess = createMockChildProcess()

      vi.mocked(spawn).mockReturnValue(mockProcess as any)

      const dryRunPromise = executeWranglerDryRun()

      mockProcess.stderr.emit('data', Buffer.from('Build error\n'))
      mockProcess.emit('close', 1)

      const result = await dryRunPromise

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Build error')
    })
  })
})

function createMockChildProcess() {
  const mockProcess = new EventEmitter()
  ;(mockProcess as any).stdout = new EventEmitter()
  ;(mockProcess as any).stderr = new EventEmitter()
  return mockProcess
}
