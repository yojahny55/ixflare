/**
 * @module utils/wrangler-exec
 * @description Wrangler subprocess execution utilities
 */

import { spawn } from 'child_process'

export interface DeploymentResult {
  success: boolean
  url?: string
  versionId?: string
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Execute wrangler deploy command with optional environment
 */
export async function executeWranglerDeploy(environment?: string): Promise<DeploymentResult> {
  return new Promise((resolve) => {
    const args = ['deploy']

    if (environment && environment !== 'production') {
      args.push('--env', environment)
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

    wrangler.on('close', (exitCode) => {
      const result = {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      }

      resolve(result)
    })
  })
}
