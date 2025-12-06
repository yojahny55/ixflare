#!/usr/bin/env node
/**
 * @module @ixflare/cli
 * @description CLI entry point for ix commands
 * @node-only
 */

import { loadCustomCommands, runCustomCommand } from './commands/custom'

const args = process.argv.slice(2)
const command = args[0]

const commands: Record<string, () => Promise<void>> = {
  dev: () => import('./commands/dev').then(m => m.dev()),
  build: () => import('./commands/build').then(m => m.build()),
  deploy: async () => {
    const m = await import('./commands/deploy')
    const result = await m.deploy()
    if (!result.success) {
      process.exit(result.exitCode)
    }
  },
  migrate: () => import('./commands/migrate').then(m => m.migrate()),
  generate: () => import('./commands/generate').then(m => m.generate()),
  'generate:env': () => import('./commands/generate-env-types').then(m => m.generateEnvCommand({})),
}

async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    // Load custom commands for help display
    const { commands: customCommands } = await loadCustomCommands(process.cwd())
    const customCommandsList = Array.from(customCommands.entries())
      .map(([name, cmdConfig]) => `    ${name.padEnd(14)} ${cmdConfig.description}`)
      .join('\n')

    console.log(`
  ╭─────────────────────────────────────────╮
  │                                         │
  │   Ixflare CLI                           │
  │                                         │
  │   Edge-native fullstack framework       │
  │                                         │
  ╰─────────────────────────────────────────╯

  Usage: ix <command>

  Commands:
    dev            Start development server
    build          Build for production
    deploy         Deploy to Cloudflare Workers
    migrate        Run database migrations
    generate       Generate code (model, migration, component)
    generate:env   Generate TypeScript types from .env.example
${customCommandsList ? '\n  Custom Commands:\n' + customCommandsList : ''}

  Options:
    --help    Show help
    --version Show version
    `)
    return
  }

  if (command === '--version' || command === '-v') {
    console.log('ixflare v0.0.1')
    return
  }

  // Check built-in commands first
  const handler = commands[command]
  if (handler) {
    await handler()
    return
  }

  // Try custom commands
  const { commands: customCommands, config } = await loadCustomCommands(process.cwd())
  if (customCommands.has(command) && config) {
    await runCustomCommand(command, config)
    return
  }

  // Unknown command
  console.error(`Unknown command: ${command}`)
  console.error('Run "ix --help" for available commands')
  process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
