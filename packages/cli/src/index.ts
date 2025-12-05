#!/usr/bin/env node
/**
 * @module @ixflare/cli
 * @description CLI entry point for ix commands
 */

const args = process.argv.slice(2)
const command = args[0]

const commands: Record<string, () => Promise<void>> = {
  dev: () => import('./commands/dev').then(m => m.dev()),
  build: () => import('./commands/build').then(m => m.build()),
  deploy: () => import('./commands/deploy').then(m => m.deploy()),
  migrate: () => import('./commands/migrate').then(m => m.migrate()),
  generate: () => import('./commands/generate').then(m => m.generate()),
}

async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
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
    dev       Start development server
    build     Build for production
    deploy    Deploy to Cloudflare Workers
    migrate   Run database migrations
    generate  Generate code (model, migration, component)

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

  const handler = commands[command]
  if (!handler) {
    console.error(`Unknown command: ${command}`)
    console.error('Run "ix --help" for available commands')
    process.exit(1)
  }

  await handler()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
