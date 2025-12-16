/**
 * @module utils/wrangler-exec
 * @description Wrangler subprocess execution utilities
 */

import { spawn } from 'child_process'
import { rmSync } from 'fs'

export interface DeploymentResult {
  success: boolean
  url?: string
  versionId?: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface WranglerDeployOptions {
  environment?: string
  minify?: boolean
  vars?: Record<string, string>
}

/**
 * Execute wrangler deploy command with optional environment and flags
 */
export async function executeWranglerDeploy(options: WranglerDeployOptions = {}): Promise<DeploymentResult> {
  return new Promise((resolve) => {
    const args = ['deploy']

    if (options.environment && options.environment !== 'production') {
      args.push('--env', options.environment)
    }

    if (options.minify) {
      args.push('--minify')
    }

    if (options.vars) {
      for (const [key, value] of Object.entries(options.vars)) {
        args.push('--var', `${key}:${value}`)
      }
    }

    const wrangler = spawn('wrangler', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''

    wrangler.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      process.stdout.write(text) // Stream to console
    })

    wrangler.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      process.stderr.write(text)
    })

    wrangler.on('error', (err) => {
      resolve({
        success: false,
        stdout,
        stderr: stderr || err.message,
        exitCode: 1,
      })
    })

    wrangler.on('close', (exitCode) => {
      const result = {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
        url: parseDeploymentUrl(stdout),
        versionId: parseVersionId(stdout),
      }

      resolve(result)
    })
  })
}

/**
 * Parse deployment URL from wrangler output
 */
function parseDeploymentUrl(stdout: string): string | undefined {
  // Match: https://my-app.subdomain.workers.dev or custom domains
  const urlMatch = stdout.match(/https:\/\/[\w-]+\.[\w.-]+\.workers\.dev/i)
  return urlMatch?.[0]
}

/**
 * Parse version ID from wrangler output
 */
function parseVersionId(stdout: string): string | undefined {
  // Match: Version ID: abc123-def456
  const versionMatch = stdout.match(/Version ID:\s+([\w-]+)/i)
  return versionMatch?.[1]
}

/**
 * Execute wrangler deploy with dry-run flag
 */
export async function executeWranglerDryRun(): Promise<DeploymentResult> {
  return new Promise((resolve) => {
    const args = ['deploy', '--dry-run', '--outdir', '.wrangler-dry-run']

    const wrangler = spawn('wrangler', args, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''

    wrangler.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    wrangler.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    wrangler.on('error', (err) => {
      resolve({
        success: false,
        stdout,
        stderr: stderr || err.message,
        exitCode: 1,
      })
    })

    wrangler.on('close', (exitCode) => {
      const result = {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      }

      // Clean up dry-run output directory
      cleanupDryRunOutput()

      resolve(result)
    })
  })
}

/**
 * Clean up the dry-run output directory
 */
function cleanupDryRunOutput(): void {
  try {
    rmSync('.wrangler-dry-run', { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}
