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

// Import validation utilities from dev.ts
import { isValidPort, MIN_PORT, MAX_PORT } from './dev.js'

export interface PreviewOptions {
  port?: number
  env?: string
  open?: boolean
}

/** Valid port range constants */
const DEFAULT_PORT = 3001 // Different from dev (3000)

/**
 * Parse preview command CLI arguments
 * Follows same pattern as dev.ts and build.ts
 */
export function parsePreviewArgs(args: string[]): PreviewOptions {
  const options: PreviewOptions = {
    port: DEFAULT_PORT,
    open: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--port' && args[i + 1]) {
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
    console.log('  │   ' + pc.green('✓') + ' Remote environment: ' + pc.cyan(env) + ''.padEnd(16 - env.length) + '│')
  } else {
    console.log('  │   ' + pc.green('✓') + ' Miniflare simulating Workers env    │')
    console.log('  │   ' + pc.green('✓') + ' D1 using local SQLite database      │')
  }

  console.log('  │                                         │')
  console.log('  │   ' + pc.green('➜') + '  Preview: ' + pc.cyan(localUrl) + ''.padEnd(27 - localUrl.length) + '│')
  console.log('  │                                         │')
  console.log('  │   ' + pc.dim('Note: This simulates production') + '       │')
  console.log('  │   ' + pc.dim('behavior locally.') + '                    │')
  console.log('  │                                         │')
  console.log('  ╰─────────────────────────────────────────╯')
  console.log('')
}

/**
 * Display production data warning and get user confirmation
 */
async function confirmProductionAccess(env: string): Promise<boolean> {
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

  const { port = DEFAULT_PORT, env, open } = parsedOptions

  // Validate dist/ directory exists
  const distPath = resolve(process.cwd(), 'dist')
  if (!existsSync(distPath)) {
    console.error('')
    console.error(pc.red('  ✗ dist/ directory not found'))
    console.error(pc.dim('  Run ') + pc.cyan('ix build') + pc.dim(' first to create production build'))
    console.error('')
    process.exit(1)
  }

  // Check if worker entry point exists
  const workerPath = resolve(distPath, '_worker', 'index.js')
  if (!existsSync(workerPath)) {
    console.error('')
    console.error(pc.red('  ✗ Production build not found'))
    console.error(pc.dim('  Expected: ') + pc.cyan('dist/_worker/index.js'))
    console.error(pc.dim('  Run ') + pc.cyan('ix build') + pc.dim(' first to create production build'))
    console.error('')
    process.exit(1)
  }

  // Show production data warning for remote environments
  if (env === 'production') {
    const confirmed = await confirmProductionAccess(env)
    if (!confirmed) {
      console.log(pc.dim('  Preview cancelled'))
      console.log('')
      process.exit(0)
    }
  }

  // Display banner
  displayPreviewBanner({ port, env })

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
  wranglerArgs.push('--port', port.toString())

  // Add open flag if requested
  if (open) {
    wranglerArgs.push('--open')
  }

  // SECURITY: shell: false prevents command injection (OWASP A03)
  const previewProcess: ChildProcess = spawn('npx', wranglerArgs, {
    stdio: 'inherit',
    shell: false,
    cwd: process.cwd(),
  })

  // Watch dist/ directory and warn on changes (Task 4.1)
  // This is PREVIEW mode, not dev mode - no auto-reload
  let lastChangeWarning = 0
  const watcher = watch(distPath, { recursive: true }, (_eventType, _filename) => {
    // Throttle warnings to once per 2 seconds
    const now = Date.now()
    if (now - lastChangeWarning > 2000) {
      console.log('')
      console.log(pc.yellow('  ⚠️  dist/ directory changed'))
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
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  previewProcess.on('exit', (code) => {
    watcher.close()
    if (code !== 0 && code !== null) {
      console.error(pc.red(`Preview server exited with code ${code}`))
      process.exit(code)
    }
  })
}
