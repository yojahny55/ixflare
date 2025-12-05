/**
 * @module cli
 * @description Interactive CLI for project scaffolding
 */

import { scaffold } from './scaffold'

export interface CliOptions {
  projectName?: string
  template?: 'minimal' | 'fullstack-react' | 'api-backend'
  packageManager?: 'npm' | 'pnpm' | 'bun'
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const projectName = args[0]

  console.log(`
  ╭─────────────────────────────────────────╮
  │                                         │
  │   Create Ixflare App                    │
  │                                         │
  │   Edge-native fullstack framework       │
  │   for Cloudflare Workers                │
  │                                         │
  ╰─────────────────────────────────────────╯
  `)

  // Placeholder - will be implemented in Story 1.2
  if (!projectName) {
    console.log('Usage: npx create-ixflare <project-name>')
    console.log('')
    console.log('Options:')
    console.log('  --template <name>   Template: minimal, fullstack-react, api-backend')
    console.log('  --pm <manager>      Package manager: npm, pnpm, bun')
    process.exit(1)
  }

  await scaffold({
    projectName,
    template: 'minimal',
    packageManager: 'pnpm',
  })
}
