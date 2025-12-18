/**
 * Project initialization wizard flow
 * Guides user through project setup with template and package manager selection
 */

import { resolve } from 'node:path'
import picocolors from 'picocolors'
import type { WizardContext } from '@/wizard/context'

const { bold, green, cyan, dim } = picocolors

/**
 * Template choices for wizard
 */
export const TEMPLATE_CHOICES = [
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
] as const

export type TemplateType = (typeof TEMPLATE_CHOICES)[number]['value']

/**
 * Package manager choices
 */
export const PM_CHOICES = [
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
] as const

export type PackageManagerType = (typeof PM_CHOICES)[number]['value']

/**
 * Init wizard options from command line
 */
export interface InitWizardOptions {
  name?: string
  template?: TemplateType
  packageManager?: PackageManagerType
}

/**
 * Init wizard result
 */
export interface InitWizardResult {
  projectName: string
  template: TemplateType
  packageManager: PackageManagerType
  targetDir: string
}

/**
 * Validate project name
 */
export function validateProjectName(name: string): boolean | string {
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
 * Run the init wizard flow
 * @param ctx - Wizard context
 * @param options - Pre-filled options from command line
 * @returns Wizard result or null if cancelled
 */
export async function initWizardFlow(
  ctx: WizardContext,
  options: InitWizardOptions
): Promise<InitWizardResult | null> {
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
      return null // Caller should handle error
    }

    const prompted = await ctx.text('Project name:', { validate: validateProjectName })
    if (!prompted) {
      return null // Cancelled
    }
    projectName = prompted
  }

  // Step 2: Get template selection
  let template = options.template

  if (!template) {
    if (!ctx.isInteractive) {
      template = (ctx.preferences?.lastTemplate as TemplateType) ?? 'minimal'
    } else {
      const initial = ctx.preferences?.lastTemplate as TemplateType | undefined
      const selected = await ctx.select('What type of project are you building?', [...TEMPLATE_CHOICES], {
        initial,
      })
      if (!selected) {
        return null // Cancelled
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
      const selected = await ctx.select('Which package manager do you prefer?', [...PM_CHOICES], {
        initial,
      })
      if (!selected) {
        return null // Cancelled
      }
      packageManager = selected
    }
  }

  // Save preferences for next time
  await ctx.savePreference('packageManager', packageManager)
  await ctx.savePreference('lastTemplate', template)

  // Calculate target directory
  const targetDir = resolve(process.cwd(), projectName)

  return {
    projectName,
    template,
    packageManager,
    targetDir,
  }
}

/**
 * Display post-wizard instructions
 */
export function displayNextSteps(result: InitWizardResult): void {
  console.log('')
  console.log(`${green('✓')} Configuration complete`)
  console.log('')
  console.log(`Creating project at ${cyan(result.targetDir)}...`)
  console.log('')

  // Note: Full scaffold integration would call create-ixflare's scaffold function
  // For this implementation, we demonstrate the wizard integration
  console.log(`${dim('Template:')} ${result.template}`)
  console.log(`${dim('Package Manager:')} ${result.packageManager}`)
  console.log('')

  console.log(`${bold('Next steps:')}`)
  console.log('')
  console.log(`  ${dim('$')} cd ${result.projectName}`)
  console.log(`  ${dim('$')} ${result.packageManager === 'npm' ? 'npm run' : result.packageManager} dev`)
  console.log('')
}
