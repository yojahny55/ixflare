/**
 * @module commands/init
 * @description ix init command - Interactive project initialization wizard
 * Delegates to wizard/flows/init.ts for the actual wizard flow
 */

import {
  WizardContext,
  WizardCancelledError,
  initWizardFlow,
  validateProjectName,
  displayNextSteps,
  type TemplateType,
  type PackageManagerType,
} from '@/wizard'
import picocolors from 'picocolors'

const { bold, red, dim } = picocolors

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
 * Valid template options
 */
const VALID_TEMPLATES = ['minimal', 'fullstack-react', 'api-backend'] as const

/**
 * Valid package manager options
 */
const VALID_PACKAGE_MANAGERS = ['npm', 'pnpm', 'bun'] as const

/**
 * Check if a value is a valid template
 */
function isValidTemplate(value: string): value is TemplateType {
  return VALID_TEMPLATES.includes(value as TemplateType)
}

/**
 * Check if a value is a valid package manager
 */
function isValidPackageManager(value: string): value is PackageManagerType {
  return VALID_PACKAGE_MANAGERS.includes(value as PackageManagerType)
}

/**
 * Parse init command arguments
 */
interface InitOptions {
  name?: string
  template?: TemplateType
  packageManager?: PackageManagerType
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

  // Extract and validate template flag
  const templateFlag = extractFlag(args, '--template', '-t')
  if (templateFlag) {
    if (!isValidTemplate(templateFlag)) {
      console.error(red(`Error: Invalid template "${templateFlag}"`))
      console.error(`Valid templates: ${VALID_TEMPLATES.join(', ')}`)
      process.exit(1)
    }
    options.template = templateFlag
  }

  // Extract and validate package manager flag
  const pmFlag = extractFlag(args, '--pm', '--package-manager')
  if (pmFlag) {
    if (!isValidPackageManager(pmFlag)) {
      console.error(red(`Error: Invalid package manager "${pmFlag}"`))
      console.error(`Valid package managers: ${VALID_PACKAGE_MANAGERS.join(', ')}`)
      process.exit(1)
    }
    options.packageManager = pmFlag
  }

  return options
}

/**
 * Run init command
 * Parses arguments and delegates to wizard flow
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

    // Validate provided name before creating context
    if (options.name) {
      const validation = validateProjectName(options.name)
      if (validation !== true) {
        console.error(red(`Error: ${validation}`))
        process.exit(1)
      }
    }

    // Create wizard context
    const ctx = await WizardContext.create(args)

    // Check for required name in non-interactive mode
    if (!options.name && !ctx.isInteractive) {
      console.error(red('Error: Project name is required in non-interactive mode'))
      console.error('Usage: ix init <project-name> --yes')
      process.exit(1)
    }

    // Run the wizard flow
    const result = await initWizardFlow(ctx, {
      name: options.name,
      template: options.template,
      packageManager: options.packageManager,
    })

    if (!result) {
      // User cancelled or flow returned null
      process.exit(0)
    }

    // Display next steps
    displayNextSteps(result)
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
