/**
 * @module commands/deploy
 * @description Deploy to Cloudflare Workers command
 */

import { HooksRunner, HookError } from '../hooks/index'
import { detectAuthMethod } from '../utils/wrangler'
import { executeWranglerDeploy } from '../utils/wrangler-exec'
import {
  verifyDeploymentReadiness,
  validateBundleSize,
  formatValidationIssues,
} from './deploy/validation'
import { showFirstTimeGuide } from './deploy/first-time-guide'

export interface DeployOptions {
  skipFirstTime?: boolean
  environment?: string
}

export async function deploy(options: DeployOptions = {}): Promise<void> {
  const projectRoot = process.cwd()
  const runner = new HooksRunner()

  // Detect environment from options, env vars, or default to production
  const environment =
    options.environment || process.env.IXFLARE_ENV || process.env.NODE_ENV || 'production'

  // First-time deployment check (unless skipped for CI/CD)
  if (!options.skipFirstTime) {
    const authMethod = detectAuthMethod()
    if (authMethod === 'none') {
      const setupSuccess = await showFirstTimeGuide()
      if (!setupSuccess) {
        // User needs to complete setup manually
        process.exit(0)
      }
    }
  }

  // Verify deployment readiness
  console.log('Checking deployment prerequisites...\n')
  const validation = await verifyDeploymentReadiness()

  if (!validation.ready) {
    console.error(formatValidationIssues(validation.issues))
    console.error('Cannot proceed with deployment. Please fix the errors above.\n')
    process.exit(1)
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
      process.exit(1)
    } else {
      console.log(formatValidationIssues([bundleIssue]))
    }
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
        process.exit(1)
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
      process.exit(result.exitCode)
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
        process.exit(1)
      }
    }
  } catch (error) {
    console.error('\n❌ Deployment error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
