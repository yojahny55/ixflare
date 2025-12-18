/**
 * @module commands/deploy
 * @description Deploy to Cloudflare Workers command
 */

import { HooksRunner, HookError } from '@/hooks/index'
import { detectAuthMethod, parseWranglerBindings } from '@/utils/wrangler'
import { executeWranglerDeploy } from '@/utils/wrangler-exec'
import {
  verifyDeploymentReadiness,
  validateBundleSize,
  formatValidationIssues,
} from './deploy/validation'
import { showFirstTimeGuide } from './deploy/first-time-guide'
import { DeployError, detectDisplayOptions } from '@/errors'
import { detectDisplayMode, ProgressIndicator } from '@/progress'

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
      // Use indexOf to handle values containing colons (e.g., DATABASE_URL:postgres://user:pass@host)
      const colonIndex = args[i + 1].indexOf(':')
      if (colonIndex > 0) {
        const key = args[i + 1].substring(0, colonIndex)
        const value = args[i + 1].substring(colonIndex + 1)
        options.vars![key] = value
      } else {
        // Warn about invalid --var format (missing colon)
        console.warn(`⚠️  Invalid --var format: "${args[i + 1]}". Expected KEY:VALUE format.`)
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
  // Note: NODE_ENV is intentionally NOT used as fallback - deployment implies production intent
  // unless explicitly specified via --env or IXFLARE_ENV
  const environment = parsedOptions.environment || process.env.IXFLARE_ENV || 'production'

  // First-time deployment check (unless skipped for CI/CD)
  if (!parsedOptions.skipFirstTime) {
    const authMethod = detectAuthMethod()
    if (authMethod === 'none') {
      const setupSuccess = await showFirstTimeGuide()
      if (!setupSuccess) {
        // User needs to complete setup manually - show actionable error
        const error = new DeployError({
          code: 'IX_E301',
          message: 'Missing Cloudflare credentials',
          causes: [
            'CLOUDFLARE_API_TOKEN environment variable not set',
            'Not logged in to Wrangler CLI',
          ],
          fixes: [
            'Run: `wrangler login`',
            'Or set CLOUDFLARE_API_TOKEN in your environment',
            'Get token at: https://dash.cloudflare.com/profile/api-tokens',
          ],
        })
        const displayOptions = detectDisplayOptions()
        console.error(error.format(displayOptions))
        return { success: false, exitCode: 0 }
      }
    }
  }

  // Detect display mode for progress indicators
  const displayMode = detectDisplayMode(cliArgs)

  // Verify deployment readiness
  const verifySpinner = displayMode.spinner
    ? new ProgressIndicator({ text: 'Checking deployment prerequisites' })
    : null

  if (verifySpinner) {
    verifySpinner.start()
  } else {
    console.log('Checking deployment prerequisites...\n')
  }

  const validation = await verifyDeploymentReadiness()

  if (verifySpinner) {
    if (validation.ready) {
      verifySpinner.succeed('Deployment prerequisites verified')
    } else {
      verifySpinner.fail('Deployment validation failed')
    }
  }

  if (!validation.ready) {
    const errorIssues = validation.issues.filter((i) => i.type === 'error')
    const error = new DeployError({
      code: 'IX_E303',
      message: 'Deployment validation failed',
      causes: errorIssues.map((i) => i.message),
      fixes: [
        'Fix the issues listed above',
        'Run `pnpm build` to check for build errors',
        'Verify wrangler.toml configuration',
      ],
    })
    const displayOptions = detectDisplayOptions()
    console.error(error.format(displayOptions))
    return { success: false, exitCode: 1 }
  }

  // Show warnings if any
  const warnings = validation.issues.filter((i) => i.type === 'warning')
  if (warnings.length > 0) {
    console.log(formatValidationIssues(warnings))
  }

  // Validate bundle size
  const bundleSpinner = displayMode.spinner
    ? new ProgressIndicator({ text: 'Validating bundle size' })
    : null

  if (bundleSpinner) {
    bundleSpinner.start()
  } else {
    console.log('Validating bundle size...\n')
  }

  const bundleIssue = await validateBundleSize()

  if (bundleSpinner) {
    if (!bundleIssue || bundleIssue.type === 'warning') {
      bundleSpinner.succeed('Bundle size validated')
    } else {
      bundleSpinner.fail('Bundle size exceeds limit')
    }
  }
  if (bundleIssue) {
    if (bundleIssue.type === 'error') {
      const error = new DeployError({
        code: 'IX_E305',
        message: 'Worker script too large',
        causes: [bundleIssue.message],
        fixes: [
          'Reduce bundle size by removing unused dependencies',
          'Use tree-shaking: import only what you need',
          'Move large assets to R2 or external CDN',
          'Check for large dependencies with `pnpm why <pkg>`',
        ],
      })
      const displayOptions = detectDisplayOptions()
      console.error(error.format(displayOptions))
      return { success: false, exitCode: 1 }
    } else {
      console.log(formatValidationIssues([bundleIssue]))
    }
  }

  // Dry-run mode: show deployment plan without executing
  if (parsedOptions.dryRun) {
    console.log('\n🔍 Dry run - no changes will be made:\n')
    console.log(`Environment: ${environment}`)

    // Parse wrangler.toml for bindings and show them
    const bindings = parseWranglerBindings()

    // Show variables (masked)
    const allVars = { ...bindings.vars, ...parsedOptions.vars }
    if (Object.keys(allVars).length > 0) {
      console.log('\n  Variables to set:')
      for (const key of Object.keys(allVars)) {
        console.log(`    ${key}: ***hidden***`)
      }
    }

    // Show resources
    const hasResources =
      bindings.name ||
      bindings.d1Databases.length ||
      bindings.kvNamespaces.length ||
      bindings.r2Buckets.length
    if (hasResources) {
      console.log('\n  Resources:')
      if (bindings.name) {
        console.log(`    Worker: ${bindings.name}`)
      }
      for (const db of bindings.d1Databases) {
        console.log(`    D1: ${db}`)
      }
      for (const kv of bindings.kvNamespaces) {
        console.log(`    KV: ${kv}`)
      }
      for (const r2 of bindings.r2Buckets) {
        console.log(`    R2: ${r2}`)
      }
    }

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
        const deployError = new DeployError({
          code: 'IX_E304',
          message: `Pre-deploy hook failed: ${error.message}`,
          causes: [
            'Hook script returned non-zero exit code',
            'Hook script threw an error',
            'Hook command not found',
          ],
          fixes: [
            'Check hook script for errors',
            'Ensure hook commands are executable',
            'Run with `--verbose` for detailed output',
          ],
          originalError: error,
        })
        const displayOptions = detectDisplayOptions()
        console.error(deployError.format(displayOptions))
        return { success: false, exitCode: 1 }
      }
      // If no config file, continue without hooks
      if (!(error instanceof Error && error.message.includes('Configuration file not found'))) {
        throw error
      }
    }

    // Execute wrangler deploy
    const deploySpinner = displayMode.spinner
      ? new ProgressIndicator({ text: `Deploying to Cloudflare Workers (${environment})` })
      : null

    if (deploySpinner) {
      deploySpinner.start()
    } else {
      console.log('Deploying to Cloudflare Workers...\n')
    }

    const result = await executeWranglerDeploy({
      environment,
      minify: parsedOptions.minify,
      vars: parsedOptions.vars,
    })

    if (deploySpinner) {
      if (result.success) {
        deploySpinner.succeed(`Deployed in ${deploySpinner.elapsedFormatted}`)
      } else {
        deploySpinner.fail('Deployment failed')
      }
    }

    if (!result.success) {
      const error = new DeployError({
        code: 'IX_E303',
        message: 'Deployment to Cloudflare Workers failed',
        causes: [
          result.stderr || result.stdout || 'Unknown wrangler error',
        ],
        fixes: [
          'Check the wrangler output above for details',
          'Verify your Cloudflare credentials are valid',
          'Run `wrangler whoami` to check authentication',
          'Try `ix deploy --dry-run` to validate configuration',
        ],
      })
      const displayOptions = detectDisplayOptions()
      console.error(error.format(displayOptions))
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
    } catch (hookError) {
      if (hookError instanceof HookError) {
        const deployError = new DeployError({
          code: 'IX_E304',
          message: `Post-deploy hook failed: ${hookError.message}`,
          causes: [
            'Hook script returned non-zero exit code',
            'Hook script threw an error',
            'Deployment succeeded but hook failed',
          ],
          fixes: [
            'Check hook script for errors',
            'Ensure hook commands are executable',
            'Note: Your deployment was successful',
          ],
          originalError: hookError,
        })
        const displayOptions = detectDisplayOptions()
        console.error(deployError.format(displayOptions))
        return { success: false, url: result.url, versionId: result.versionId, exitCode: 1 }
      }
    }

    return { success: true, url: result.url, versionId: result.versionId, exitCode: 0 }
  } catch (error) {
    const deployError = new DeployError({
      code: 'IX_E901',
      message: 'Unexpected deployment error',
      causes: [error instanceof Error ? error.message : String(error)],
      fixes: [
        'Run with `--verbose` for detailed output',
        'Check your internet connection',
        'Try again in a few moments',
        'Report issue if it persists: https://github.com/ixflare/ixflare/issues',
      ],
      originalError: error instanceof Error ? error : undefined,
    })
    const displayOptions = detectDisplayOptions()
    console.error(deployError.format(displayOptions))
    return { success: false, exitCode: 1 }
  }
}
