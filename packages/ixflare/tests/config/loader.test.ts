import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig, loadEnv } from '../../src/config/loader'
import { ConfigError } from '../../src/config/errors'

// Create a unique temp directory for each test run
const createTempDir = async () => {
  const tempDir = join(tmpdir(), `ixflare-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(tempDir, { recursive: true })
  return tempDir
}

describe('loadEnv', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should load .env file', async () => {
    await writeFile(join(tempDir, '.env'), 'API_KEY=secret\nPORT=3000')

    const env = await loadEnv(tempDir)

    expect(env.API_KEY).toBe('secret')
    expect(env.PORT).toBe(3000)
  })

  it('should parse boolean values', async () => {
    await writeFile(join(tempDir, '.env'), 'DEBUG=true\nVERBOSE=false')

    const env = await loadEnv(tempDir)

    expect(env.DEBUG).toBe(true)
    expect(env.VERBOSE).toBe(false)
  })

  it('should handle quoted values', async () => {
    await writeFile(join(tempDir, '.env'), 'MSG="Hello World"\nPATH=\'some/path\'')

    const env = await loadEnv(tempDir)

    expect(env.MSG).toBe('Hello World')
    expect(env.PATH).toBe('some/path')
  })

  it('should skip comments and empty lines', async () => {
    await writeFile(join(tempDir, '.env'), '# Comment\n\nKEY=value\n# Another comment')

    const env = await loadEnv(tempDir)

    expect(Object.keys(env)).toEqual(['KEY'])
    expect(env.KEY).toBe('value')
  })

  it('should merge .env and .env.local with correct precedence', async () => {
    await writeFile(join(tempDir, '.env'), 'SHARED=base\nBASE_ONLY=true')
    await writeFile(join(tempDir, '.env.local'), 'SHARED=local\nLOCAL_ONLY=true')

    const env = await loadEnv(tempDir)

    expect(env.SHARED).toBe('local') // .env.local overrides .env
    expect(env.BASE_ONLY).toBe(true)
    expect(env.LOCAL_ONLY).toBe(true)
  })

  it('should include .env.production in production mode', async () => {
    await writeFile(join(tempDir, '.env'), 'SHARED=base')
    await writeFile(join(tempDir, '.env.production'), 'SHARED=prod\nPROD_ONLY=true')

    const env = await loadEnv(tempDir, 'production')

    expect(env.SHARED).toBe('prod')
    expect(env.PROD_ONLY).toBe(true)
  })

  it('should NOT include .env.production in development mode', async () => {
    await writeFile(join(tempDir, '.env'), 'SHARED=base')
    await writeFile(join(tempDir, '.env.production'), 'SHARED=prod\nPROD_ONLY=true')

    const env = await loadEnv(tempDir, 'development')

    expect(env.SHARED).toBe('base')
    expect(env.PROD_ONLY).toBeUndefined()
  })

  it('should parse wrangler.toml [vars] with highest precedence', async () => {
    await writeFile(join(tempDir, '.env'), 'SHARED=base')
    await writeFile(join(tempDir, '.env.local'), 'SHARED=local')
    await writeFile(join(tempDir, 'wrangler.toml'), '[vars]\nSHARED = "wrangler"\nWRANGLER_ONLY = "value"')

    const env = await loadEnv(tempDir)

    expect(env.SHARED).toBe('wrangler') // wrangler.toml wins
    expect(env.WRANGLER_ONLY).toBe('value')
  })

  it('should handle missing env files gracefully', async () => {
    // No env files created

    const env = await loadEnv(tempDir)

    expect(env).toEqual({})
  })

  it('should apply full precedence chain correctly', async () => {
    // Create all env files with overlapping vars
    await writeFile(join(tempDir, '.env'), 'A=base\nB=base\nC=base\nD=base')
    await writeFile(join(tempDir, '.env.local'), 'B=local\nC=local\nD=local')
    await writeFile(join(tempDir, '.env.production'), 'C=prod\nD=prod')
    await writeFile(join(tempDir, 'wrangler.toml'), '[vars]\nD = "wrangler"')

    const env = await loadEnv(tempDir, 'production')

    // Precedence: wrangler > .env.production > .env.local > .env
    expect(env.A).toBe('base')
    expect(env.B).toBe('local')
    expect(env.C).toBe('prod')
    expect(env.D).toBe('wrangler')
  })
})

describe('loadConfig', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should throw ConfigError when config file is missing', async () => {
    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigError)
  })

  it('should include helpful message when config file is missing', async () => {
    try {
      await loadConfig(tempDir)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      const configError = error as ConfigError
      expect(configError.message).toContain('Configuration file not found')
      expect(configError.message).toContain('defineConfig')
    }
  })

  it('should throw ConfigError for invalid config export', async () => {
    // Create config that exports non-object
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      'export default "not an object"'
    )

    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigError)
  })

  it('should load and validate valid config', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app' }`
    )

    const config = await loadConfig(tempDir)

    expect(config.name).toBe('test-app')
    // Should have defaults applied
    expect(config.database?.binding).toBe('DB')
    expect(config.cache?.defaultTtl).toBe(3600)
  })

  it('should merge env files into config.env', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app' }`
    )
    await writeFile(join(tempDir, '.env'), 'API_KEY=secret')

    const config = await loadConfig(tempDir)

    expect(config.env?.API_KEY).toBe('secret')
  })

  it('should merge config.env with env files (files take precedence)', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app', env: { INLINE: 'inline', SHARED: 'config' } }`
    )
    await writeFile(join(tempDir, '.env'), 'SHARED=envfile\nFILE_ONLY=value')

    const config = await loadConfig(tempDir)

    expect(config.env?.INLINE).toBe('inline')
    expect(config.env?.SHARED).toBe('envfile') // .env overrides config
    expect(config.env?.FILE_ONLY).toBe('value')
  })

  it('should throw ConfigError for validation failures', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: '' }` // Invalid: empty name
    )

    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigError)
  })

  it('should include file path in validation errors', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { }` // Invalid: missing name
    )

    try {
      await loadConfig(tempDir)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      const configError = error as ConfigError
      expect(configError.filePath).toContain('edge.config.ts')
    }
  })

  it('should accept custom config path', async () => {
    await mkdir(join(tempDir, 'config'), { recursive: true })
    await writeFile(
      join(tempDir, 'config', 'custom.config.ts'),
      `export default { name: 'custom-app' }`
    )

    const config = await loadConfig(tempDir, { configPath: 'config/custom.config.ts' })

    expect(config.name).toBe('custom-app')
  })

  it('should respect environment override option', async () => {
    await writeFile(
      join(tempDir, 'edge.config.ts'),
      `export default { name: 'test-app' }`
    )
    await writeFile(join(tempDir, '.env.production'), 'PROD_VAR=true')

    // Force production mode
    const config = await loadConfig(tempDir, { environment: 'production' })

    expect(config.env?.PROD_VAR).toBe(true)
  })
})
