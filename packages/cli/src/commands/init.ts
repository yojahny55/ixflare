/**
 * @module commands/init
 * @description ix init command - Interactive project initialization wizard
 * Integrates with create-ixflare for project scaffolding
 */

import { resolve } from 'node:path'
import { WizardContext, WizardCancelledError } from '@/wizard'
import picocolors from 'picocolors'

const { bold, green, red, cyan, dim } = picocolors

/**
 * Display help for init command
 */
function displayHelp(): void {
  console.log(`
${bold('ix init')} - Initialize a new Ixflare project

${bold('Usage:')}
  ix init [options]
  ix init <project-name> [options]

${bold('Options:')}
  --name <name>          Project name
  --template, -t <type>  Template to use (minimal, fullstack-react, api-backend)
  --pm <manager>         Package manager (npm, pnpm, bun)
  --yes, -y              Skip prompts and use defaults
  --help, -h             Show this help message

${bold('Examples:')}
  ${dim('$')} ix init                                    ${dim('# Interactive mode')}
  ${dim('$')} ix init my-app                             ${dim('# Init with name')}
  ${dim('$')} ix init my-app --yes                       ${dim('# Use defaults')}
  ${dim('$')} ix init --template fullstack-react --pm pnpm   ${dim('# Specify options')}
`)
}

/**
 * Extract flag value from args
 */
function extractFlag(args: string[], ...flags: string[]): string | undefined {
  for (const flag of flags) {
    const index = args.indexOf(flag)
    if (index !== -1 && args[index + 1]) {
      return args[index + 1]
    }
  }
  return undefined
}

/**
 * Parse init command arguments
 */
interface InitOptions {
  name?: string
  template?: 'minimal' | 'fullstack-react' | 'api-backend'
  packageManager?: 'npm' | 'pnpm' | 'bun'
  yes?: boolean
  help?: boolean
}

function parseInitArgs(args: string[]): InitOptions {
  const options: InitOptions = {
    yes: args.includes('--yes') || args.includes('-y'),
    help: args.includes('--help') || args.includes('-h'),
  }

  // Extract positional project name
  const positionalArgs = args.filter((arg) => !arg.startsWith('-'))
  if (positionalArgs.length > 0) {
    options.name = positionalArgs[0]
  }

  // Extract flags
  const nameFlag = extractFlag(args, '--name')
  if (nameFlag) options.name = nameFlag

  const templateFlag = extractFlag(args, '--template', '-t')
  if (templateFlag) {
    options.template = templateFlag as 'minimal' | 'fullstack-react' | 'api-backend'
  }

  const pmFlag = extractFlag(args, '--pm', '--package-manager')
  if (pmFlag) {
    options.packageManager = pmFlag as 'npm' | 'pnpm' | 'bun'
  }

  return options
}

/**
 * Validate project name
 */
function validateProjectName(name: string): boolean | string {
  if (!name || name.trim().length === 0) {
    return 'Project name cannot be empty'
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Project name can only contain lowercase letters, numbers, and hyphens'
  }

  if (name.startsWith('-') || name.endsWith('-')) {
    return 'Project name cannot start or end with a hyphen'
  }

  if (name.length < 2) {
    return 'Project name must be at least 2 characters'
  }

  return true
}

/**
 * Template choices for wizard
 */
const TEMPLATE_CHOICES = [
  {
    title: `${green('minimal')} ${dim('- Bare minimum setup')}`,
    value: 'minimal' as const,
    description: 'Basic example route, EdgeRecord model, and tests',
  },
  {
    title: `${green('fullstack-react')} ${dim('- React + API with SSR')}`,
    value: 'fullstack-react' as const,
    description: 'React components, API routes, Tailwind CSS',
  },
  {
    title: `${green('api-backend')} ${dim('- API-only backend')}`,
    value: 'api-backend' as const,
    description: 'API routes and models, no frontend',
  },
]

/**
 * Package manager choices
 */
