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
  dev: () => import('./commands/dev').then((m) => m.dev()),
  build: () => import('./commands/build').then((m) => m.build()),
  preview: () => import('./commands/preview').then((m) => m.preview()),
  deploy: async () => {
    const m = await import('./commands/deploy')
    const result = await m.deploy()
    if (!result.success) {
      process.exit(result.exitCode)
    }
  },
  migrate: async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/migrate')
    await m.migrate(undefined, undefined, {
      yes: args.includes('--yes'),
      force: args.includes('--force'),
      env: args.includes('--remote') ? 'remote' : 'local',
    })
  },
  'migrate:generate': async () => {
    const args = process.argv.slice(3)
    const schemaIndex = args.indexOf('--schema')
    const schemaPath = schemaIndex !== -1 ? args[schemaIndex + 1] : undefined
    const m = await import('./commands/migrate')
    await m.migrate('generate', args[0], {
      schema: schemaPath,
      empty: args.includes('--empty'),
      help: args.includes('--help') || args.includes('-h'),
    })
  },
  'migrate:rollback': async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/migrate')
    await m.migrate('rollback', undefined, {
      yes: args.includes('--yes'),
      force: args.includes('--force'),
      env: args.includes('--remote') ? 'remote' : 'local',
      help: args.includes('--help') || args.includes('-h'),
    })
  },
  'migrate:status': async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/migrate')
    await m.migrate('status', undefined, {
      help: args.includes('--help') || args.includes('-h'),
      env: args.includes('--remote') ? 'remote' : 'local',
    })
  },
  'db:seed': async () => {
    const args = process.argv.slice(3)
    const envIndex = args.indexOf('--env')
    const env = envIndex !== -1 ? args[envIndex + 1] : undefined
    const m = await import('./commands/db/seed')
    await m.seed({
      fresh: args.includes('--fresh'),
      force: args.includes('--force'),
      remote: args.includes('--remote'),
      env: env as 'development' | 'test' | 'production' | undefined,
    })
  },
  'db:studio': async () => {
    const args = process.argv.slice(3)
    const getArgValue = (flag: string): string | undefined => {
      const index = args.indexOf(flag)
      return index !== -1 && args[index + 1] ? args[index + 1] : undefined
    }
    const m = await import('./commands/db/studio')
    await m.studio({
      port: getArgValue('--port'),
      binding: getArgValue('--binding'),
      remote: args.includes('--remote'),
      open: args.includes('--open'),
      help: args.includes('--help') || args.includes('-h'),
    })
  },
  generate: () => import('./commands/generate').then((m) => m.generate()),
  'generate:env': () =>
    import('./commands/generate-env-types').then((m) => m.generateEnvCommand({})),
  'generate:types': () => import('./commands/generate-types').then((m) => m.generateTypes()),
  'auth:rotate-keys': () => import('./commands/auth/rotate-keys').then((m) => m.rotateKeys()),
  'security:audit': async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/security/audit')

    // Parse arguments
    const getArgValue = (flag: string): string | undefined => {
      const index = args.indexOf(flag)
      return index !== -1 && args[index + 1] ? args[index + 1] : undefined
    }

    // Validate --audit-level input
    const validAuditLevels = ['low', 'moderate', 'high', 'critical'] as const
    const auditLevelArg = getArgValue('--audit-level')
    if (
      auditLevelArg &&
      !validAuditLevels.includes(auditLevelArg as (typeof validAuditLevels)[number])
    ) {
      console.error(`Error: Invalid audit level "${auditLevelArg}"`)
      console.error(`Valid levels: ${validAuditLevels.join(', ')}`)
      process.exit(1)
    }

    await m.audit({
      json: args.includes('--json'),
      fix: args.includes('--fix'),
      ci: args.includes('--ci'),
      auditLevel: auditLevelArg as 'low' | 'moderate' | 'high' | 'critical' | undefined,
      prod: args.includes('--prod'),
      dev: args.includes('--dev'),
    })
  },
  rescue: async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/rescue')
    await m.create(args)
  },
  'rescue:create': async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/rescue')
    await m.create(args)
  },
  'rescue:restore': async () => {
    const args = process.argv.slice(3)
    const checkpointId = args[0]
    const restArgs = args.slice(1)
    const m = await import('./commands/rescue')
    await m.restore(checkpointId, restArgs)
  },
  'rescue:list': async () => {
    const args = process.argv.slice(3)
    const m = await import('./commands/rescue')
    await m.list(args)
  },
  'rescue:delete': async () => {
    const args = process.argv.slice(3)
    const checkpointId = args[0]
    const restArgs = args.slice(1)
    const m = await import('./commands/rescue')
    await m.deleteCheckpoint(checkpointId, restArgs)
  },
  errors: async () => {
    const m = await import('./commands/errors')
    await m.handleErrorsCommand()
  },
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
    dev                 Start development server
    build               Build for production
    preview             Preview production build locally
    deploy              Deploy to Cloudflare Workers
    migrate             Apply pending database migrations
    migrate:generate    Generate a new migration file
    migrate:rollback    Rollback the last migration
    migrate:status      Show migration status
    db:seed             Seed the database with test/development data
    db:studio           Launch database GUI (Drizzle Studio)
    rescue              Create a rescue checkpoint (default action)
    rescue:create       Create a rescue checkpoint
    rescue:restore      Restore from a checkpoint
    rescue:list         List available checkpoints
    rescue:delete       Delete a checkpoint
    generate            Generate code (model, migration, component)
    generate:env        Generate TypeScript types from .env.example
    generate:types      Generate TypeScript types for routes and models
    auth:rotate-keys    Manually rotate JWT signing keys
    security:audit      Scan dependencies for vulnerabilities
    errors              Error code reference and troubleshooting

  Migration Options:
    --yes               Skip confirmation prompts
    --force             Allow destructive operations (DROP, TRUNCATE, etc.)
    --remote            Target remote database (default: local)
    --schema <path>     Schema file for change detection (generate only)
    --empty             Create empty migration (generate only)

  Seed Options:
    --fresh             Truncate all tables before seeding
    --force             Skip confirmation prompts
    --env <env>         Environment (development, test, production)
    --remote            Target remote database (default: local)

  Security Audit Options:
    --json              Output in JSON format
    --fix               Auto-fix vulnerabilities where possible
    --ci                CI mode (fail on high/critical, production deps only)
    --audit-level <l>   Minimum severity (low, moderate, high, critical)
    --prod              Scan production dependencies only
    --dev               Scan development dependencies only
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

main().catch((err) => {
  // Import error handling dynamically to avoid circular dependency
  import('./errors').then(({ isCLIError, detectDisplayOptions }) => {
    if (isCLIError(err)) {
      const options = detectDisplayOptions()
      console.error(err.format(options))
    } else {
      console.error(err)
    }
    process.exit(1)
  })
})
