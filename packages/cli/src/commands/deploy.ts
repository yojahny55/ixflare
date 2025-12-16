/**
 * @module commands/deploy
 * @description Deploy to Cloudflare Workers command
 */

import { HooksRunner, HookError } from '@/hooks/index'
import { detectAuthMethod } from '@/utils/wrangler'
import { executeWranglerDeploy } from '@/utils/wrangler-exec'
import {
  verifyDeploymentReadiness,
  validateBundleSize,
  formatValidationIssues,
} from './deploy/validation'
import { showFirstTimeGuide } from './deploy/first-time-guide'

export interface DeployOptions {
  skipFirstTime?: boolean
  environment?: string
  dryRun?: boolean
  minify?: boolean
  vars?: Record<string, string>
}

export interface DeployResult {
  success: boolean
  url?: string
  versionId?: string
  exitCode: number
}

/**
 * Parse deploy command CLI arguments
 */
export function parseDeployArgs(args: string[]): DeployOptions {
  const options: DeployOptions = {
    environment: undefined,
    dryRun: false,
    skipFirstTime: false,
    minify: false,
    vars: {},
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--env' && args[i + 1]) {
      options.environment = args[i + 1]
      i++
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--skip-first-time') {
      options.skipFirstTime = true
    } else if (arg === '--minify') {
      options.minify = true
    } else if (arg === '--var' && args[i + 1]) {
      const [key, value] = args[i + 1].split(':')
      if (key && value) {
        options.vars![key] = value
      }
      i++
    }
  }

  return options
}

export async function deploy(options: DeployOptions = {}): Promise<DeployResult> {
  const projectRoot = process.cwd()
  const runner = new HooksRunner()

  // Parse CLI args and merge with provided options
  const cliArgs = process.argv.slice(3)
  const parsedOptions = { ...parseDeployArgs(cliArgs), ...options }

  // Detect environment from options, env vars, or default to production
  const environment =
    parsedOptions.environment || process.env.IXFLARE_ENV || process.env.NODE_ENV || 'production'

  // First-time deployment check (unless skipped for CI/CD)
  if (!parsedOptions.skipFirstTime) {
    const authMethod = detectAuthMethod()
    if (authMethod === 'none') {
      const setupSuccess = await showFirstTimeGuide()
      if (!setupSuccess) {
        // User needs to complete setup manually
        return { success: false, exitCode: 0 }
      }
    }
  }

  // Verify deployment readiness
  console.log('Checking deployment prerequisites...\n')
  const validation = await verifyDeploymentReadiness()

  if (!validation.ready) {
    console.error(formatValidationIssues(validation.issues))
    console.error('Cannot proceed with deployment. Please fix the errors above.\n')
    return { success: false, exitCode: 1 }
  }

  // Show warnings if any
  const warnings = validation.issues.filter((i) => i.type === 'warning')
  if (warnings.length > 0) {
    console.log(formatValidationIssues(warnings))
  }

  // Validate bundle size
  console.log('Validating bundle size...\n')
  const bundleIssue = await validateBundleSize()
  if (bundleIssue) {
    if (bundleIssue.type === 'error') {
      console.error(formatValidationIssues([bundleIssue]))
      console.error('Cannot proceed with deployment due to bundle size.\n')
      return { success: false, exitCode: 1 }
    } else {
      console.log(formatValidationIssues([bundleIssue]))
    }
  }

  // Dry-run mode: show deployment plan without executing
  if (parsedOptions.dryRun) {
    console.log('\n🔍 Dry run - no changes will be made:\n')
    console.log(`Environment: ${environment}`)
    console.log('\n✅ Deployment would proceed with these settings.\n')
    console.log('To deploy for real, run without --dry-run flag.\n')
    return { success: true, exitCode: 0 }
  }

  try {
    // Load configuration and run pre-deploy hooks
    try {
      await runner.loadConfig(projectRoot)
      await runner.runPreDeploy({ environment })
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nDeployment stopped due to hook failure.\n')
        return { success: false, exitCode: 1 }
      }
      // If no config file, continue without hooks
      if (!(error instanceof Error && error.message.includes('Configuration file not found'))) {
        throw error
      }
    }

    // Execute wrangler deploy
    console.log('Deploying to Cloudflare Workers...\n')
    const result = await executeWranglerDeploy(environment)

    if (!result.success) {
      console.error('\n❌ Deployment failed\n')
      console.error('Wrangler output:\n')
      console.error(result.stderr || result.stdout)
      return { success: false, exitCode: result.exitCode }
    }

    // Display success message with deployment URL
    console.log('\n✅ Deployed successfully!\n')
    if (result.url) {
      console.log(`Your app is live at: ${result.url}\n`)
    }
    if (result.versionId) {
      console.log(`Version ID: ${result.versionId}\n`)
    }

    console.log('Next steps:')
    console.log('  View logs: ix logs --tail')
    console.log('  Set up custom domain: ix domains add')
    console.log('  Learn more: https://ixflare.dev/docs/deployment\n')

    // Run post-deploy hooks
    try {
      await runner.runPostDeploy({ url: result.url || 'unknown' })
    } catch (error) {
      if (error instanceof HookError) {
        console.error(`\n❌ ${error.message}`)
        console.error('\nDeployment completed but post-deploy hook failed.\n')
        return { success: false, url: result.url, versionId: result.versionId, exitCode: 1 }
      }
    }

    return { success: true, url: result.url, versionId: result.versionId, exitCode: 0 }
  } catch (error) {
    console.error('\n❌ Deployment error:', error instanceof Error ? error.message : error)
    return { success: false, exitCode: 1 }
  }
}
