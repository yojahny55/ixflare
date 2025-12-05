/**
 * @module cli
 * @description Main CLI logic for create-ixflare
 */

import { resolve } from 'node:path'
import type { ParsedArgs, PackageManager, Template } from './types'
import { TEMPLATES, PACKAGE_MANAGERS, DEFAULT_TEMPLATE, DEFAULT_PACKAGE_MANAGER, ScaffoldError } from './types'
import { displayBanner, displayHelp, colors, isValidProjectName, getProjectNameError } from './utils'
import { detectPackageManager, getRunCommand } from './detect-pm'
import { runPrompts } from './prompts'
import { scaffold } from './scaffold'
import { installDependencies } from './install-deps'

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const result: ParsedArgs = {
    skipPrompts: false,
    showHelp: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      result.showHelp = true
    } else if (arg === '--yes' || arg === '-y') {
      result.skipPrompts = true
    } else if (arg === '--template' || arg === '-t') {
      const value = args[++i]
      if (TEMPLATES.includes(value as Template)) {
        result.template = value as Template
      } else {
        console.error(colors.red(`Invalid template: ${value}`))
        console.error(`Available templates: ${TEMPLATES.join(', ')}`)
        process.exit(1)
      }
    } else if (arg === '--pm' || arg === '--package-manager') {
      const value = args[++i]
      if (PACKAGE_MANAGERS.includes(value as PackageManager)) {
        result.packageManager = value as PackageManager
      } else {
        console.error(colors.red(`Invalid package manager: ${value}`))
        console.error(`Available package managers: ${PACKAGE_MANAGERS.join(', ')}`)
        process.exit(1)
      }
    } else if (!arg.startsWith('-') && !result.projectName) {
      result.projectName = arg
    }
  }

  return result
}

/**
 * Display success message with next steps
 */
function displaySuccess(
  projectName: string,
  projectPath: string,
  packageManager: PackageManager
): void {
  const runCmd = getRunCommand(packageManager)

  console.log('')
  console.log(`${colors.green('✓')} ${colors.bold('Project created successfully!')}`)
  console.log('')
  console.log(`${colors.cyan('Your app is ready at:')} ${projectPath}`)
  console.log('')
  console.log(`${colors.dim('Expected deployed URL:')}`)
  console.log(`  ${colors.cyan(`https://${projectName}.<your-subdomain>.workers.dev`)}`)
  console.log('')
  console.log(`${colors.bold('Next steps:')}`)
  console.log('')
  console.log(`  ${colors.dim('$')} cd ${projectName}`)
  console.log(`  ${colors.dim('$')} ${runCmd} dev`)
  console.log('')
  console.log(`${colors.dim('To deploy your app:')}`)
  console.log('')
  console.log(`  ${colors.dim('$')} ${runCmd} deploy`)
  console.log('')
}

/**
 * Display error message with suggestion
 */
function displayError(error: Error): void {
  console.error('')
  if (error instanceof ScaffoldError) {
    console.error(`${colors.red('Error:')} ${error.message}`)
    if (error.suggestion) {
      console.error(`${colors.yellow('Suggestion:')} ${error.suggestion}`)
    }
  } else {
    console.error(`${colors.red('Error:')} ${error.message}`)
  }
  console.error('')
}

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = parseArgs(process.argv)

    // Display help if requested
    if (args.showHelp) {
      displayHelp()
      process.exit(0)
    }

    // Display welcome banner
    displayBanner()

    // Detect package manager from environment
    const detectedPm = detectPackageManager()

    let projectName: string
    let template: Template
    let packageManager: PackageManager

    // Handle --yes flag for non-interactive mode
    if (args.skipPrompts) {
      // Project name is required with --yes
      if (!args.projectName) {
        console.error(colors.red('Error: Project name is required when using --yes'))
        console.error('Usage: create-ixflare-app <project-name> --yes')
        process.exit(1)
      }

      // Validate project name
      const nameError = getProjectNameError(args.projectName)
      if (nameError) {
        console.error(colors.red(`Error: ${nameError}`))
        process.exit(1)
      }

      projectName = args.projectName
      template = args.template ?? DEFAULT_TEMPLATE
      packageManager = args.packageManager ?? detectedPm
    } else if (args.projectName && args.template && args.packageManager) {
      // All options provided via flags - skip prompts
      const nameError = getProjectNameError(args.projectName)
      if (nameError) {
        console.error(colors.red(`Error: ${nameError}`))
        process.exit(1)
      }

      projectName = args.projectName
      template = args.template
      packageManager = args.packageManager
    } else {
      // Run interactive prompts for missing options
      const responses = await runPrompts({
        projectName: args.projectName,
        template: args.template,
        packageManager: args.packageManager,
        detectedPm,
      })

      if (!responses) {
        // User cancelled
        process.exit(0)
      }

      projectName = responses.projectName
      template = responses.template
      packageManager = responses.packageManager
    }

    // Resolve target directory
    const targetDir = resolve(process.cwd(), projectName)

    // Scaffold the project
    const result = await scaffold({
      projectName,
      template,
      packageManager,
      targetDir,
    })

    if (!result.success) {
      process.exit(1)
    }

    // Install dependencies
    const installResult = await installDependencies(targetDir, packageManager)

    if (!installResult.success) {
      console.error('')
      console.error(colors.yellow('Warning: Dependency installation failed'))
      if (installResult.error) {
        console.error(colors.dim(installResult.error))
      }
      console.error('')
      console.error('You can install dependencies manually:')
      console.error(`  cd ${projectName}`)
      console.error(`  ${packageManager} install`)
      console.error('')
    }

    // Display success message
    displaySuccess(projectName, targetDir, packageManager)
  } catch (error) {
    displayError(error instanceof Error ? error : new Error(String(error)))
    process.exit(1)
  }
}
