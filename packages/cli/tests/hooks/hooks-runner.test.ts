/**
 * @module tests/hooks/hooks-runner
 * @description Tests for lifecycle hooks runner
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HooksRunner, HookError } from '../../src/hooks/index'

// Create a unique temp directory for each test run
const createTempDir = async () => {
  const tempDir = join(
    tmpdir(),
    `ixflare-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  await mkdir(tempDir, { recursive: true })
  return tempDir
}

describe('HooksRunner', () => {
  let tempDir: string
  let runner: HooksRunner

  beforeEach(async () => {
    tempDir = await createTempDir()
    runner = new HooksRunner()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('loadConfig', () => {
    it('should load config successfully', async () => {
      // Create a minimal edge.config.ts
      await writeFile(join(tempDir, 'edge.config.ts'), `export default { name: 'test-app' }`)

      await expect(runner.loadConfig(tempDir)).resolves.not.toThrow()
    })

    it('should throw error when config file not found', async () => {
      await expect(runner.loadConfig(tempDir)).rejects.toThrow('Configuration file not found')
    })
  })

  describe('runPreBuild', () => {
    it('should execute pre-build hook when configured', async () => {
      // Use a flag file to verify hook execution
      const flagFile = join(tempDir, 'pre-build-executed.txt')

      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        import { writeFileSync } from 'node:fs'

        export default {
          name: 'test-app',
          hooks: {
            'pre-build': async () => {
              writeFileSync('${flagFile}', 'executed')
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await runner.runPreBuild()

      // Verify hook was executed by checking flag file
      const { readFile: readFlagFile } = await import('node:fs/promises')
      const content = await readFlagFile(flagFile, 'utf-8')
      expect(content).toBe('executed')
    })

    it('should skip gracefully when no pre-build hook configured', async () => {
      await writeFile(join(tempDir, 'edge.config.ts'), `export default { name: 'test-app' }`)

      await runner.loadConfig(tempDir)
      await expect(runner.runPreBuild()).resolves.not.toThrow()
    })

    it('should throw HookError when pre-build hook fails', async () => {
      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        export default {
          name: 'test-app',
          hooks: {
            'pre-build': async () => {
              throw new Error('Build preparation failed')
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await expect(runner.runPreBuild()).rejects.toThrow(HookError)
      await expect(runner.runPreBuild()).rejects.toThrow('Hook "pre-build" failed')
    })
  })

  describe('runPostBuild', () => {
    it('should execute post-build hook with correct context', async () => {
      const flagFile = join(tempDir, 'post-build-context.json')

      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        import { writeFileSync } from 'node:fs'

        export default {
          name: 'test-app',
          hooks: {
            'post-build': async (ctx) => {
              writeFileSync('${flagFile}', JSON.stringify(ctx))
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await runner.runPostBuild({ outputPath: '/dist/output' })

      // Verify hook received correct context
      const { readFile: readFlagFile } = await import('node:fs/promises')
      const content = await readFlagFile(flagFile, 'utf-8')
      const context = JSON.parse(content)
      expect(context).toEqual({ outputPath: '/dist/output' })
    })

    it('should skip gracefully when no post-build hook configured', async () => {
      await writeFile(join(tempDir, 'edge.config.ts'), `export default { name: 'test-app' }`)

      await runner.loadConfig(tempDir)
      await expect(runner.runPostBuild({ outputPath: '/dist' })).resolves.not.toThrow()
    })

    it('should throw HookError when post-build hook fails', async () => {
      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        export default {
          name: 'test-app',
          hooks: {
            'post-build': async ({ outputPath }) => {
              throw new Error('Failed to upload sourcemaps')
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await expect(runner.runPostBuild({ outputPath: '/dist' })).rejects.toThrow(HookError)
      await expect(runner.runPostBuild({ outputPath: '/dist' })).rejects.toThrow(
        'Hook "post-build" failed'
      )
    })
  })

  describe('runPreDeploy', () => {
    it('should execute pre-deploy hook with environment context', async () => {
      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        export default {
          name: 'test-app',
          hooks: {
            'pre-deploy': async ({ environment }) => {
              if (environment !== 'production') {
                throw new Error('Expected production')
              }
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await expect(runner.runPreDeploy({ environment: 'production' })).resolves.not.toThrow()
    })

    it('should skip gracefully when no pre-deploy hook configured', async () => {
      await writeFile(join(tempDir, 'edge.config.ts'), `export default { name: 'test-app' }`)

      await runner.loadConfig(tempDir)
      await expect(runner.runPreDeploy({ environment: 'production' })).resolves.not.toThrow()
    })

    it('should throw HookError when pre-deploy hook fails', async () => {
      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        export default {
          name: 'test-app',
          hooks: {
            'pre-deploy': async ({ environment }) => {
              throw new Error('Database migration failed')
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await expect(runner.runPreDeploy({ environment: 'production' })).rejects.toThrow(HookError)
      await expect(runner.runPreDeploy({ environment: 'production' })).rejects.toThrow(
        'Hook "pre-deploy" failed'
      )
    })
  })

  describe('runPostDeploy', () => {
    it('should execute post-deploy hook with url context', async () => {
      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        export default {
          name: 'test-app',
          hooks: {
            'post-deploy': async ({ url }) => {
              if (!url.startsWith('https://')) {
                throw new Error('Expected HTTPS URL')
              }
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await expect(
        runner.runPostDeploy({ url: 'https://my-app.workers.dev' })
      ).resolves.not.toThrow()
    })

    it('should skip gracefully when no post-deploy hook configured', async () => {
      await writeFile(join(tempDir, 'edge.config.ts'), `export default { name: 'test-app' }`)

      await runner.loadConfig(tempDir)
      await expect(
        runner.runPostDeploy({ url: 'https://my-app.workers.dev' })
      ).resolves.not.toThrow()
    })

    it('should throw HookError when post-deploy hook fails', async () => {
      await writeFile(
        join(tempDir, 'edge.config.ts'),
        `
        export default {
          name: 'test-app',
          hooks: {
            'post-deploy': async ({ url }) => {
              throw new Error('Slack notification failed')
            }
          }
        }
        `
      )

      await runner.loadConfig(tempDir)
      await expect(runner.runPostDeploy({ url: 'https://my-app.workers.dev' })).rejects.toThrow(
        HookError
      )
      await expect(runner.runPostDeploy({ url: 'https://my-app.workers.dev' })).rejects.toThrow(
        'Hook "post-deploy" failed'
      )
    })
  })

  describe('HookError', () => {
    it('should include hook name in error message', () => {
      const error = new HookError('pre-build', new Error('Test error'))
      expect(error.message).toContain('pre-build')
      expect(error.message).toContain('Test error')
    })

    it('should handle non-Error causes', () => {
      const error = new HookError('post-build', 'String error')
      expect(error.message).toContain('post-build')
      expect(error.message).toContain('String error')
    })

    it('should set hookName property', () => {
      const cause = new Error('Original error')
      const error = new HookError('pre-deploy', cause)
      expect(error.hookName).toBe('pre-deploy')
      expect(error.cause).toBe(cause)
    })
  })
})
