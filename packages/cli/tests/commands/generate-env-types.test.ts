/**
 * @module tests/commands/generate-env-types
 * @description Tests for environment type generation CLI command
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generateEnvTypes } from '../../src/commands/generate-env-types'

// Create a unique temp directory for each test run
const createTempDir = async () => {
  const tempDir = join(tmpdir(), `ixflare-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(tempDir, { recursive: true })
  return tempDir
}

describe('generateEnvTypes', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should throw error when .env.example not found', async () => {
    await expect(generateEnvTypes(tempDir)).rejects.toThrow('.env.example not found')
  })

  it('should throw error when .env.example is empty', async () => {
    await writeFile(join(tempDir, '.env.example'), '')

    await expect(generateEnvTypes(tempDir)).rejects.toThrow('No environment variables found')
  })

  it('should generate types from simple .env.example', async () => {
    await writeFile(
      join(tempDir, '.env.example'),
      'API_KEY=\nDATABASE_URL=\nPORT=3000'
    )

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    expect(content).toContain('export interface Env')
    expect(content).toContain('API_KEY?: string')
    expect(content).toContain('DATABASE_URL?: string')
    expect(content).toContain('PORT?: number')
  })

  it('should parse both commented and uncommented variables', async () => {
    await writeFile(
      join(tempDir, '.env.example'),
      'UNCOMMENTED_KEY=value\n#COMMENTED_KEY='
    )

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    // Both should be optional (env vars might not be set at runtime)
    expect(content).toContain('UNCOMMENTED_KEY?: string')
    expect(content).toContain('COMMENTED_KEY?: string')
  })

  it('should infer types from example values', async () => {
    await writeFile(
      join(tempDir, '.env.example'),
      'STRING_VAR=hello\nNUMBER_VAR=42\nBOOL_VAR=true\nEMPTY_VAR='
    )

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    expect(content).toContain('STRING_VAR?: string')
    expect(content).toContain('NUMBER_VAR?: number')
    expect(content).toContain('BOOL_VAR?: boolean')
    expect(content).toContain('EMPTY_VAR?: string')
  })

  it('should include comments from .env.example', async () => {
    await writeFile(
      join(tempDir, '.env.example'),
      '# Database connection string\nDATABASE_URL=\n\n# API key for external service\nAPI_KEY='
    )

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    expect(content).toContain('/** Database connection string */')
    expect(content).toContain('/** API key for external service */')
  })

  it('should skip section headers and decorative comments', async () => {
    await writeFile(
      join(tempDir, '.env.example'),
      '# ====================\n# Database\n# ====================\nDATABASE_URL=\n\n# -------------------\n# API Keys\n# -------------------\nAPI_KEY='
    )

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    // Section headers should not appear as comments
    expect(content).not.toContain('====================')
    expect(content).not.toContain('-------------------')
  })

  it('should create output directory if it does not exist', async () => {
    await writeFile(join(tempDir, '.env.example'), 'API_KEY=')

    const outputFile = await generateEnvTypes(tempDir, {
      outputPath: 'src/types/env.d.ts',
    })

    expect(outputFile).toContain('src/types/env.d.ts')

    const content = await readFile(outputFile, 'utf-8')
    expect(content).toContain('export interface Env')
  })

  it('should support custom env example path', async () => {
    await mkdir(join(tempDir, 'config'), { recursive: true })
    await writeFile(join(tempDir, 'config', '.env.custom'), 'CUSTOM_VAR=')

    const outputFile = await generateEnvTypes(tempDir, {
      envExamplePath: 'config/.env.custom',
    })

    const content = await readFile(outputFile, 'utf-8')
    expect(content).toContain('CUSTOM_VAR?: string')
  })

  it('should support custom output path', async () => {
    await writeFile(join(tempDir, '.env.example'), 'API_KEY=')

    const outputFile = await generateEnvTypes(tempDir, {
      outputPath: 'types/custom.d.ts',
    })

    expect(outputFile).toContain('types/custom.d.ts')
  })

  it('should include Cloudflare Workers binding examples', async () => {
    await writeFile(join(tempDir, '.env.example'), 'API_KEY=')

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    expect(content).toContain('Cloudflare Workers bindings')
    expect(content).toContain('D1Database')
    expect(content).toContain('KVNamespace')
    expect(content).toContain('R2Bucket')
  })

  it('should include index signature for dynamic keys', async () => {
    await writeFile(join(tempDir, '.env.example'), 'API_KEY=')

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    expect(content).toContain('[key: string]: unknown')
  })

  it('should handle real-world .env.example', async () => {
    await writeFile(
      join(tempDir, '.env.example'),
      `# ====================
# Environment Variables
# ====================

# -------------------
# Database
# -------------------
# D1 database connection
DATABASE_URL=

# -------------------
# Authentication
# -------------------
# JWT signing secret (generate with: openssl rand -hex 32)
JWT_SECRET=

# -------------------
# External Services
# -------------------
# Third-party API keys
API_KEY=

# -------------------
# Feature Flags
# -------------------
DEBUG=false
VERBOSE_LOGGING=false`
    )

    const outputFile = await generateEnvTypes(tempDir)
    const content = await readFile(outputFile, 'utf-8')

    expect(content).toContain('DATABASE_URL?: string')
    expect(content).toContain('JWT_SECRET?: string')
    expect(content).toContain('API_KEY?: string')
    expect(content).toContain('DEBUG?: boolean')
    expect(content).toContain('VERBOSE_LOGGING?: boolean')
    expect(content).toContain('/** D1 database connection */')
    expect(content).toContain('/** JWT signing secret')
  })
})
