/**
 * @module tests/commands/deploy
 * @description Integration tests for deploy command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deploy, parseDeployArgs } from '../../src/commands/deploy'
import * as wrangler from '../../src/utils/wrangler'
import * as wranglerExec from '../../src/utils/wrangler-exec'
import * as validation from '../../src/commands/deploy/validation'
import * as firstTimeGuide from '../../src/commands/deploy/first-time-guide'

vi.mock('../../src/utils/wrangler', () => ({
  detectAuthMethod: vi.fn(),
  parseWranglerBindings: vi.fn(() => ({
    name: 'test-worker',
    d1Databases: [],
    kvNamespaces: [],
    r2Buckets: [],
    vars: {},
  })),
}))
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

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'staging' })
      )
    })

    it('should use IXFLARE_ENV when environment not specified', async () => {
      process.env.IXFLARE_ENV = 'staging'

      await deploy()

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'staging' })
      )

      delete process.env.IXFLARE_ENV
    })

    it('should pass minify flag to wrangler deploy', async () => {
      await deploy({ minify: true })

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith(
        expect.objectContaining({ minify: true })
      )
    })

    it('should pass vars to wrangler deploy', async () => {
      await deploy({ vars: { API_KEY: 'secret123', DEBUG: 'true' } })

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith(
        expect.objectContaining({
          vars: { API_KEY: 'secret123', DEBUG: 'true' },
        })
      )
    })

    it('should pass all options together to wrangler deploy', async () => {
      await deploy({
        environment: 'staging',
        minify: true,
        vars: { API_KEY: 'secret' },
      })

      expect(wranglerExec.executeWranglerDeploy).toHaveBeenCalledWith({
        environment: 'staging',
        minify: true,
        vars: { API_KEY: 'secret' },
      })
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

  describe('dry-run mode', () => {
    it('should not execute wrangler deploy in dry-run mode', async () => {
      const result = await deploy({ dryRun: true })

      expect(wranglerExec.executeWranglerDeploy).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
    })

    it('should perform validation checks before dry-run', async () => {
      await deploy({ dryRun: true })

      expect(validation.verifyDeploymentReadiness).toHaveBeenCalled()
      expect(validation.validateBundleSize).toHaveBeenCalled()
    })

    it('should fail dry-run if validation fails', async () => {
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

      const result = await deploy({ dryRun: true })

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })
  })

  describe('CLI argument parsing', () => {
    it('should parse --env flag', () => {
      const options = parseDeployArgs(['--env', 'staging'])

      expect(options.environment).toBe('staging')
    })

    it('should parse --dry-run flag', () => {
      const options = parseDeployArgs(['--dry-run'])

      expect(options.dryRun).toBe(true)
    })

    it('should parse --skip-first-time flag', () => {
      const options = parseDeployArgs(['--skip-first-time'])

      expect(options.skipFirstTime).toBe(true)
    })

    it('should parse --minify flag', () => {
      const options = parseDeployArgs(['--minify'])

      expect(options.minify).toBe(true)
    })

    it('should parse --var flag with KEY:VALUE', () => {
      const options = parseDeployArgs(['--var', 'API_KEY:secret123', '--var', 'DEBUG:true'])

      expect(options.vars).toEqual({ API_KEY: 'secret123', DEBUG: 'true' })
    })

    it('should parse --var flag with values containing colons', () => {
      const options = parseDeployArgs([
        '--var',
        'DATABASE_URL:postgres://user:password@host:5432/db',
      ])

      expect(options.vars).toEqual({
        DATABASE_URL: 'postgres://user:password@host:5432/db',
      })
    })

    it('should warn on invalid --var format (missing colon)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const options = parseDeployArgs(['--var', 'INVALID_VAR_NO_COLON'])

      expect(options.vars).toEqual({})
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid --var format')
      )

      warnSpy.mockRestore()
    })

    it('should parse multiple flags together', () => {
      const options = parseDeployArgs(['--env', 'production', '--dry-run', '--minify'])

      expect(options.environment).toBe('production')
      expect(options.dryRun).toBe(true)
      expect(options.minify).toBe(true)
    })

    it('should return default values when no flags provided', () => {
      const options = parseDeployArgs([])

      expect(options.environment).toBeUndefined()
      expect(options.dryRun).toBe(false)
      expect(options.skipFirstTime).toBe(false)
      expect(options.minify).toBe(false)
      expect(options.vars).toEqual({})
    })
  })
})
