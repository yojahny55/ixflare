/**
 * Tests for package.json updater
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { updatePackageJson, getEjectedScripts } from '../../../src/commands/eject/package-updater'

describe('updatePackageJson', () => {
  let testDir: string

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'eject-pkg-test-'))
  })

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should update scripts section with ejected scripts', () => {
    const original = {
      name: 'my-app',
      version: '1.0.0',
      scripts: {
        dev: 'ix dev',
        build: 'ix build',
        test: 'vitest',
      },
    }

    writeFileSync(join(testDir, 'package.json'), JSON.stringify(original, null, 2))

    updatePackageJson(testDir)

    const updated = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'))

    expect(updated.scripts.dev).toBe('vite')
    expect(updated.scripts.build).toBe('vite build')
    expect(updated.scripts.preview).toBe('wrangler pages dev dist')
    expect(updated.scripts.deploy).toBe('wrangler deploy')
    expect(updated.scripts.typecheck).toBe('tsc --noEmit')
    expect(updated.scripts.test).toBe('vitest') // Preserved
  })

  it('should add ixflare ejection marker', () => {
    const original = {
      name: 'my-app',
      version: '1.0.0',
      scripts: {},
    }

    writeFileSync(join(testDir, 'package.json'), JSON.stringify(original, null, 2))

    updatePackageJson(testDir)

    const updated = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'))

    expect(updated.ixflare.ejected).toBe(true)
    expect(updated.ixflare.ejectedAt).toBeDefined()
    expect(new Date(updated.ixflare.ejectedAt).getTime()).toBeGreaterThan(0)
  })

  it('should preserve other package.json fields', () => {
    const original = {
      name: 'my-app',
      version: '1.0.0',
      description: 'My awesome app',
      author: 'Test Author',
      license: 'MIT',
      dependencies: {
        react: '^19.0.0',
      },
      devDependencies: {
        vitest: '^4.0.0',
      },
      scripts: {
        dev: 'ix dev',
      },
    }

    writeFileSync(join(testDir, 'package.json'), JSON.stringify(original, null, 2))

    updatePackageJson(testDir)

    const updated = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'))

    expect(updated.name).toBe('my-app')
    expect(updated.version).toBe('1.0.0')
    expect(updated.description).toBe('My awesome app')
    expect(updated.author).toBe('Test Author')
    expect(updated.license).toBe('MIT')
    expect(updated.dependencies).toEqual({ react: '^19.0.0' })
    expect(updated.devDependencies).toEqual({ vitest: '^4.0.0' })
  })

  it('should format JSON with 2 spaces and newline at end', () => {
    const original = { name: 'my-app', scripts: {} }

    writeFileSync(join(testDir, 'package.json'), JSON.stringify(original))

    updatePackageJson(testDir)

    const content = readFileSync(join(testDir, 'package.json'), 'utf-8')

    // Check for 2-space indentation
    expect(content).toMatch(/^{\n  "name":/)

    // Check for newline at end
    expect(content.endsWith('\n')).toBe(true)
  })
})

describe('getEjectedScripts', () => {
  it('should return all ejected scripts', () => {
    const scripts = getEjectedScripts()

    expect(scripts).toEqual({
      dev: 'vite',
      build: 'vite build',
      preview: 'wrangler pages dev dist',
      deploy: 'wrangler deploy',
      typecheck: 'tsc --noEmit',
    })
  })

  it('should not mutate the original scripts object', () => {
    const scripts1 = getEjectedScripts()
    const scripts2 = getEjectedScripts()

    scripts1.dev = 'modified'

    expect(scripts2.dev).toBe('vite')
  })
})
