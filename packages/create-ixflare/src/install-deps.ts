/**
 * @module install-deps
 * @description Dependency installation with spawn wrapper
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageManager } from './types'
import { colors } from './utils'

/** Spinner frames for progress indication */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/**
 * Create a simple spinner for progress indication
 */
function createSpinner(message: string): { stop: (success: boolean, finalMessage?: string) => void } {
  let frameIndex = 0
  const isTTY = process.stdout.isTTY

  if (!isTTY) {
    console.log(message)
    return {
      stop: (success: boolean, finalMessage?: string) => {
        if (finalMessage) {
          console.log(finalMessage)
        }
      },
    }
  }

  const interval = setInterval(() => {
    process.stdout.write(`\r${colors.cyan(SPINNER_FRAMES[frameIndex])} ${message}`)
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length
  }, 80)

  return {
    stop: (success: boolean, finalMessage?: string) => {
      clearInterval(interval)
      const symbol = success ? colors.green('✓') : colors.red('✗')
      const msg = finalMessage ?? message
      process.stdout.write(`\r${symbol} ${msg}\n`)
    },
  }
}

/**
 * Get the install command arguments for a package manager
 */
function getInstallArgs(pm: PackageManager): string[] {
  switch (pm) {
    case 'pnpm':
      return ['install']
    case 'bun':
      return ['install']
    case 'npm':
    default:
      return ['install']
  }
}

/**
 * Run a command and return a promise
 */
function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })

    let output = ''

    child.stdout?.on('data', (data) => {
      output += data.toString()
    })

    child.stderr?.on('data', (data) => {
      output += data.toString()
    })

    child.on('error', (error) => {
      resolve({
        success: false,
        output: `Failed to start ${command}: ${error.message}`,
      })
    })

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output,
      })
    })
  })
}

/**
 * Check if a package manager is available
 */
async function isPmAvailable(pm: PackageManager): Promise<boolean> {
  const result = await runCommand(pm, ['--version'], process.cwd())
  return result.success
}

/**
 * Install dependencies in the project directory
 */
export async function installDependencies(
  projectPath: string,
  packageManager: PackageManager
): Promise<{ success: boolean; error?: string }> {
  const spinner = createSpinner(`Installing dependencies with ${packageManager}...`)

  try {
    // Check if package manager is available
    const pmAvailable = await isPmAvailable(packageManager)
    if (!pmAvailable) {
      spinner.stop(false, `${packageManager} is not installed`)
      return {
        success: false,
        error: `${packageManager} is not installed. Please install it first or choose a different package manager.`,
      }
    }

    // Run install command
    const args = getInstallArgs(packageManager)
    const result = await runCommand(packageManager, args, projectPath)

    if (!result.success) {
      spinner.stop(false, 'Failed to install dependencies')
      return {
        success: false,
        error: `Dependency installation failed:\n${result.output}`,
      }
    }

    // Verify node_modules was created
    const nodeModulesPath = join(projectPath, 'node_modules')
    if (!existsSync(nodeModulesPath)) {
      spinner.stop(false, 'node_modules not created')
      return {
        success: false,
        error: 'Installation completed but node_modules directory was not created',
      }
    }

    spinner.stop(true, 'Installed dependencies')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    spinner.stop(false, 'Installation failed')
    return {
      success: false,
      error: `Unexpected error during installation: ${errorMessage}`,
    }
  }
}
