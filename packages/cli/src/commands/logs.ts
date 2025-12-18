/**
 * Logs command - Stream real-time logs from Cloudflare Workers
 */

import pc from 'picocolors'
import type { LogsOptions } from './logs/types.js'
import {
  resolveWorkerName,
  validateWorkerName,
  formatLogEntry,
  formatLogEntryJson,
  WranglerTailBridge,
} from './logs/index.js'

/**
 * Parses command line arguments for logs command
 */
function parseArgs(args: string[]): LogsOptions {
  const options: LogsOptions = {
    tail: !args.includes('--no-tail'),
    format: 'pretty',
    help: args.includes('--help') || args.includes('-h'),
  }

  // Helper to get flag value
  const getFlag = (flag: string): string | undefined => {
    const index = args.indexOf(flag)
    return index !== -1 && args[index + 1] ? args[index + 1] : undefined
  }

  // Helper to get number flag
  const getNumberFlag = (flag: string): number | undefined => {
    const value = getFlag(flag)
    if (value) {
      const num = parseInt(value, 10)
      return isNaN(num) ? undefined : num
    }
    return undefined
  }

  // Parse all flags
  options.worker = getFlag('--worker')
  options.filter = getFlag('--filter')
  options.status = getFlag('--status') as LogsOptions['status']
  options.method = getFlag('--method')
  options.ip = getFlag('--ip')
  options.env = getFlag('--env')
  options.format = (getFlag('--format') || 'pretty') as 'pretty' | 'json'
  options.samplingRate = getNumberFlag('--sampling-rate')
  options.since = getFlag('--since')
  options.until = getFlag('--until')

  return options
}

/**
 * Shows help message for logs command
 */
function showHelp(): void {
  console.log(`
${pc.bold('Usage:')} ix logs [options]

${pc.bold('Description:')}
  Stream real-time logs from your deployed Cloudflare Worker.

${pc.bold('Options:')}
  --worker <name>       Worker name (auto-detected from config)
  --env <env>           Environment (default: production)
  --filter <text>       Filter logs by text content
  --status <status>     Filter by status: ok, error, canceled
  --method <method>     Filter by HTTP method: GET, POST, etc.
  --ip <address>        Filter by client IP (use "self" for your IP)
  --format <format>     Output format: pretty (default), json
  --sampling-rate <n>   Percentage of requests to show (0-100)
  --since <time>        ${pc.dim('(Not supported)')} Historical start time
  --until <time>        ${pc.dim('(Not supported)')} Historical end time
  --help, -h            Show this help message

${pc.bold('Examples:')}
  ix logs                         ${pc.dim('# Stream all production logs')}
  ix logs --env staging           ${pc.dim('# Stream staging logs')}
  ix logs --filter "error"        ${pc.dim('# Show logs containing "error"')}
  ix logs --status error          ${pc.dim('# Show only error responses')}
  ix logs --method POST           ${pc.dim('# Show only POST requests')}
  ix logs --format json           ${pc.dim('# Output as JSON lines')}
  ix logs --sampling-rate 10      ${pc.dim('# Sample 10% of requests')}

${pc.bold('Notes:')}
  ${pc.dim('•')} Maximum 10 concurrent log streams per worker
  ${pc.dim('•')} High-traffic workers may automatically enter sampling mode
  ${pc.dim('•')} Historical logs require Cloudflare Dashboard (wrangler tail is real-time only)
  ${pc.dim('•')} Press Ctrl+C to stop streaming
`)
}

/**
 * Validates options and warns about unsupported features
 */
function validateOptions(options: LogsOptions): void {
  // --since and --until are not supported by wrangler tail
  if (options.since || options.until) {
    console.log(
      pc.yellow(
        '\n⚠️  Historical log retrieval (--since/--until) is not supported by wrangler tail.'
      )
    )
    console.log(
      pc.dim('   Real-time logs do not persist. Use Cloudflare Dashboard for historical logs.')
    )
    console.log(pc.dim('   These flags will be ignored.\n'))
  }
}

/**
 * Shows header with active filters and settings
 */
function showHeader(workerName: string, options: LogsOptions): void {
  console.log()
  console.log(`Streaming logs from: ${pc.cyan(workerName)} (${options.env || 'production'})`)

  if (options.filter) {
    console.log(`${pc.dim('Filter:')} ${pc.yellow(options.filter)}`)
  }
  if (options.status) {
    console.log(`${pc.dim('Status:')} ${options.status}`)
  }
  if (options.method) {
    console.log(`${pc.dim('Method:')} ${options.method}`)
  }
  if (options.ip) {
    console.log(`${pc.dim('IP:')} ${options.ip}`)
  }
  if (options.samplingRate && options.samplingRate < 100) {
    console.log(pc.yellow(`⚠️  Sampling at ${options.samplingRate}% of requests`))
  }

  console.log()
}

/**
 * Main logs command handler
 */
export async function logs(): Promise<void> {
  const args = process.argv.slice(3)
  const options = parseArgs(args)

  // Show help if requested
  if (options.help) {
    showHelp()
    return
  }

  try {
    // Validate options and warn about unsupported features
    validateOptions(options)

    // Resolve worker name
    const workerName = options.worker || resolveWorkerName()
    validateWorkerName(workerName)

    // Show header (unless JSON format)
    if (options.format === 'pretty') {
      showHeader(workerName, options)
    }

    // Create and start wrangler bridge
    const bridge = new WranglerTailBridge()

    // Handle log entries
    bridge.on('log', (entry) => {
      if (options.format === 'json') {
        console.log(formatLogEntryJson(entry))
      } else {
        console.log(formatLogEntry(entry))
      }
    })

    // Handle status messages (only in pretty mode)
    if (options.format === 'pretty') {
      bridge.on('status', (message) => {
        console.log(pc.dim(message))
      })

      bridge.on('reconnecting', () => {
        console.log(pc.yellow('\n⚠️  Connection lost. Reconnecting...'))
      })

      bridge.on('reconnected', () => {
        console.log(pc.green('✓ Reconnected to log stream\n'))
      })
    }

    // Handle errors
    bridge.on('error', (error) => {
      console.error(pc.red(`\nError: ${error.message}`))

      if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
        console.error(pc.dim('\nWrangler not found. Install it with:'))
        console.error(pc.dim('  npm install -g wrangler'))
      }
    })

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      if (options.format === 'pretty') {
        console.log(pc.dim('\nStopping log stream...'))
      }
      bridge.stop()
      process.exit(0)
    })

    // Start streaming
    bridge.start(workerName, options)

    // Show footer (only in pretty mode)
    if (options.format === 'pretty') {
      console.log(pc.dim('Press Ctrl+C to stop...\n'))
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red(`\nError: ${error.message}\n`))
    } else {
      console.error(pc.red('\nAn unexpected error occurred\n'))
    }
    process.exit(1)
  }
}
