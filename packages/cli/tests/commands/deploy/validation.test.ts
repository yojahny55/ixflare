/**
 * @module tests/commands/deploy/validation
 * @description Tests for pre-deploy validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  verifyDeploymentReadiness,
  validateBundleSize,
  validateRequestLimits,
  formatValidationIssues,
} from '../../../src/commands/deploy/validation'
import * as wrangler from '../../../src/utils/wrangler'
import * as wranglerExec from '../../../src/utils/wrangler-exec'

vi.mock('../../../src/utils/wrangler')
vi.mock('../../../src/utils/wrangler-exec')

describe('validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyDeploymentReadiness', () => {
    it('should pass when all prerequisites are met', async () => {
      vi.mocked(wrangler.isWranglerInstalled).mockReturnValue(true)
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('api_token')
      vi.mocked(wrangler.hasAccountId).mockReturnValue(true)

      const result = await verifyDeploymentReadiness()

      expect(result.ready).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should fail when wrangler is not installed', async () => {
      vi.mocked(wrangler.isWranglerInstalled).mockReturnValue(false)
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('oauth')
      vi.mocked(wrangler.hasAccountId).mockReturnValue(true)

      const result = await verifyDeploymentReadiness()

      expect(result.ready).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        type: 'error',
        code: 'WRANGLER_NOT_FOUND',
        message: 'Wrangler CLI not found',
      })
    })

    it('should fail when not authenticated', async () => {
      vi.mocked(wrangler.isWranglerInstalled).mockReturnValue(true)
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('none')
      vi.mocked(wrangler.hasAccountId).mockReturnValue(true)

      const result = await verifyDeploymentReadiness()

      expect(result.ready).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        type: 'error',
        code: 'NOT_AUTHENTICATED',
      })
    })

    it('should warn when account ID is missing', async () => {
      vi.mocked(wrangler.isWranglerInstalled).mockReturnValue(true)
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('api_token')
      vi.mocked(wrangler.hasAccountId).mockReturnValue(false)

      const result = await verifyDeploymentReadiness()

      expect(result.ready).toBe(true) // Warnings don't block
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        type: 'warning',
        code: 'NO_ACCOUNT_ID',
      })
    })

    it('should collect multiple issues', async () => {
      vi.mocked(wrangler.isWranglerInstalled).mockReturnValue(false)
      vi.mocked(wrangler.detectAuthMethod).mockReturnValue('none')
      vi.mocked(wrangler.hasAccountId).mockReturnValue(false)

      const result = await verifyDeploymentReadiness()

      expect(result.ready).toBe(false)
      expect(result.issues).toHaveLength(3)
    })
  })

  describe('validateBundleSize', () => {
    it('should return null when bundle size is within limits', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockResolvedValue({
        success: true,
        stdout: 'Total Upload: 2048 KiB (gzip: 2.5 MiB)',
        stderr: '',
        exitCode: 0,
      })

      const result = await validateBundleSize()

      expect(result).toBeNull()
    })

    it('should warn when bundle exceeds free tier limit (3MB)', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockResolvedValue({
        success: true,
        stdout: 'Total Upload: 4096 KiB (gzip: 3.5 MiB)',
        stderr: '',
        exitCode: 0,
      })

      const result = await validateBundleSize()

      expect(result).not.toBeNull()
      expect(result?.type).toBe('warning')
      expect(result?.code).toBe('BUNDLE_SIZE_WARNING')
      expect(result?.message).toContain('3.50 MiB')
      expect(result?.message).toContain('free tier limit (3 MiB)')
    })

    it('should error when bundle exceeds paid tier limit', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockResolvedValue({
        success: true,
        stdout: 'Total Upload: 11264 KiB (gzip: 11 MiB)',
        stderr: '',
        exitCode: 0,
      })

      const result = await validateBundleSize()

      expect(result).not.toBeNull()
      expect(result?.type).toBe('error')
      expect(result?.code).toBe('BUNDLE_SIZE_WARNING')
    })

    it('should handle KiB units correctly', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockResolvedValue({
        success: true,
        stdout: 'Total Upload: 3584 KiB (gzip: 3584 KiB)',
        stderr: '',
        exitCode: 0,
      })

      const result = await validateBundleSize()

      expect(result).not.toBeNull()
      expect(result?.message).toContain('3.50 MiB')
    })

    it('should return error when dry-run fails', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Build failed',
        exitCode: 1,
      })

      const result = await validateBundleSize()

      expect(result).not.toBeNull()
      expect(result?.type).toBe('error')
      expect(result?.code).toBe('DRY_RUN_FAILED')
    })

    it('should handle parsing errors gracefully', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockRejectedValue(new Error('Spawn error'))

      const result = await validateBundleSize()

      expect(result).not.toBeNull()
      expect(result?.type).toBe('error')
      expect(result?.code).toBe('DRY_RUN_FAILED')
    })

    it('should warn when bundle size cannot be determined from output', async () => {
      vi.mocked(wranglerExec.executeWranglerDryRun).mockResolvedValue({
        success: true,
        stdout: 'Deployment successful but no size info',
        stderr: '',
        exitCode: 0,
      })

      const result = await validateBundleSize()

      expect(result).not.toBeNull()
      expect(result?.type).toBe('warning')
      expect(result?.code).toBe('BUNDLE_SIZE_UNKNOWN')
      expect(result?.message).toContain('Could not determine bundle size')
    })
  })

  describe('validateRequestLimits', () => {
    it('should return null as request validation happens at runtime', () => {
      const result = validateRequestLimits()

      expect(result).toBeNull()
    })
  })

  describe('formatValidationIssues', () => {
    it('should return success message when no issues', () => {
      const output = formatValidationIssues([])

      expect(output).toContain('✅')
      expect(output).toContain('All deployment checks passed')
    })

    it('should format error messages', () => {
      const issues = [
        {
          type: 'error' as const,
          code: 'TEST_ERROR',
          message: 'Test error message',
          remediation: 'Fix the error',
        },
      ]

      const output = formatValidationIssues(issues)

      expect(output).toContain('❌')
      expect(output).toContain('Test error message')
      expect(output).toContain('Fix the error')
    })

    it('should format warning messages', () => {
      const issues = [
        {
          type: 'warning' as const,
          code: 'TEST_WARNING',
          message: 'Test warning message',
          remediation: 'Consider fixing',
        },
      ]

      const output = formatValidationIssues(issues)

      expect(output).toContain('⚠️')
      expect(output).toContain('Test warning message')
      expect(output).toContain('Consider fixing')
    })

    it('should format both errors and warnings', () => {
      const issues = [
        {
          type: 'error' as const,
          code: 'ERROR',
          message: 'Error message',
        },
        {
          type: 'warning' as const,
          code: 'WARNING',
          message: 'Warning message',
        },
      ]

      const output = formatValidationIssues(issues)

      expect(output).toContain('❌')
      expect(output).toContain('⚠️')
      expect(output).toContain('Error message')
      expect(output).toContain('Warning message')
    })

    it('should handle issues without remediation', () => {
      const issues = [
        {
          type: 'error' as const,
          code: 'ERROR',
          message: 'Error message',
        },
      ]

      const output = formatValidationIssues(issues)

      expect(output).toContain('Error message')
      expect(output).not.toContain('→')
    })
  })
})
