/**
 * @module commands/preview
 * @description Production preview command
 * @node-only
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'
import prompts from 'prompts'

// Import validation and port utilities from dev.ts
import {
  isValidPort,
  MIN_PORT,
  MAX_PORT,
  isPortAvailable,
  findAvailablePort,
  displayPortConflictMessage,
} from './dev.js'

export interface PreviewOptions {
  port?: number
  env?: string
  open?: boolean
  yes?: boolean // Skip confirmation prompts (for CI/automation)
  help?: boolean // Display help text
}

/** Valid port range constants */
const DEFAULT_PORT = 3001 // Different from dev (3000)

/**
 * Check if an environment name indicates production
 * Matches: production, prod, Production, PRODUCTION, prod-us-east, etc.
 */
export function isProductionEnv(env: string): boolean {
  const normalized = env.toLowerCase()
  return (
    normalized === 'production' ||
    normalized === 'prod' ||
    normalized.startsWith('prod-') ||
    normalized.startsWith('production-')
  )
}

/**
 * Parse preview command CLI arguments
 * Follows same pattern as dev.ts and build.ts
 */
export function parsePreviewArgs(args: string[]): PreviewOptions {
  const options: PreviewOptions = {
    port: DEFAULT_PORT,
    open: false,
    yes: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--port' && args[i + 1]) {
      const portValue = parseInt(args[i + 1], 10)
      if (!isValidPort(portValue)) {
        console.error(pc.red(`Invalid port: "${args[i + 1]}"`))
        console.error(pc.dim(`Port must be an integer between ${MIN_PORT} and ${MAX_PORT}`))
        process.exit(1)
      }
      options.port = portValue
      i++
    } else if (arg === '--env' && args[i + 1]) {
      options.env = args[i + 1]
      i++
    } else if (arg === '--open') {
      options.open = true
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true
    }
  }

  return options
}

/**
 * Display production preview banner
 */
function displayPreviewBanner(options: { port: number; env?: string }): void {
  const { port, env } = options
  const localUrl = `http://localhost:${port}`

  console.log('')
  console.log('  ╭─────────────────────────────────────────╮')
  console.log('  │                                         │')
  console.log('  │   ' + pc.cyan(pc.bold('Production Preview')) + '           │')
  console.log('  │                                         │')
  console.log('  │   ' + pc.green('✓') + ' Using production build from dist/   │')

  if (env) {
    // Truncate long env names to fit banner, use Math.max to prevent negative padding
    const displayEnv = env.length > 14 ? env.slice(0, 11) + '...' : env
    console.log(
      '  │   ' +
        pc.green('✓') +
        ' Remote environment: ' +
        pc.cyan(displayEnv) +
        ''.padEnd(Math.max(0, 16 - displayEnv.length)) +
        '│'
    )
  } else {
    console.log('  │   ' + pc.green('✓') + ' Miniflare simulating Workers env    │')
    console.log('  │   ' + pc.green('✓') + ' D1 using local SQLite database      │')
  }

  console.log('  │                                         │')
  console.log(
    '  │   ' +
      pc.green('➜') +
      '  Preview: ' +
      pc.cyan(localUrl) +
      ''.padEnd(27 - localUrl.length) +
      '│'
  )
  console.log('  │                                         │')
  console.log('  │   ' + pc.dim('Note: This simulates production') + '       │')
  console.log('  │   ' + pc.dim('behavior locally.') + '                    │')
  console.log('  │                                         │')
  console.log('  ╰─────────────────────────────────────────╯')
  console.log('')
}

/**
 * Display help text for the preview command
 */
function displayHelp(): void {
  console.log('')
  console.log(pc.bold('Usage:') + ' ix preview [options]')
  console.log('')
  console.log(pc.bold('Description:'))
  console.log('  Preview production build locally using Miniflare/Wrangler.')
  console.log("  Unlike 'ix dev', this runs the built output without HMR.")
  console.log('')
  console.log(pc.bold('Options:'))
  console.log('  --port <number>   Port to serve preview on (default: 3001)')
  console.log('  --env <name>      Connect to remote bindings for that environment')
  console.log('  --open            Open browser automatically')
  console.log('  --yes, -y         Skip confirmation prompts (for CI/automation)')
  console.log('  --help, -h        Show this help message')
  console.log('')
  console.log(pc.bold('Examples:'))
  console.log(pc.dim('  # Preview with local simulation'))
  console.log('  ix preview')
  console.log('')
  console.log(pc.dim('  # Preview on custom port'))
  console.log('  ix preview --port 4000')
  console.log('')
  console.log(pc.dim('  # Preview with production data (requires confirmation)'))
  console.log('  ix preview --env production')
  console.log('')
  console.log(pc.dim('  # Preview with production data in CI (skip prompt)'))
  console.log('  ix preview --env production --yes')
  console.log('')
}

/**
 * Check if running in a non-interactive environment
 */
function isNonInteractive(): boolean {
  return !process.stdout.isTTY || process.env.CI === 'true' || process.env.CI === '1'
}

/**
 * Display production data warning and get user confirmation
 * Returns false if in non-interactive mode without --yes flag
 */
