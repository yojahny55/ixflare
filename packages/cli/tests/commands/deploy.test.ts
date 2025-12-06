/**
 * @module tests/commands/deploy
 * @description Integration tests for deploy command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deploy } from '../../src/commands/deploy'
import * as wrangler from '../../src/utils/wrangler'
import * as wranglerExec from '../../src/utils/wrangler-exec'
import * as validation from '../../src/commands/deploy/validation'
import * as firstTimeGuide from '../../src/commands/deploy/first-time-guide'

vi.mock('../../src/utils/wrangler')
vi.mock('../../src/utils/wrangler-exec')
vi.mock('../../src/commands/deploy/validation')
vi.mock('../../src/commands/deploy/first-time-guide')

// Store mock methods at module level for access in tests
const mockLoadConfig = vi.fn()
const mockRunPreDeploy = vi.fn()
const mockRunPostDeploy = vi.fn()

vi.mock('../../src/hooks/index', () => {
  return {
    HooksRunner: class HooksRunner {
      loadConfig = mockLoadConfig
      runPreDeploy = mockRunPreDeploy
      runPostDeploy = mockRunPostDeploy
    },
    HookError: class HookError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'HookError'
      }
    },
  }
})

describe('deploy command', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations for happy path
    vi.mocked(wrangler.detectAuthMethod).mockReturnValue('api_token')
    vi.mocked(validation.verifyDeploymentReadiness).mockResolvedValue({
      ready: true,
      issues: [],
    })
    vi.mocked(validation.validateBundleSize).mockResolvedValue(null)
    vi.mocked(validation.formatValidationIssues).mockReturnValue('')
    vi.mocked(wranglerExec.executeWranglerDeploy).mockResolvedValue({
      success: true,
      url: 'https://test.workers.dev',
      versionId: 'v123',
      stdout: '',
      stderr: '',
      exitCode: 0,
    })

    // Reset mock runner
    mockLoadConfig.mockResolvedValue(undefined)
    mockRunPreDeploy.mockResolvedValue(undefined)
    mockRunPostDeploy.mockResolvedValue(undefined)
  })

  describe('first-time detection', () => {
    it('should show first-time guide when not authenticated', async () => {
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('none')
      vi.mocked(firstTimeGuide.showFirstTimeGuide).mockResolvedValue(false)

      const result = await deploy()

      expect(firstTimeGuide.showFirstTimeGuide).toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(0)
    })

    it('should continue after successful first-time setup', async () => {
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('none')
      vi.mocked(firstTimeGuide.showFirstTimeGuide).mockResolvedValue(true)

      const result = await deploy()

      expect(firstTimeGuide.showFirstTimeGuide).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should skip first-time guide when skipFirstTime option is true', async () => {
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('none')

      await deploy({ skipFirstTime: true })

      expect(firstTimeGuide.showFirstTimeGuide).not.toHaveBeenCalled()
    })

    it('should skip first-time guide when already authenticated', async () => {
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('api_token')

      await deploy()

      expect(firstTimeGuide.showFirstTimeGuide).not.toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should fail when deployment prerequisites not met', async () => {
      vi.mocked(validation.verifyDeploymentReadiness).mockResolvedValue({
        ready: false,
        issues: [
          {
            type: 'error',
            code: 'WRANGLER_NOT_FOUND',
            message: 'Wrangler CLI not found',
          },
        ],
      })

      const result = await deploy()

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('should continue with warnings but no errors', async () => {
      vi.mocked(validation.verifyDeploymentReadiness).mockResolvedValue({
        ready: true,
        issues: [
          {
            type: 'warning',
            code: 'NO_ACCOUNT_ID',
            message: 'Account ID not configured',
          },
        ],
      })

      const result = await deploy()

      expect(result.success).toBe(true)
    })

    it('should fail when bundle size exceeds limits', async () => {
      vi.mocked(validation.validateBundleSize).mockResolvedValue({
        type: 'error',
        code: 'BUNDLE_SIZE_WARNING',
        message: 'Bundle too large',
      })

      const result = await deploy()

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('should continue with bundle size warning', async () => {
      vi.mocked(validation.validateBundleSize).mockResolvedValue({
        type: 'warning',
        code: 'BUNDLE_SIZE_WARNING',
        message: 'Bundle exceeds free tier',
      })

      const result = await deploy()

      expect(result.success).toBe(true)
    })
  })

  describe('deployment execution', () => {
    it('should return success with URL on successful deployment', async () => {
      const result = await deploy()

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://test.workers.dev')
      expect(result.versionId).toBe('v123')
      expect(result.exitCode).toBe(0)
    })

    it('should return failure when wrangler deploy fails', async () => {
      vi.mocked(wranglerExec.executeWranglerDeploy).mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Deployment error',
        exitCode: 1,
      })

      const result = await deploy()

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('should pass environment to wrangler deploy', async () => {
      await deploy({ environment: 'staging' })

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith('staging')
    })

    it('should use IXFLARE_ENV when environment not specified', async () => {
      process.env.IXFLARE_ENV = 'staging'

      await deploy()

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith('staging')

      delete process.env.IXFLARE_ENV
    })
  })

  describe('hooks integration', () => {
    it('should run pre-deploy and post-deploy hooks', async () => {
      await deploy({ environment: 'production' })

      expect(mockRunPreDeploy).toHaveBeenCalledWith({ environment: 'production' })
      expect(mockRunPostDeploy).toHaveBeenCalledWith({ url: 'https://test.workers.dev' })
    })

    it('should continue without hooks if no config file', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Configuration file not found'))

      const result = await deploy()

      expect(result.success).toBe(true)
    })
  })
})
