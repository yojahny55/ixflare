/**
 * @module utils
 * @description Utility functions for create-ixflare CLI
 */

/** Check if terminal supports color output */
export const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR

/** ANSI color codes wrapper */
export const colors = {
  green: (s: string) => (supportsColor ? `\x1b[32m${s}\x1b[0m` : s),
  cyan: (s: string) => (supportsColor ? `\x1b[36m${s}\x1b[0m` : s),
  yellow: (s: string) => (supportsColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (supportsColor ? `\x1b[31m${s}\x1b[0m` : s),
  bold: (s: string) => (supportsColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (supportsColor ? `\x1b[2m${s}\x1b[0m` : s),
  magenta: (s: string) => (supportsColor ? `\x1b[35m${s}\x1b[0m` : s),
}

/** Convert string to kebab-case */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

/** Convert string to PascalCase */
export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase())
}

/** Validate project name is valid kebab-case */
export function isValidProjectName(name: string): boolean {
  // Must be lowercase, can contain letters, numbers, and hyphens
  // Cannot start or end with hyphen, no consecutive hyphens
  const validPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
  return validPattern.test(name) && name.length >= 1 && name.length <= 214
}

/** Get validation error message for project name */
export function getProjectNameError(name: string): string | null {
  if (!name || name.length === 0) {
    return 'Project name is required'
  }
  if (name.length > 214) {
    return 'Project name must be 214 characters or less'
  }
  if (!/^[a-z]/.test(name)) {
    return 'Project name must start with a lowercase letter'
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Project name can only contain lowercase letters, numbers, and hyphens'
  }
  if (name.startsWith('-') || name.endsWith('-')) {
    return 'Project name cannot start or end with a hyphen'
  }
  if (/--/.test(name)) {
    return 'Project name cannot contain consecutive hyphens'
  }
  return null
}

/** Display the welcome banner */
export function displayBanner(): void {
  console.log(`
  ${colors.cyan('╭─────────────────────────────────────────╮')}
  ${colors.cyan('│')}                                         ${colors.cyan('│')}
  ${colors.cyan('│')}   ${colors.bold('Create Ixflare App')}                    ${colors.cyan('│')}
  ${colors.cyan('│')}                                         ${colors.cyan('│')}
  ${colors.cyan('│')}   ${colors.dim('Edge-native fullstack framework')}       ${colors.cyan('│')}
  ${colors.cyan('│')}   ${colors.dim('for Cloudflare Workers')}                ${colors.cyan('│')}
  ${colors.cyan('│')}                                         ${colors.cyan('│')}
  ${colors.cyan('╰─────────────────────────────────────────╯')}
  `)
}

/** Display help message */
export function displayHelp(): void {
  console.log(`
${colors.bold('Usage:')} create-ixflare-app [project-name] [options]

${colors.bold('Options:')}
  ${colors.cyan('-t, --template <name>')}    Template: minimal, fullstack-react, api-backend
  ${colors.cyan('--pm <manager>')}           Package manager: npm, pnpm, bun
  ${colors.cyan('-y, --yes')}                Skip prompts and use defaults
  ${colors.cyan('-h, --help')}               Display this help message

${colors.bold('Examples:')}
  ${colors.dim('$')} npx create-ixflare-app my-app
  ${colors.dim('$')} npx create-ixflare-app my-app --template api-backend --pm pnpm
  ${colors.dim('$')} npx create-ixflare-app my-app -t fullstack-react -y

${colors.bold('Templates:')}
  ${colors.green('minimal')}          Bare minimum Ixflare setup
  ${colors.green('fullstack-react')}  React + API with SSR support
  ${colors.green('api-backend')}      API-only backend service
`)
}
