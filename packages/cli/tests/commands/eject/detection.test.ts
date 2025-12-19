/**
 * Tests for project state detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectProjectState } from '../../../src/commands/eject/detection'

describe('detectProjectState', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'eject-test-'))
  })

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should detect non-ejected project with edge.config.ts', async () => {
    writeFileSync(join(testDir, 'edge.config.ts'), 'export default {}')

    const state = await detectProjectState(testDir)

    expect(state.hasEdgeConfig).toBe(true)
    expect(state.hasWranglerToml).toBe(false)
    expect(state.hasViteConfig).toBe(false)
    expect(state.isEjected).toBe(false)
  })

  it('should detect ejected project with wrangler.toml but no edge.config.ts', async () => {
    writeFileSync(join(testDir, 'wrangler.toml'), 'name = "test"')

    const state = await detectProjectState(testDir)

    expect(state.hasEdgeConfig).toBe(false)
    expect(state.hasWranglerToml).toBe(true)
    expect(state.hasViteConfig).toBe(false)
    expect(state.isEjected).toBe(true)
  })

  it('should detect project with both edge.config.ts and wrangler.toml', async () => {
    writeFileSync(join(testDir, 'edge.config.ts'), 'export default {}')
    writeFileSync(join(testDir, 'wrangler.toml'), 'name = "test"')

    const state = await detectProjectState(testDir)

    expect(state.hasEdgeConfig).toBe(true)
    expect(state.hasWranglerToml).toBe(true)
    expect(state.hasViteConfig).toBe(false)
    expect(state.isEjected).toBe(false) // Not ejected if edge.config.ts exists
  })

  it('should detect project with vite.config.ts', async () => {
    writeFileSync(join(testDir, 'edge.config.ts'), 'export default {}')
    writeFileSync(join(testDir, 'vite.config.ts'), 'export default {}')

    const state = await detectProjectState(testDir)

    expect(state.hasEdgeConfig).toBe(true)
    expect(state.hasWranglerToml).toBe(false)
    expect(state.hasViteConfig).toBe(true)
    expect(state.isEjected).toBe(false)
  })

  it('should detect empty project', async () => {
    const state = await detectProjectState(testDir)

    expect(state.hasEdgeConfig).toBe(false)
    expect(state.hasWranglerToml).toBe(false)
    expect(state.hasViteConfig).toBe(false)
    expect(state.isEjected).toBe(false)
  })
})
