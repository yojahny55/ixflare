/**
 * @module tests/commands/custom
 * @description Tests for custom command execution system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadCustomCommands, runCustomCommand, CommandError } from '../../src/commands/custom'
import { loadConfig } from 'ixflare/config'

// Create a unique temp directory for each test run
const createTempDir = async () => {
  const tempDir = join(tmpdir(), `ixflare-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(tempDir, { recursive: true })
  return tempDir
}

describe('loadCustomCommands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should return empty map when no config file exists', async () => {
    const result = await loadCustomCommands(tempDir)
    expect(result.commands.size).toBe(0)
    expect(result.config).toBeNull()
  })

  it('should return empty map when no custom commands configured', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app' }`
    )

    const result = await loadCustomCommands(tempDir)
    expect(result.commands.size).toBe(0)
    expect(result.config).not.toBeNull()
  })

  it('should load custom commands from config', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `
      export default {
        name: 'test-app',
        commands: {
          'db:seed': {
            description: 'Seed the database with test data',
            handler: async () => {
              console.log('Seeding database...')
            }
          },
          'cache:clear': {
            description: 'Clear application cache',
            handler: async () => {
              console.log('Clearing cache...')
            }
          }
        }
      }
      `
    )

    const result = await loadCustomCommands(tempDir)
    expect(result.commands.size).toBe(2)
    expect(result.commands.has('db:seed')).toBe(true)
    expect(result.commands.has('cache:clear')).toBe(true)
    expect(result.config).not.toBeNull()
  })

  it('should include command descriptions', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `
      export default {
        name: 'test-app',
        commands: {
          'db:seed': {
            description: 'Seed the database',
            handler: async () => {}
          }
        }
      }
      `
    )

    const result = await loadCustomCommands(tempDir)
    const dbSeed = result.commands.get('db:seed')
    expect(dbSeed?.description).toBe('Seed the database')
  })
})

describe('runCustomCommand', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should throw CommandError when command not found', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app' }`
    )

    const config = await loadConfig(tempDir)
    await expect(runCustomCommand('nonexistent', config)).rejects.toThrow(CommandError)
    await expect(runCustomCommand('nonexistent', config)).rejects.toThrow('Unknown custom command: nonexistent')
  })

  it('should execute custom command handler', async () => {
    const flagFile = join(tempDir, 'command-executed.txt')

    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `
      import { writeFileSync } from 'node:fs'

      export default {
        name: 'test-app',
        commands: {
          'test:command': {
            description: 'Test command',
            handler: async () => {
              writeFileSync('${flagFile}', 'executed')
            }
          }
        }
      }
      `
    )

    const config = await loadConfig(tempDir)
    await runCustomCommand('test:command', config)

    // Verify command was executed
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(flagFile, 'utf-8')
    expect(content).toBe('executed')
  })

  it('should handle async command handlers', async () => {
    const flagFile = join(tempDir, 'async-executed.txt')

    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `
      import { writeFile } from 'node:fs/promises'

      export default {
        name: 'test-app',
        commands: {
          'async:command': {
            description: 'Async test command',
            handler: async () => {
              await writeFile('${flagFile}', 'async-executed')
            }
          }
        }
      }
      `
    )

    const config = await loadConfig(tempDir)
    await runCustomCommand('async:command', config)

    // Verify async command was executed
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(flagFile, 'utf-8')
    expect(content).toBe('async-executed')
  })

  it('should wrap handler errors in CommandError', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `
      export default {
        name: 'test-app',
        commands: {
          'failing:command': {
            description: 'Command that fails',
            handler: async () => {
              throw new Error('Command execution failed')
            }
          }
        }
      }
      `
    )

    const config = await loadConfig(tempDir)
    await expect(runCustomCommand('failing:command', config)).rejects.toThrow(CommandError)
    await expect(runCustomCommand('failing:command', config)).rejects.toThrow('Command execution failed')
  })

  it('should support commands with colons in names', async () => {
    const flagFile = join(tempDir, 'colon-command.txt')

    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `
      import { writeFileSync } from 'node:fs'

      export default {
        name: 'test-app',
        commands: {
          'db:migrate:rollback': {
            description: 'Rollback migrations',
            handler: async () => {
              writeFileSync('${flagFile}', 'rollback-executed')
            }
          }
        }
      }
      `
    )

    const config = await loadConfig(tempDir)
    await runCustomCommand('db:migrate:rollback', config)

    const { readFile } = await import('node:fs/promises')
    const content = await readFile(flagFile, 'utf-8')
    expect(content).toBe('rollback-executed')
  })

  it('should include command name in CommandError', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app' }`
    )

    const config = await loadConfig(tempDir)
    try {
      await runCustomCommand('my-command', config)
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError)
      expect((error as CommandError).commandName).toBe('my-command')
      expect((error as CommandError).code).toBe('COMMAND_NOT_FOUND')
    }
  })
})
