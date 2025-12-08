/**
 * @module prompts
 * @description Interactive CLI prompt definitions
 */

import prompts from 'prompts'
import type { PackageManager, Template, PromptResponses } from './types'
import { TEMPLATES, PACKAGE_MANAGERS } from './types'
import { getProjectNameError, colors } from './utils'

/** Template display configuration */
const TEMPLATE_CHOICES = [
  {
    title: `${colors.green('minimal')} ${colors.dim('- Bare minimum Ixflare setup')}`,
    value: 'minimal' as Template,
    description: 'Example route, EdgeRecord model, and test file',
  },
  {
    title: `${colors.green('fullstack-react')} ${colors.dim('- React + API with SSR')}`,
    value: 'fullstack-react' as Template,
    description: 'React components, API routes, Tailwind CSS',
  },
  {
    title: `${colors.green('api-backend')} ${colors.dim('- API-only backend')}`,
    value: 'api-backend' as Template,
    description: 'API routes, models, no frontend',
  },
]

/** Package manager display configuration */
const PM_CHOICES = [
  {
    title: `${colors.cyan('npm')} ${colors.dim('- Node Package Manager')}`,
    value: 'npm' as PackageManager,
  },
  {
    title: `${colors.cyan('pnpm')} ${colors.dim('- Fast, disk space efficient')}`,
    value: 'pnpm' as PackageManager,
  },
  {
    title: `${colors.cyan('bun')} ${colors.dim('- All-in-one JavaScript runtime')}`,
    value: 'bun' as PackageManager,
  },
]

/**
 * Prompt for project name with validation
 */
export async function promptProjectName(defaultName?: string): Promise<string | null> {
  const response = await prompts(
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: defaultName,
      validate: (value: string) => {
        const error = getProjectNameError(value)
        return error ?? true
      },
    },
    {
      onCancel: () => {
        console.log(colors.yellow('\nOperation cancelled'))
        return false
      },
    }
  )

  return response.projectName ?? null
}

/**
 * Prompt for template selection
 */
export async function promptTemplate(defaultTemplate?: Template): Promise<Template | null> {
  const initialIndex = defaultTemplate ? TEMPLATES.indexOf(defaultTemplate) : 0

  const response = await prompts(
    {
      type: 'select',
      name: 'template',
      message: 'Select a project template:',
      choices: TEMPLATE_CHOICES,
      initial: initialIndex >= 0 ? initialIndex : 0,
    },
    {
      onCancel: () => {
        console.log(colors.yellow('\nOperation cancelled'))
        return false
      },
    }
  )

  return response.template ?? null
}

/**
 * Prompt for package manager selection
 */
export async function promptPackageManager(
  defaultPm?: PackageManager
): Promise<PackageManager | null> {
  const initialIndex = defaultPm ? PACKAGE_MANAGERS.indexOf(defaultPm) : 0

  const response = await prompts(
    {
      type: 'select',
      name: 'packageManager',
      message: 'Select a package manager:',
      choices: PM_CHOICES,
      initial: initialIndex >= 0 ? initialIndex : 0,
    },
    {
      onCancel: () => {
        console.log(colors.yellow('\nOperation cancelled'))
        return false
      },
    }
  )

  return response.packageManager ?? null
}

/**
 * Run all prompts in sequence
 */
export async function runPrompts(options: {
  projectName?: string
  template?: Template
  packageManager?: PackageManager
  detectedPm?: PackageManager
}): Promise<PromptResponses | null> {
  // Prompt for project name if not provided
  let projectName: string | undefined = options.projectName
  if (!projectName) {
    const prompted = await promptProjectName()
    if (!prompted) return null
    projectName = prompted
  }

  // Prompt for template if not provided
  let template: Template | undefined = options.template
  if (!template) {
    const prompted = await promptTemplate()
    if (!prompted) return null
    template = prompted
  }

  // Prompt for package manager if not provided
  let packageManager: PackageManager | undefined = options.packageManager
  if (!packageManager) {
    // Use detected PM as default in the selection
    const prompted = await promptPackageManager(options.detectedPm)
    if (!prompted) return null
    packageManager = prompted
  }

  return {
    projectName,
    template,
    packageManager,
  }
}