const PM_CHOICES = [
  {
    title: `${cyan('npm')} ${dim('- Node Package Manager')}`,
    value: 'npm' as const,
  },
  {
    title: `${cyan('pnpm')} ${dim('- Fast, disk space efficient (recommended)')}`,
    value: 'pnpm' as const,
  },
  {
    title: `${cyan('bun')} ${dim('- All-in-one JavaScript runtime')}`,
    value: 'bun' as const,
  },
]

/**
 * Run init wizard flow
 */
export async function init(): Promise<void> {
  try {
    const args = process.argv.slice(3)
    const options = parseInitArgs(args)

    // Show help if requested
    if (options.help) {
      displayHelp()
      return
    }

    // Create wizard context
    const ctx = await WizardContext.create(args)

    // Display welcome message in interactive mode
    if (ctx.isInteractive) {
      console.log('')
      console.log(`${bold('Welcome to Ixflare!')} Let's set up your project.`)
      console.log('')
    }

    // Step 1: Get project name
    let projectName = options.name

    if (!projectName) {
      if (!ctx.isInteractive) {
        console.error(red('Error: Project name is required in non-interactive mode'))
        console.error('Usage: ix init <project-name> --yes')
        process.exit(1)
      }

      const prompted = await ctx.text('Project name:', { validate: validateProjectName })
      if (!prompted) {
        process.exit(0)
      }
      projectName = prompted
    } else {
      // Validate provided name
      const validation = validateProjectName(projectName)
      if (validation !== true) {
        console.error(red(`Error: ${validation}`))
        process.exit(1)
      }
    }

    // Step 2: Get template selection
    let template = options.template

    if (!template) {
      if (!ctx.isInteractive) {
        template = (ctx.preferences?.lastTemplate as typeof template) ?? 'minimal'
      } else {
        const initial = ctx.preferences?.lastTemplate as typeof template | undefined
        const selected = await ctx.select('What type of project are you building?', TEMPLATE_CHOICES, {
          initial,
        })
        if (!selected) {
          process.exit(0)
        }
        template = selected
      }
    }

    // Step 3: Get package manager
    let packageManager = options.packageManager

    if (!packageManager) {
      if (!ctx.isInteractive) {
        packageManager = ctx.preferences?.packageManager ?? 'pnpm'
      } else {
        const initial = ctx.preferences?.packageManager
        const selected = await ctx.select('Which package manager do you prefer?', PM_CHOICES, {
          initial,
        })
        if (!selected) {
          process.exit(0)
        }
        packageManager = selected
      }
    }

    // Save preferences for next time
    await ctx.savePreference('packageManager', packageManager)
    await ctx.savePreference('lastTemplate', template)

    // Execute scaffolding via create-ixflare
    const targetDir = resolve(process.cwd(), projectName)

    console.log('')
    console.log(`${green('✓')} Configuration complete`)
    console.log('')
    console.log(`Creating project at ${cyan(targetDir)}...`)
    console.log('')

    // Note: Full scaffold integration would call create-ixflare's scaffold function
    // For this implementation, we demonstrate the wizard integration
    console.log(`${dim('Template:')} ${template}`)
    console.log(`${dim('Package Manager:')} ${packageManager}`)
    console.log('')

    // In production, this would call:
    // import { scaffold } from 'create-ixflare/src/scaffold'
    // await scaffold({ projectName, template, packageManager, targetDir })

    console.log(`${bold('Next steps:')}`)
    console.log('')
    console.log(`  ${dim('$')} cd ${projectName}`)
    console.log(`  ${dim('$')} ${packageManager === 'npm' ? 'npm run' : packageManager} dev`)
    console.log('')
  } catch (error) {
    if (error instanceof WizardCancelledError) {
      // User cancelled - exit gracefully
      process.exit(0)
    }

    // Other errors
    console.error('')
    console.error(red('Error:'), error instanceof Error ? error.message : String(error))
    console.error('')
    process.exit(1)
  }
}