async function confirmProductionAccess(env: string, skipPrompt: boolean): Promise<boolean> {
  // If --yes flag provided, skip prompt in any mode
  if (skipPrompt) {
    console.log(pc.yellow('  ⚠️  WARNING: Connected to PRODUCTION data'))
    console.log(pc.dim('  Confirmation skipped via --yes flag'))
    console.log('')
    return true
  }

  // In non-interactive environments without --yes, fail with clear error
  if (isNonInteractive()) {
    console.error('')
    console.error(pc.red('  ✗ Cannot prompt for confirmation in non-interactive mode'))
    console.error(
      pc.dim('  Use ') + pc.cyan('--yes') + pc.dim(' flag to skip confirmation in CI/automation')
    )
    console.error('')
    return false
  }

  // Interactive mode: show warning and prompt for confirmation
  console.log('')
  console.log(pc.yellow('  ⚠️  WARNING: Connected to PRODUCTION data'))
  console.log(pc.dim('  Changes will affect live data. Use with caution.'))
  console.log('')

  const response = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `Connect to ${env} environment?`,
    initial: false,
  })

  return response.confirmed
}

/**
 * Main preview command
 * Runs production build in local Workers simulation or connects to remote environment
 */
export async function preview(options: PreviewOptions = {}): Promise<void> {
  // Parse CLI args if not provided as options
  const cliArgs = process.argv.slice(3)
  const parsedOptions = { ...parsePreviewArgs(cliArgs), ...options }

  const { port = DEFAULT_PORT, env, open, yes, help } = parsedOptions

  // Handle help flag
  if (help) {
    displayHelp()
    return
  }

  // Validate dist/ directory exists
  const distPath = resolve(process.cwd(), 'dist')
  if (!existsSync(distPath)) {
    console.error('')
    console.error(pc.red('  ✗ dist/ directory not found'))
    console.error(
      pc.dim('  Run ') + pc.cyan('ix build') + pc.dim(' first to create production build')
    )
    console.error('')
    process.exit(1)
  }

  // Check if worker entry point exists
  const workerPath = resolve(distPath, '_worker', 'index.js')
  if (!existsSync(workerPath)) {
    console.error('')
    console.error(pc.red('  ✗ Production build not found'))
    console.error(pc.dim('  Expected: ') + pc.cyan('dist/_worker/index.js'))
    console.error(
      pc.dim('  Run ') + pc.cyan('ix build') + pc.dim(' first to create production build')
    )
    console.error('')
    process.exit(1)
  }

  // Check port availability (consistent with ix dev behavior)
  let actualPort = port
  const portAvailable = await isPortAvailable(port)
  if (!portAvailable) {
    try {
      const suggestedPort = await findAvailablePort(port + 1)
      displayPortConflictMessage(port, suggestedPort)
      actualPort = suggestedPort
    } catch {
      console.error('')
      console.error(pc.red(`  ✗ Port ${port} is in use and no available ports found`))
      console.error('')
      process.exit(1)
    }
  }

  // Show production data warning for remote environments
  if (env && isProductionEnv(env)) {
    const confirmed = await confirmProductionAccess(env, yes ?? false)
    if (!confirmed) {
      console.log(pc.dim('  Preview cancelled'))
      console.log('')
      process.exit(0)
    }
  }

  // Display banner
  displayPreviewBanner({ port: actualPort, env })

  // Build wrangler arguments
  const wranglerArgs = ['wrangler', 'dev', workerPath]

  // Local vs remote mode
  if (env) {
    // Remote mode - connect to Cloudflare resources
    wranglerArgs.push('--remote')
    wranglerArgs.push('--env', env)
  } else {
    // Local mode - simulate Workers environment
    wranglerArgs.push('--local')
    wranglerArgs.push('--persist-to', '.wrangler/state')
  }

  // Add port
  wranglerArgs.push('--port', actualPort.toString())

  // Add open flag if requested
  if (open) {
    wranglerArgs.push('--open')
  }

  // Wrap main server logic in a Promise that resolves on exit
  return new Promise<void>((resolvePromise, rejectPromise) => {
    // SECURITY: shell: false prevents command injection (OWASP A03)
    const previewProcess: ChildProcess = spawn('npx', wranglerArgs, {
      stdio: 'inherit',
      shell: false,
      cwd: process.cwd(),
    })

    // Watch dist/ directory and warn on changes (Task 4.1)
    // This is PREVIEW mode, not dev mode - no auto-reload
    let lastChangeWarning = 0
    const watcher = watch(distPath, { recursive: true }, (_eventType, filename) => {
      // Throttle warnings to once per 2 seconds
      const now = Date.now()
      if (now - lastChangeWarning > 2000) {
        console.log('')
        console.log(pc.yellow('  ⚠️  dist/ directory changed'))
        if (filename) {
          console.log(pc.dim(`  Changed: ${filename}`))
        }
        console.log(pc.dim('  Run ') + pc.cyan('ix build') + pc.dim(' to see changes'))
        console.log('')
        lastChangeWarning = now
      }
    })

    // Handle process cleanup
    const cleanup = (): void => {
      watcher.close()
      if (previewProcess && !previewProcess.killed) {
        previewProcess.kill('SIGTERM')
      }
      resolvePromise()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    previewProcess.on('exit', (code) => {
      watcher.close()
      // Remove signal handlers to prevent memory leaks
      process.removeListener('SIGINT', cleanup)
      process.removeListener('SIGTERM', cleanup)

      if (code !== 0 && code !== null) {
        console.error(pc.red(`Preview server exited with code ${code}`))
        rejectPromise(new Error(`Preview server exited with code ${code}`))
      } else {
        resolvePromise()
      }
    })

    previewProcess.on('error', (error) => {
      watcher.close()
      console.error(pc.red(`  ✗ Failed to start preview server: ${error.message}`))
      rejectPromise(error)
    })
  })
}
