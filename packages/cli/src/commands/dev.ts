/**
 * @module commands/dev
 * @description Development server command
 * @node-only
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'
import pc from 'picocolors'

/** Valid port range constants */
const MIN_PORT = 1
const MAX_PORT = 65535

/** Default version fallback */
const DEFAULT_VERSION = '0.0.0'

/**
 * Regex pattern for valid hostnames/IP addresses
 * Allows: IPv4 addresses, IPv6 addresses, hostnames, and special values like '0.0.0.0'
 * SECURITY: Prevents command injection by only allowing safe characters
 */
const VALID_HOST_PATTERN = /^(?:(?:localhost|0\.0\.0\.0|true|\d{1,3}(?:\.\d{1,3}){3})|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)|(?:\[[\da-fA-F:]+\]))$/

/**
 * Validate host argument to prevent command injection
 * @param host - Host string from CLI argument
 * @returns true if host is valid and safe
 */
export function isValidHost(host: string): boolean {
  // Host must match safe pattern (no shell metacharacters)
  return VALID_HOST_PATTERN.test(host)
}

export interface DevOptions {
  port?: number
  host?: string
  open?: boolean
}

export interface BannerOptions {
  port: number
  networkAddress?: string
  startTime: number
  version: string
}

/**
 * Get the Ixflare version from the root package.json
 * Traverses up from cwd to find the monorepo root package.json
 */
