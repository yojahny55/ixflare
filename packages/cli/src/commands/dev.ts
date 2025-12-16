/**
 * @module commands/dev
 * @description Development server command
 * @node-only
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { networkInterfaces } from 'node:os'
import pc from 'picocolors'

export interface DevOptions {
  port?: number
  host?: string
  open?: boolean
}

export interface BannerOptions {
  port: number
  networkAddress?: string
  startTime: number
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        resolve(false)
      }
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port)
  })
}

/**
 * Find next available port starting from the given port
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort
  const maxAttempts = 10

  for (let i = 0; i < maxAttempts; i++) {
    const available = await isPortAvailable(port)
    if (available) {
      return port
    }
    port++
  }

  throw new Error(`Could not find available port after ${maxAttempts} attempts starting from ${startPort}`)
}

/**
 * Get the local network IP address
 */
export function getNetworkAddress(): string | undefined {
  const nets = networkInterfaces()

  for (const name of Object.keys(nets)) {
    const net = nets[name]
    if (!net) continue

    for (const iface of net) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }

  return undefined
}

/**
 * Display the Ixflare development server banner
 */
export function displayBanner(options: BannerOptions): void {
  const { port, networkAddress, startTime } = options

  console.log('')
  console.log('  ╭─────────────────────────────────────────╮')
  console.log('  │                                         │')
  console.log('  │   ' + pc.cyan(pc.bold('Ixflare')) + ' v0.0.1                        │')
  console.log('  │                                         │')
  console.log(
    '  │   ' + pc.green('➜') + '  Local:   ' + pc.cyan(`http://localhost:${port}`) + '     │'
  )

  if (networkAddress) {
    const networkUrl = `http://${networkAddress}:${port}`
    // Pad to match banner width
    const padding = ' '.repeat(Math.max(0, 33 - networkUrl.length))
    console.log('  │   ' + pc.green('➜') + '  Network: ' + pc.cyan(networkUrl) + padding + '│')
  }

  console.log('  │                                         │')
  console.log('  │   ' + pc.dim(`Ready in ${startTime}ms`) + '                        │')
  console.log('  │                                         │')
  console.log('  ╰─────────────────────────────────────────╯')
  console.log('')
}

/**
 * Display port conflict error message
 */
export function displayPortConflictMessage(occupiedPort: number, suggestedPort: number): void {
  console.error('')
  console.error(pc.red('Port ' + occupiedPort + ' is in use.') + ' Suggestions:')
  console.error(pc.dim('  • Use ') + pc.cyan(`--port ${suggestedPort}`) + pc.dim(' (next available)'))
  console.error(pc.dim('  • Kill process on ') + occupiedPort + pc.dim(': ') + pc.yellow(`lsof -ti:${occupiedPort} | xargs kill -9`))
  console.error('')
  process.exit(1)
}

/**
 * Parse development server CLI arguments
 */
export function parseDevArgs(args: string[]): DevOptions {
  const options: DevOptions = {
    port: 3000,
    open: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--port' && args[i + 1]) {
      options.port = parseInt(args[i + 1], 10)
      i++
    } else if (arg === '--host' && args[i + 1]) {
      options.host = args[i + 1]
      i++
    } else if (arg === '--open') {
      options.open = true
    }
  }

  return options
}

/**
 * Main development server command
 */
export async function dev(options: DevOptions = {}): Promise<void> {
  const startTime = Date.now()

  // Parse CLI args if not provided as options
  const cliArgs = process.argv.slice(3)
  const parsedOptions = { ...parseDevArgs(cliArgs), ...options }

  const { port = 3000, host, open } = parsedOptions

  // Check if port is available
  const available = await isPortAvailable(port)

  if (!available) {
    const nextPort = await findAvailablePort(port + 1)
    displayPortConflictMessage(port, nextPort)
    return
  }

  // Get network address for display
  const networkAddress = getNetworkAddress()

  // Build Vite arguments
  const viteArgs = ['vite', '--port', port.toString()]

  if (host) {
    viteArgs.push('--host', host)
  }

  if (open) {
    viteArgs.push('--open')
  }

  // Spawn Vite dev server
  const viteProcess: ChildProcess = spawn('npx', viteArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })

  // Calculate startup time
  const duration = Date.now() - startTime

  // Display banner
  displayBanner({
    port,
    networkAddress,
    startTime: duration,
  })

  // Handle process cleanup
  const cleanup = (): void => {
    if (viteProcess && !viteProcess.killed) {
      viteProcess.kill('SIGTERM')
    }
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  viteProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(pc.red(`Dev server exited with code ${code}`))
      process.exit(code)
    }
  })
}
