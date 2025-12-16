/**
 * @module commands/deploy/validation
 * @description Pre-deploy validation utilities
 */

import { isWranglerInstalled, detectAuthMethod, hasAccountId } from '@/utils/wrangler'
import { executeWranglerDryRun } from '@/utils/wrangler-exec'

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

      // Cloudflare Workers limits (compressed):
      // - Free tier: 3 MiB
      // - Paid tier (Workers Paid/Bundled): 10 MiB
      // Reference: https://developers.cloudflare.com/workers/platform/limits/
      if (sizeInMb > 3) {
        return {
          type: sizeInMb > 10 ? 'error' : 'warning',
          code: 'BUNDLE_SIZE_WARNING',
          message: `Bundle size (${sizeInMb.toFixed(2)} MiB gzip) exceeds free tier limit (3 MiB)`,
          remediation:
            sizeInMb > 10
              ? 'Bundle exceeds 10 MiB paid tier limit. Split code, use dynamic imports, or move assets to R2.'
              : 'Upgrade to paid plan, or reduce bundle size by moving configs to KV/R2.',
        }
      }
      return null
    }

    // Dry-run succeeded but we couldn't parse bundle size
    return {
      type: 'warning',
      code: 'BUNDLE_SIZE_UNKNOWN',
      message: 'Could not determine bundle size from wrangler output',
      remediation: 'Run "wrangler deploy --dry-run" manually to check bundle size',
    }
  } catch {
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
 * Note: Request validation happens at runtime by Cloudflare.
 * This function is reserved for future implementation when we can
 * analyze the codebase for potential request size issues.
 */
export function validateRequestLimits(): ValidationIssue | null {
  // Request size validation happens at runtime by Cloudflare
  // Return null as we don't have static analysis for this yet
  return null
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
