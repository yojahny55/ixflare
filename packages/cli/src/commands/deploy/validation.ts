/**
 * @module commands/deploy/validation
 * @description Pre-deploy validation utilities
 */

import { isWranglerInstalled, detectAuthMethod, hasAccountId } from '../../utils/wrangler'
import { executeWranglerDryRun } from '../../utils/wrangler-exec'

export interface ValidationResult {
  ready: boolean
  issues: ValidationIssue[]
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  remediation?: string
}

/**
 * Verify all deployment prerequisites
 */
export async function verifyDeploymentReadiness(): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  // Check wrangler installed
  if (!isWranglerInstalled()) {
    issues.push({
      type: 'error',
      code: 'WRANGLER_NOT_FOUND',
      message: 'Wrangler CLI not found',
      remediation: 'npm install wrangler --save-dev',
    })
  }

  // Check authentication
  const authMethod = detectAuthMethod()
  if (authMethod === 'none') {
    issues.push({
      type: 'error',
      code: 'NOT_AUTHENTICATED',
      message: 'Not authenticated with Cloudflare',
      remediation: 'npx wrangler login (local) or set CLOUDFLARE_API_TOKEN (CI/CD)',
    })
  }

  // Check account ID
  if (!hasAccountId()) {
    issues.push({
      type: 'warning',
      code: 'NO_ACCOUNT_ID',
      message: 'Account ID not configured',
      remediation: 'Add account_id to wrangler.toml or set CLOUDFLARE_ACCOUNT_ID',
    })
  }

  return {
    ready: issues.filter((i) => i.type === 'error').length === 0,
    issues,
  }
}

/**
 * Validate bundle size against Cloudflare limits
 */
export async function validateBundleSize(): Promise<ValidationIssue | null> {
  try {
    const result = await executeWranglerDryRun()

    if (!result.success) {
      return {
        type: 'error',
        code: 'DRY_RUN_FAILED',
        message: 'Failed to validate bundle',
        remediation: 'Check wrangler.toml configuration and entry point',
      }
    }

    // Parse bundle size from output
    const sizeMatch = result.stdout.match(
      /Total Upload:\s+([\d.]+)\s*(KiB|MiB).*gzip:\s+([\d.]+)\s*(KiB|MiB)/i
    )

    if (sizeMatch) {
      const compressedSize = parseFloat(sizeMatch[3])
      const unit = sizeMatch[4]
      const sizeInMb = unit === 'MiB' ? compressedSize : compressedSize / 1024

      // Free tier: 3 MiB, Paid: 10 MiB
      if (sizeInMb > 3) {
        return {
          type: sizeInMb > 10 ? 'error' : 'warning',
          code: 'BUNDLE_SIZE_WARNING',
          message: `Bundle size (${sizeInMb.toFixed(2)} MiB) exceeds free tier limit (3 MiB)`,
          remediation:
            'Move configs to KV/R2, use Workers Static Assets, or upgrade to paid plan',
        }
      }
    }

    return null
  } catch (error) {
    return {
      type: 'error',
      code: 'DRY_RUN_FAILED',
      message: 'Failed to validate bundle',
      remediation: 'Check wrangler.toml configuration and entry point',
    }
  }
}

/**
 * Validate request size limits
 */
export function validateRequestLimits(): ValidationIssue | null {
  // This is informational - actual validation happens at runtime
  // Including here for first-time user guidance
  return {
    type: 'warning',
    code: 'REQUEST_SIZE_INFO',
    message: 'Request size validation:',
    remediation: `Max request body: 100MB (Cloudflare limit)
Tip: Large file uploads should use R2 presigned URLs.`,
  }
}

/**
 * Format validation issues for display
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return '✅ All deployment checks passed\n'
  }

  let output = ''

  const errors = issues.filter((i) => i.type === 'error')
  const warnings = issues.filter((i) => i.type === 'warning')

  if (errors.length > 0) {
    output += '❌ Deployment prerequisites check failed:\n\n'
    for (const error of errors) {
      output += `  ${error.message}\n`
      if (error.remediation) {
        output += `  → ${error.remediation}\n`
      }
      output += '\n'
    }
  }

  if (warnings.length > 0) {
    output += '⚠️  Warnings:\n\n'
    for (const warning of warnings) {
      output += `  ${warning.message}\n`
      if (warning.remediation) {
        output += `  → ${warning.remediation}\n`
      }
      output += '\n'
    }
  }

  return output
}
