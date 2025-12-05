/**
 * @module types
 * @description Type definitions for create-ixflare CLI
 */

/** Supported package managers */
export type PackageManager = 'npm' | 'pnpm' | 'bun'

/** Available project templates */
export type Template = 'minimal' | 'fullstack-react' | 'api-backend'

/** CLI parsed arguments */
export interface ParsedArgs {
  projectName?: string
  template?: Template
  packageManager?: PackageManager
  skipPrompts: boolean
  showHelp: boolean
}

/** User responses from interactive prompts */
export interface PromptResponses {
  projectName: string
  template: Template
  packageManager: PackageManager
}

/** Options for scaffolding a project */
export interface ScaffoldOptions {
  projectName: string
  template: Template
  packageManager: PackageManager
  targetDir: string
}

/** Result of scaffolding operation */
export interface ScaffoldResult {
  success: boolean
  projectPath: string
  template: Template
  packageManager: PackageManager
}

/** Error with structured code and suggestion */
export class ScaffoldError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestion?: string
  ) {
    super(message)
    this.name = 'ScaffoldError'
  }
}

/** Available templates configuration */
export const TEMPLATES: readonly Template[] = ['minimal', 'fullstack-react', 'api-backend'] as const

/** Available package managers configuration */
export const PACKAGE_MANAGERS: readonly PackageManager[] = ['npm', 'pnpm', 'bun'] as const

/** Default template when using --yes flag */
export const DEFAULT_TEMPLATE: Template = 'minimal'

/** Default package manager when none detected */
export const DEFAULT_PACKAGE_MANAGER: PackageManager = 'npm'