export function getVersion(): string {
  try {
    // Try to read from the project's package.json first (user's project)
    const projectPkgPath = resolve(process.cwd(), 'package.json')
    const projectPkg = JSON.parse(readFileSync(projectPkgPath, 'utf-8'))

    // If the project has ixflare as a dependency, try to get its version
    const ixflareDep = projectPkg.dependencies?.ixflare || projectPkg.devDependencies?.ixflare
    if (ixflareDep && !ixflareDep.startsWith('workspace:')) {
      // Extract version from semver string (e.g., "^1.0.0" -> "1.0.0")
      const match = ixflareDep.match(/\d+\.\d+\.\d+/)
      if (match) return match[0]
    }

    // For monorepo development, read from root package.json
    // This handles the case when running from within the ixflare monorepo
    if (projectPkg.name === 'ixflare' && projectPkg.version) {
      return projectPkg.version
    }

    return DEFAULT_VERSION
  } catch {
    return DEFAULT_VERSION
  }
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    // Issue #5 fix: Simplified error handling - all errors mean port unavailable
    server.once('error', () => {
      resolve(false)
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

/** Fixed banner content width (excluding box borders) */
const BANNER_CONTENT_WIDTH = 37

/**
 * Create a padded banner line with proper alignment
 * @param text - Raw text content (without ANSI codes)
 * @returns Padded string with trailing spaces
 * @internal
 */
function padLine(text: string): string {
  if (text.length >= BANNER_CONTENT_WIDTH) {
    // Truncate with ellipsis for overly long content
    return text.slice(0, BANNER_CONTENT_WIDTH - 3) + '...'
  }
  return text + ' '.repeat(BANNER_CONTENT_WIDTH - text.length)
}

/**
 * Display the Ixflare development server banner
 * Issue #1 fix: Dynamic padding that properly handles varying URL lengths
 */
export function displayBanner(options: BannerOptions): void {
  const { port, networkAddress, startTime, version } = options

  const localUrl = `http://localhost:${port}`
  const localText = `Local:   ${localUrl}`

  console.log('')
  console.log('  ╭─────────────────────────────────────────╮')
  console.log('  │                                         │')
  console.log('  │   ' + pc.cyan(pc.bold('Ixflare')) + ` v${version}` + ' '.repeat(Math.max(0, 28 - version.length)) + '│')
  console.log('  │                                         │')

  // Local URL line - "➜  " prefix is 3 chars, content area is 37
  const localPadded = padLine(localText)
  console.log('  │   ' + pc.green('➜') + '  ' + localPadded.replace(localUrl, pc.cyan(localUrl)) + '│')

  if (networkAddress) {
    const networkUrl = `http://${networkAddress}:${port}`
    const networkText = `Network: ${networkUrl}`
    const networkPadded = padLine(networkText)
    console.log('  │   ' + pc.green('➜') + '  ' + networkPadded.replace(networkUrl, pc.cyan(networkUrl)) + '│')
  }

  console.log('  │                                         │')
  const readyText = `Ready in ${startTime}ms`
  console.log('  │   ' + pc.dim(padLine(readyText)) + '│')
  console.log('  │                                         │')
  console.log('  ╰─────────────────────────────────────────╯')
  console.log('')
}

/**
 * Display port conflict error message
 * Issue #6 fix: No longer calls process.exit - caller handles exit
 */
export function displayPortConflictMessage(occupiedPort: number, suggestedPort: number): void {
  console.error('')
  console.error(pc.red('Port ' + occupiedPort + ' is in use.') + ' Suggestions:')
  console.error(pc.dim('  • Use ') + pc.cyan(`--port ${suggestedPort}`) + pc.dim(' (next available)'))
  console.error(pc.dim('  • Kill process on ') + occupiedPort + pc.dim(': ') + pc.yellow(`lsof -ti:${occupiedPort} | xargs kill -9`))
  console.error('')
}

/**
 * Validate that a port number is within valid range
 * Issue #2 fix: Added port validation
 */
export function isValidPort(port: number): boolean {
  return !isNaN(port) && Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT
}

/**
 * Parse development server CLI arguments
 * Issue #2 fix: Added port validation with clear error messages
 */
export function parseDevArgs(args: string[]): DevOptions {
  const options: DevOptions = {
    port: 3000,
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
    } else if (arg === '--host' && args[i + 1]) {
      const hostValue = args[i + 1]

      // SECURITY: Validate host to prevent command injection (OWASP A03)
      if (!isValidHost(hostValue)) {
        console.error(pc.red(`Invalid host: "${hostValue}"`))
        console.error(pc.dim('Host must be a valid hostname, IPv4, or IPv6 address'))
        process.exit(1)
      }

      options.host = hostValue
      i++
    } else if (arg === '--open') {
      options.open = true
    }
  }

  return options
}

/**
 * Main development server command
 * Issue #3 fix: Properly measure startup time by detecting Vite ready signal
 */
export async function dev(options: DevOptions = {}): Promise<void> {
  const startTime = Date.now()

  // Parse CLI args if not provided as options
  const cliArgs = process.argv.slice(3)
  const parsedOptions = { ...parseDevArgs(cliArgs), ...options }

  const { port = 3000, host, open } = parsedOptions

  // Get version from package.json
  const version = getVersion()

  // Check if port is available
  const available = await isPortAvailable(port)

  if (!available) {
    const nextPort = await findAvailablePort(port + 1)
    displayPortConflictMessage(port, nextPort)
    // Issue #6 fix: Caller handles exit after display function
    process.exit(1)
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

  // Issue #3 fix: Use piped stdio to detect Vite ready signal
  // SECURITY: shell: false prevents command injection (OWASP A03)
  // Host argument is validated in parseDevArgs before reaching here
  const viteProcess: ChildProcess = spawn('npx', viteArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
    cwd: process.cwd(),
  })

  let bannerDisplayed = false

  // Handle stdout - look for Vite ready signal and forward output
  viteProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString()

    // Detect Vite ready signal (usually contains "ready in" or shows the local URL)
    if (!bannerDisplayed && (output.includes('ready in') || output.includes('Local:'))) {
      const duration = Date.now() - startTime
      displayBanner({
        port,
        networkAddress,
        startTime: duration,
        version,
      })
      bannerDisplayed = true
    }

    // Forward Vite output to console
    process.stdout.write(data)
  })

  // Forward stderr
  viteProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data)
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
    // If banner wasn't displayed (Vite failed to start), show it now with CLI time
    if (!bannerDisplayed) {
      const duration = Date.now() - startTime
      displayBanner({
        port,
        networkAddress,
        startTime: duration,
        version,
      })
    }

    if (code !== 0 && code !== null) {
      console.error(pc.red(`Dev server exited with code ${code}`))
      process.exit(code)
    }
  })
}
