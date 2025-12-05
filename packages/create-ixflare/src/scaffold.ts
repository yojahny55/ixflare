/**
 * @module scaffold
 * @description Project scaffolding logic - copies templates and replaces variables
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  copyFileSync,
  chmodSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import type { ScaffoldOptions, ScaffoldResult, Template } from './types'
import { ScaffoldError } from './types'
import { toKebabCase, toPascalCase, colors } from './utils'

/** Files that start with _ should be renamed to start with . */
const RENAME_PREFIX_MAP: Record<string, string> = {
  '_gitignore': '.gitignore',
  '_env': '.env',
  '_env.example': '.env.example',
  '_env.local': '.env.local',
  '_eslintrc.js': '.eslintrc.js',
  '_prettierrc': '.prettierrc',
  '_editorconfig': '.editorconfig',
}

/** Binary file extensions that should not have variable replacement */
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  // Note: SVG is text/XML and supports template variables
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp3',
  '.mp4',
  '.webm',
  '.zip',
  '.tar',
  '.gz',
])

/**
 * Get the path to templates directory
 * Works both in development (src/) and production (dist/)
 *
 * Resolution order:
 * 1. IXFLARE_TEMPLATES_DIR env var (for testing/custom installs)
 * 2. Relative to package directory (npm package structure)
 * 3. Monorepo development paths
 */
export function getTemplatesDir(): string {
  // Allow override via environment variable (useful for testing)
  if (process.env.IXFLARE_TEMPLATES_DIR) {
    const envPath = process.env.IXFLARE_TEMPLATES_DIR
    if (existsSync(envPath)) {
      return envPath
    }
  }

  // Try different locations based on environment
  const possiblePaths = [
    // npm package structure: node_modules/create-ixflare/templates
    join(__dirname, '..', 'templates'),
    // Monorepo development: packages/create-ixflare/dist -> ../../templates
    join(__dirname, '..', '..', '..', 'templates'),
    // Alternative monorepo structure
    join(__dirname, '..', '..', 'templates'),
    // Development from root
    join(process.cwd(), 'templates'),
  ]

  for (const templatePath of possiblePaths) {
    // Verify this is actually a templates directory (has at least minimal/)
    const minimalPath = join(templatePath, 'minimal')
    if (existsSync(templatePath) && existsSync(minimalPath)) {
      return templatePath
    }
  }

  throw new ScaffoldError(
    'Templates directory not found',
    'TEMPLATES_NOT_FOUND',
    'Ensure templates/ directory exists with template subdirectories (minimal, api-backend, fullstack-react)'
  )
}

/**
 * Check if a template exists
 */
export function templateExists(template: Template): boolean {
  const templatesDir = getTemplatesDir()
  const templatePath = join(templatesDir, template)
  return existsSync(templatePath)
}

/**
 * Get template variables for replacement
 */
export function getTemplateVars(projectName: string): Record<string, string> {
  return {
    projectName: projectName,
    projectNameKebab: toKebabCase(projectName),
    projectNamePascal: toPascalCase(projectName),
  }
}

/**
 * Replace template variables in content
 */
export function replaceTemplateVars(
  content: string,
  vars: Record<string, string>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match
  })
}

/**
 * Get the output filename (handles _ to . prefix renaming)
 */
export function getOutputFilename(filename: string): string {
  // Check for exact matches first
  if (RENAME_PREFIX_MAP[filename]) {
    return RENAME_PREFIX_MAP[filename]
  }

  // Check if filename starts with _ and should be renamed
  if (filename.startsWith('_')) {
    return '.' + filename.slice(1)
  }

  return filename
}

/**
 * Check if file is binary based on extension
 */
export function isBinaryFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return BINARY_EXTENSIONS.has(ext)
}

/**
 * Copy a single file with template variable replacement
 * Preserves file permissions from source
 */
export function copyTemplateFile(
  srcPath: string,
  destPath: string,
  vars: Record<string, string>
): void {
  // Ensure destination directory exists
  const destDir = dirname(destPath)
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  // Get source file permissions
  const srcStats = statSync(srcPath)
  const mode = srcStats.mode

  // Binary files are copied as-is (copyFileSync preserves permissions)
  if (isBinaryFile(srcPath)) {
    copyFileSync(srcPath, destPath)
    return
  }

  // Text files get variable replacement
  const content = readFileSync(srcPath, 'utf-8')
  const replaced = replaceTemplateVars(content, vars)
  writeFileSync(destPath, replaced, 'utf-8')

  // Preserve file permissions
  chmodSync(destPath, mode)
}

/**
 * Recursively copy a directory with template processing
 */
export function copyTemplateDir(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>
): void {
  // Create destination directory
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  // Read all entries in source directory
  const entries = readdirSync(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const outputName = getOutputFilename(entry.name)
    const destPath = join(destDir, outputName)

    if (entry.isDirectory()) {
      // Skip node_modules and other build artifacts
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }
      copyTemplateDir(srcPath, destPath, vars)
    } else {
      copyTemplateFile(srcPath, destPath, vars)
    }
  }
}

/**
 * Scaffold a new project from a template
 */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const { projectName, template, packageManager, targetDir } = options

  // Validate target directory doesn't exist
  if (existsSync(targetDir)) {
    const stats = statSync(targetDir)
    if (stats.isDirectory()) {
      const files = readdirSync(targetDir)
      if (files.length > 0) {
        throw new ScaffoldError(
          `Directory "${projectName}" already exists and is not empty`,
          'DIR_EXISTS',
          'Choose a different project name or remove the existing directory'
        )
      }
    } else {
      throw new ScaffoldError(
        `"${projectName}" already exists and is not a directory`,
        'PATH_EXISTS',
        'Choose a different project name'
      )
    }
  }

  // Validate template exists
  if (!templateExists(template)) {
    throw new ScaffoldError(
      `Template "${template}" not found`,
      'TEMPLATE_NOT_FOUND',
      `Available templates: minimal, fullstack-react, api-backend`
    )
  }

  // Get template source path
  const templatesDir = getTemplatesDir()
  const templatePath = join(templatesDir, template)

  // Get template variables
  const vars = getTemplateVars(projectName)

  console.log('')
  console.log(`${colors.cyan('Creating project:')} ${colors.bold(projectName)}`)
  console.log(`${colors.dim('Template:')} ${template}`)
  console.log(`${colors.dim('Package manager:')} ${packageManager}`)
  console.log('')

  // Copy template with variable replacement
  console.log(`${colors.dim('Scaffolding project...')}`)
  copyTemplateDir(templatePath, targetDir, vars)

  console.log(`${colors.green('✓')} Created project structure`)

  return {
    success: true,
    projectPath: targetDir,
    template,
    packageManager,
  }
}
